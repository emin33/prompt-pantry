import { callGemini } from "../../src/lib/gemini";
import {
  CLAUDE_MODELS,
  CostTracker,
  RECIPE_SCHEMA,
  DUPLICATE_SCHEMA,
  VALIDATION_SCHEMA,
  callClaude,
  callClaudeMultiAgentResearch,
} from "../../src/lib/claude";
import { callDeepSeekMultiAgentResearch } from "../../src/lib/deepseek";
import { verifyJWT } from "../lib/jwt";
import {
  PROMPT_ENGINEER_SYSTEM,
  buildPromptEngineerMessage,
} from "../../src/lib/agents/prompt-engineer";
import {
  RECIPE_ARCHITECT_SYSTEM,
  buildRecipeArchitectMessage,
} from "../../src/lib/agents/recipe-architect";
import { buildMDX, parseRecipeJSON } from "../../src/lib/mdx-builder";
import { toSlug } from "../../src/lib/slug";

interface Env {
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  TAVILY_API_KEY: string;
  RESEARCH_PROVIDER?: string;
  JWT_SECRET: string;
  ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> };
}

interface GenerateRequest {
  dish: string;
  recipeType?: "food" | "drink";
  difficulty: string;
  cookware: string[];
  dietary: string;
  servings: number;
  password: string;
  feedback?: string;
  // Set when the user saw the "already exists" card and chose to make another version.
  allowDuplicate?: boolean;
  existingSlug?: string;
  variation?: string;
}

interface CatalogRecipe {
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  category: string;
  difficulty: string;
  totalTime: number;
  image?: string;
}

// The site's own prerendered catalog (src/pages/api/catalog.json.ts). An empty
// list just means the duplicate check is skipped.
async function loadCatalog(env: Env, requestUrl: string): Promise<CatalogRecipe[]> {
  try {
    const res = await env.ASSETS.fetch(new URL("/api/catalog.json", requestUrl));
    if (!res.ok) return [];
    const catalog = (await res.json()) as {
      recipes: Array<{ id: string; data: Omit<CatalogRecipe, "slug"> }>;
    };
    return catalog.recipes.map(({ id, data }) => ({
      slug: id,
      title: data.title,
      description: data.description,
      cuisine: data.cuisine,
      category: data.category,
      difficulty: data.difficulty,
      totalTime: data.totalTime,
      image: data.image,
    }));
  } catch {
    return [];
  }
}

const DUPLICATE_CHECK_SYSTEM = `You check whether a requested dish is already on a recipe website. You get the request and the site's existing recipes as "slug | title | category" lines.

Return the slug of the existing recipe that is the SAME dish: one a home cook would treat as the same recipe even when the name differs a little (word order, a dropped adjective like "spicy" or "classic", spelling, "pasta fagioli" vs "pasta e fagioli", "tomato basil pappardelle" vs "spicy tomato basil pappardelle").
Return an empty string when the request is a genuinely different dish, even if it shares an ingredient, cuisine or cooking method ("chicken tikka masala" is not "butter chicken"; "beef pho" is not "pad see ew").
If the request asks for gluten-free and a gluten-free version exists, return that one. If several match, return the closest.
Respond with ONLY a JSON object: {"matchSlug": "<slug or empty string>"}.`;

// timingSafeEqual kept for rate limit abuse detection
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

const ALLOWED_ORIGIN = "https://promptpantry.org";

// Simple in-memory rate limiter (per worker instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // max requests per window
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// Abuse detection: track failed validation attempts
const failedValidationMap = new Map<string, { count: number; blockedUntil: number }>();
const MAX_FAILED_VALIDATIONS = 5;
const FAILED_VALIDATION_WINDOW = 30 * 60 * 1000; // 30 minutes
const ABUSE_BLOCK_DURATION = 60 * 60 * 1000; // blocked for 1 hour

function checkAbuseBan(ip: string): boolean {
  const entry = failedValidationMap.get(ip);
  if (!entry) return true;
  if (Date.now() > entry.blockedUntil) {
    failedValidationMap.delete(ip);
    return true;
  }
  return entry.count < MAX_FAILED_VALIDATIONS;
}

