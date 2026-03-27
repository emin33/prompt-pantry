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

  // Validate password
  if (!input.password || input.password !== env.PUBLISH_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "Invalid access code" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!input.dish || input.dish.trim().length < 2) {
    return new Response(
      JSON.stringify({ error: "Dish name is required (min 2 chars)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Run the pipeline in the background
  (async () => {
    try {
      // Step 0: Validate the dish is actually food (Gemini free, fast)
      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        name: "Validating Input",
        status: "running",
      });

      const validationResult = await callGemini(
        env.GEMINI_API_KEY,
        `You are a food validator. Your ONLY job is to determine if the user's input is a real food, dish, or recipe that can be cooked. Respond with ONLY a JSON object: {"valid": true} or {"valid": false, "reason": "brief explanation"}.

Examples of VALID inputs: "pad thai", "chicken parmesan", "sourdough bread", "chocolate lava cake", "miso soup", "beef wellington", "scrambled eggs"
Examples of INVALID inputs: "box of nails", "asdfgh", "my homework", "a car", "hello world", "the color blue"

Be generous — if it could reasonably be a food or dish from any cuisine, it's valid. Misspellings are fine.`,
        `Is this a valid food/dish to make a recipe for? "${input.dish}"`,
        true // JSON mode
      );

      try {
        const validation = JSON.parse(validationResult);
        if (!validation.valid) {
          await sendSSE(writer, encoder, "error", {
            message: validation.reason || `"${input.dish}" doesn't appear to be a real food or dish. Please enter a valid recipe name.`,
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
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
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
      "Access-Control-Allow-Origin": "*",
    },
  });
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
