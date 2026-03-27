import { callGemini } from "../../src/lib/gemini";
import { callClaudeMultiAgentResearch } from "../../src/lib/claude";
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
  PUBLISH_PASSWORD: string;
}

interface GenerateRequest {
  dish: string;
  difficulty: string;
  cookware: string[];
  dietary: string;
  servings: number;
  password: string;
  feedback?: string;
}

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

  // Validate password (timing-safe)
  if (!input.password || !timingSafeEqual(input.password, env.PUBLISH_PASSWORD)) {
    return new Response(
      JSON.stringify({ error: "Invalid access code" }),
      { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  // Validate dish input
  const dish = input.dish?.trim() || "";
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
        name: "Validating Input",
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
        await writer.close();
        return;
      }

      // LLM validation for borderline cases (Gemini free)
      const validationResult = await callGemini(
        env.GEMINI_API_KEY,
        `You are a food validator. Your ONLY job is to determine if the user's input is a real food, dish, or recipe that can be cooked. Respond with ONLY a JSON object: {"valid": true} or {"valid": false, "reason": "brief explanation"}.

Examples of VALID inputs: "pad thai", "chicken parmesan", "sourdough bread", "chocolate lava cake", "miso soup", "beef wellington", "scrambled eggs"
Examples of INVALID inputs: "box of nails", "my homework", "a car", "the color blue", "clean my room"

Be generous — if it could reasonably be a food or dish from any cuisine, it's valid. Misspellings are fine.`,
        `Is this a valid food/dish to make a recipe for? "${dish}"`,
        true // JSON mode
      );

      try {
        const validation = JSON.parse(validationResult);
        if (!validation.valid) {
          recordFailedValidation(clientIP);
          await sendSSE(writer, encoder, "error", {
            message: validation.reason || `"${dish}" doesn't appear to be a real food or dish. Please enter a valid recipe name.`,
          });
          await writer.close();
          return;
        }
      } catch {
        // If validation parsing fails, proceed anyway
      }

      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        name: "Validating Input",
        status: "complete",
        summary: "Valid dish confirmed",
      });

      // Agent 1: Prompt Engineer (Gemini free)
      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Prompt Engineer",
        status: "running",
      });

      const researchBrief = await callGemini(
        env.GEMINI_API_KEY,
        PROMPT_ENGINEER_SYSTEM,
        buildPromptEngineerMessage(input)
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Prompt Engineer",
        status: "complete",
        summary: "Research brief prepared",
      });

      // Agent 2: Multi-Agent Research (parallel Claude Haiku agents with web search)
      await sendSSE(writer, encoder, "agent", {
        agent: 2,
        name: "Research Team",
        status: "running",
        detail: "Deploying 2 research agents in parallel...",
      });

      const dish = input.dish;
      const researchBriefs = [
        {
          focus: "Best Recipes, Techniques & Food Science",
          prompt: `You are deeply researching "${dish}" for a recipe project. Search for the BEST versions from renowned chefs, acclaimed cookbooks, and authoritative food sources (Serious Eats, America's Test Kitchen, Kenji Lopez-Alt, Bon Appetit, professional chefs, etc.). For each source, extract:
- Exact techniques, temperatures, and timing
- Ingredient ratios and proportions
- The food science behind why their approach works
- What makes their version exceptional vs. average

Compare approaches and note consensus vs. disagreements.

Research brief for context:\n${researchBrief}`,
        },
        {
          focus: "Common Mistakes, Pro Tips & Regional Authenticity",
          prompt: `You are researching "${dish}" for a recipe project. Cover two areas:

1. MISTAKES & TIPS: Find the most common mistakes home cooks make with this dish and professional tips to avoid them. Focus on pitfalls that separate mediocre from excellent results.

2. AUTHENTICITY & VARIATIONS: How is this dish prepared in its region of origin vs. adaptations elsewhere? What are the traditional ingredients and techniques? What do purists insist on?

Research brief for context:\n${researchBrief}`,
        },
      ];

      const research = await callClaudeMultiAgentResearch(
        env.ANTHROPIC_API_KEY,
        researchBriefs,
        [8, 4] // recipes: 8 searches, mistakes/authenticity: 4
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 2,
        name: "Research Team",
        status: "complete",
        summary: `2 agents completed parallel research`,
      });

      // Agent 3: Recipe Architect (Gemini free, JSON mode)
      await sendSSE(writer, encoder, "agent", {
        agent: 3,
        name: "Recipe Architect",
        status: "running",
      });

      const recipeJsonStr = await callGemini(
        env.GEMINI_API_KEY,
        RECIPE_ARCHITECT_SYSTEM,
        buildRecipeArchitectMessage(research, input),
        true // JSON mode
      );

      const recipeData = parseRecipeJSON(recipeJsonStr);
      const mdx = buildMDX(recipeData, input.difficulty);
      const slug = toSlug(recipeData.title);

      await sendSSE(writer, encoder, "agent", {
        agent: 3,
        name: "Recipe Architect",
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

      await sendSSE(writer, encoder, "done", {});
    } catch (err) {
      console.error("Generation pipeline error:", err);
      const rawMessage = err instanceof Error ? err.message : "Unknown error";
      // Don't leak API details to the client
      const message = rawMessage.includes("API error")
        ? "An AI service encountered an error. Please try again."
        : rawMessage;
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