function recordFailedValidation(ip: string): void {
  const now = Date.now();
  const entry = failedValidationMap.get(ip);
  if (!entry || now > entry.blockedUntil) {
    failedValidationMap.set(ip, { count: 1, blockedUntil: now + FAILED_VALIDATION_WINDOW });
  } else {
    entry.count++;
    if (entry.count >= MAX_FAILED_VALIDATIONS) {
      entry.blockedUntil = now + ABUSE_BLOCK_DURATION;
    }
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function sendSSE(
  controller: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  event: string,
  data: unknown
) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return controller.write(encoder.encode(payload));
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let input: GenerateRequest;
  try {
    input = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Abuse detection + rate limiting
  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!checkAbuseBan(clientIP)) {
    return new Response(
      JSON.stringify({ error: "Too many invalid requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }
  if (!checkRateLimit(clientIP)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  // Validate JWT token
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing authentication token" }),
      { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }
  const jwtResult = await verifyJWT(token, env.JWT_SECRET);
  if (!jwtResult.valid) {
    return new Response(
      JSON.stringify({ error: jwtResult.error }),
      { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  // Validate dish input
  const dish = input.dish?.trim() || "";
  const recipeType: "food" | "drink" = input.recipeType === "drink" ? "drink" : "food";
  input.recipeType = recipeType;
  if (dish.length < 2 || dish.length > 200) {
    return new Response(
      JSON.stringify({ error: "Dish name must be 2-200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Run the pipeline in the background
  (async () => {
    try {
      // Step 0: Validate the dish is actually food
      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        status: "running",
      });

      // Local pre-check: catch obvious garbage before burning a Gemini call
      const dishLower = dish.toLowerCase();
      const localInvalid = (() => {
        // Must contain at least one letter
        if (!/[a-zA-Z]/.test(dish)) return "Please enter a dish name with letters.";
        // Reject if mostly numbers/symbols (>50% non-letter)
        const letterCount = (dish.match(/[a-zA-Z]/g) || []).length;
        if (letterCount / dish.length < 0.5) return "That doesn't look like a dish name.";
        // Reject keyboard spam (3+ consecutive consonants with no vowels)
        if (/[^aeiou\s]{5,}/i.test(dishLower.replace(/[^a-z]/g, ""))) return "That doesn't look like a dish name.";
        // Reject obvious non-food words
        const blocklist = ["homework", "hello world", "test", "asdf", "qwerty", "password", "admin", "login", "http", "www", ".com", ".org", "javascript", "python", "select ", "drop ", "delete "];
        if (blocklist.some((w) => dishLower.includes(w))) return "Please enter an actual food or dish.";
        // Must be reasonable word count (1-10 words)
        const wordCount = dish.trim().split(/\s+/).length;
        if (wordCount > 10) return "Dish name seems too long. Keep it concise.";
        return null;
      })();

      if (localInvalid) {
        recordFailedValidation(clientIP);
        await sendSSE(writer, encoder, "error", { message: localInvalid });
        return;
      }

      // Provider for every LLM stage: "anthropic" (default) runs the whole pipeline on
      // Claude; "deepseek" is the legacy Gemini + DeepSeek/Tavily path.
      const provider = (env.RESEARCH_PROVIDER || "anthropic").toLowerCase();
      const useClaude = provider === "anthropic";
      const cost = new CostTracker();
      const llm = (
        stage: "validator" | "promptEngineer" | "architect",
        system: string,
        user: string,
        jsonSchema?: Record<string, unknown>,
      ) =>
        useClaude
          ? callClaude({
              apiKey: env.ANTHROPIC_API_KEY,
              model: CLAUDE_MODELS[stage],
              effort: stage === "architect" ? "high" : "low",
              system,
              user,
              jsonSchema,
              cost,
            })
          : callGemini(
              env.GEMINI_API_KEY,
              system,
              user,
              !!jsonSchema,
              stage === "architect" ? "gemini-3-flash-preview" : undefined,
            );

      const catalog = await loadCatalog(env, request.url);
      const duplicateCheck =
        input.allowDuplicate || catalog.length === 0
          ? Promise.resolve("")
          : llm(
              "validator",
              DUPLICATE_CHECK_SYSTEM,
              `Request: "${dish}" (${recipeType})\n\nExisting recipes:\n${catalog
                .map((r) => `${r.slug} | ${r.title} | ${r.category}`)
                .join("\n")}`,
              DUPLICATE_SCHEMA,
            ).catch((err) => {
              console.warn("Duplicate check failed, continuing:", err);
              return "";
            });

      // LLM validation for borderline cases
      const validationPromise = llm(
        "validator",
        recipeType === "drink"
          ? `You are a drink validator. Your ONLY job is to determine if the user's input is a real beverage — a cocktail, mocktail, or other drink that can be made. Respond with ONLY a JSON object: {"valid": true} or {"valid": false, "reason": "brief explanation"}.

Examples of VALID inputs: "margarita", "old fashioned", "butterbeer", "mango lassi", "espresso martini", "hot chocolate", "virgin pina colada"
Examples of INVALID inputs: "box of nails", "my homework", "a car", "the color blue", "motor oil"

Be generous — if it could reasonably be a drink from any tradition, it's valid. Misspellings are fine.`
          : `You are a food validator. Your ONLY job is to determine if the user's input is a real food, dish, or recipe that can be cooked. Respond with ONLY a JSON object: {"valid": true} or {"valid": false, "reason": "brief explanation"}.

Examples of VALID inputs: "pad thai", "chicken parmesan", "sourdough bread", "chocolate lava cake", "miso soup", "beef wellington", "scrambled eggs"
Examples of INVALID inputs: "box of nails", "my homework", "a car", "the color blue", "clean my room"

Be generous — if it could reasonably be a food or dish from any cuisine, it's valid. Misspellings are fine.`,
        recipeType === "drink"
          ? `Is this a valid drink to make a recipe for? "${dish}"`
          : `Is this a valid food/dish to make a recipe for? "${dish}"`,
        VALIDATION_SCHEMA,
      );
      const [validationResult, duplicateResult] = await Promise.all([validationPromise, duplicateCheck]);

      try {
        const validation = JSON.parse(validationResult);
        if (!validation.valid) {
          recordFailedValidation(clientIP);
          await sendSSE(writer, encoder, "error", {
            message: validation.reason || `"${dish}" doesn't appear to be a real food or dish. Please enter a valid recipe name.`,
          });
          return;
        }
      } catch {
        // If validation parsing fails, proceed anyway
      }

      let existing: CatalogRecipe | undefined;
      try {
        const matchSlug = duplicateResult ? (JSON.parse(duplicateResult) as { matchSlug?: string }).matchSlug : "";
        existing = catalog.find((r) => r.slug === matchSlug);
      } catch {
        // Unparseable duplicate check: treat as no match
      }
      if (existing) {
        await sendSSE(writer, encoder, "duplicate", existing);
        return;
      }

      // "Make a new one anyway": steer both the brief and the recipe away from the existing one.
      const original = input.allowDuplicate
        ? catalog.find((r) => r.slug === input.existingSlug)
        : undefined;
      const variationText = input.variation?.trim().slice(0, 500);
      if (original) {
        input.variation =
          `We already have a recipe called "${original.title}". This must be a distinct new version, not a copy of it.` +
          (variationText ? ` What should be different: "${variationText}".` : "");
      } else {
        input.variation = undefined;
      }

      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        status: "complete",
        summary: "Sounds delicious",
      });

      // Agent 1: Prompt Engineer
      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        status: "running",
      });

      const researchBrief = await llm(
        "promptEngineer",
        PROMPT_ENGINEER_SYSTEM,
        buildPromptEngineerMessage(input)
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        status: "complete",
        summary: "Game plan ready",
      });

      // Agent 2: Multi-Agent Research (parallel research agents with web search)
      await sendSSE(writer, encoder, "agent", {
        agent: 2,
        status: "running",
      });

      const dishName = input.dish;
      const researchBriefs = recipeType === "drink"
        ? [
            {
              focus: "Best Specs, Technique & Drink Science",
              prompt: `You are deeply researching the drink "${dishName}" for a recipe project. Search for the BEST versions from renowned bartenders, acclaimed cocktail books, and authoritative drink sources (Death & Co, Liquor.com, Difford's Guide, PDT Cocktail Book, Imbibe, respected bartenders, etc.). For each source, extract:
- The exact spec in oz/ml and the build order
- Technique: shaken vs stirred, ice choice, dilution targets, temperature
- The reasoning behind why their approach works
- What makes their version exceptional vs. average

Compare specs and note consensus vs. disagreements.

Research brief for context:\n${researchBrief}`,
            },
            {
              focus: "Common Mistakes, Pro Tips & Variations",
              prompt: `You are researching the drink "${dishName}" for a recipe project. Cover two areas:

1. MISTAKES & TIPS: Find the most common mistakes home bartenders make with this drink and professional tips to avoid them — over/under-dilution, wrong ice, bad ratios, technique errors.

2. HISTORY & VARIATIONS: What is the classic/original spec and its story? What are the notable riffs and modern variations? What do purists insist on? Include batching and non-alcoholic adaptations where relevant.

Research brief for context:\n${researchBrief}`,
            },
          ]
        : [
            {
              focus: "Best Recipes, Techniques & Food Science",
              prompt: `You are deeply researching "${dishName}" for a recipe project. Search for the BEST versions from renowned chefs, acclaimed cookbooks, and authoritative food sources (Serious Eats, America's Test Kitchen, Kenji Lopez-Alt, Bon Appetit, professional chefs, etc.). For each source, extract:
- Exact techniques, temperatures, and timing
- Ingredient ratios and proportions
- The food science behind why their approach works
- What makes their version exceptional vs. average

Compare approaches and note consensus vs. disagreements.

Research brief for context:\n${researchBrief}`,
            },
            {
              focus: "Common Mistakes, Pro Tips & Regional Authenticity",
              prompt: `You are researching "${dishName}" for a recipe project. Cover two areas:

1. MISTAKES & TIPS: Find the most common mistakes home cooks make with this dish and professional tips to avoid them. Focus on pitfalls that separate mediocre from excellent results.

2. AUTHENTICITY & VARIATIONS: How is this dish prepared in its region of origin vs. adaptations elsewhere? What are the traditional ingredients and techniques? What do purists insist on?

Research brief for context:\n${researchBrief}`,
            },
          ];

      const research = useClaude
        ? await callClaudeMultiAgentResearch(
            env.ANTHROPIC_API_KEY,
            researchBriefs,
            [8, 4],
            cost,
          )
        : await callDeepSeekMultiAgentResearch(
            env.DEEPSEEK_API_KEY,
            env.TAVILY_API_KEY,
            env.GEMINI_API_KEY,
            researchBriefs,
            [8, 4],
          );

      await sendSSE(writer, encoder, "agent", {
        agent: 2,
        status: "complete",
        summary: "Done reading up",
      });

      // Agent 3: Recipe Architect
      await sendSSE(writer, encoder, "agent", {
        agent: 3,
        status: "running",
      });

      const recipeJsonStr = await llm(
        "architect",
        RECIPE_ARCHITECT_SYSTEM,
        buildRecipeArchitectMessage(research, input),
        RECIPE_SCHEMA,
      );

      const recipeData = parseRecipeJSON(recipeJsonStr);
      let slug = toSlug(recipeData.title);
      // A deliberate second version can land on an existing slug; publish would refuse it.
      for (let n = 2; catalog.some((r) => r.slug === slug); n++) {
        slug = `${toSlug(recipeData.title)}-${n}`;
      }
      const mdx = buildMDX(recipeData, input.difficulty, recipeType, slug);

      await sendSSE(writer, encoder, "agent", {
        agent: 3,
        status: "complete",
      });

      await sendSSE(writer, encoder, "recipe", {
        slug,
        title: recipeData.title,
        mdx,
        research,
        preview: {
          title: recipeData.title,
          description: recipeData.description,
          cuisine: recipeData.cuisine,
          category: recipeData.category,
          difficulty: input.difficulty,
          prepTime: recipeData.prepTime,
          cookTime: recipeData.cookTime,
          totalTime:
            recipeData.prepTime +
            recipeData.cookTime +
            (recipeData.restTime || 0),
          servings: recipeData.servings,
          overview: recipeData.overview,
          steps: recipeData.steps,
          notes: recipeData.notes,
          ingredients: recipeData.ingredients,
          equipment: recipeData.equipment,
          tags: recipeData.tags,
        },
      });

      if (useClaude) {
        console.log(`Recipe "${recipeData.title}": ~$${cost.usd.toFixed(3)} (${cost.searches} web searches)`);
      }
      await sendSSE(writer, encoder, "done", useClaude ? { costUsd: Number(cost.usd.toFixed(3)) } : {});
    } catch (err) {
      console.error("Generation pipeline error:", err);
      const rawMessage = err instanceof Error ? err.message : "Unknown error";
      // Include error detail for debugging (remove in production later)
      const message = rawMessage;
      await sendSSE(writer, encoder, "error", { message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
