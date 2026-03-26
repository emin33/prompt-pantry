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
}

interface GenerateRequest {
  dish: string;
  difficulty: string;
  cookware: string[];
  dietary: string;
  servings: number;
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
      // Agent 0: Prompt Engineer (Gemini free)
      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        name: "Prompt Engineer",
        status: "running",
      });

      const researchBrief = await callGemini(
        env.GEMINI_API_KEY,
        PROMPT_ENGINEER_SYSTEM,
        buildPromptEngineerMessage(input)
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 0,
        name: "Prompt Engineer",
        status: "complete",
        summary: researchBrief.slice(0, 300) + "...",
      });

      // Agent 1: Multi-Agent Research (5 parallel Claude Haiku agents with web search)
      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Research Team",
        status: "running",
        detail: "Deploying 5 research agents in parallel...",
      });

      const dish = input.dish;
      const researchBriefs = [
        {
          focus: "Best Recipes, Techniques & Food Science",
          prompt: `You are deeply researching "${dish}" for a recipe project. Search broadly and thoroughly — use many searches.

Your job: find the BEST versions of this dish from renowned chefs, acclaimed cookbooks, and authoritative food sources (Serious Eats, America's Test Kitchen, Kenji Lopez-Alt, Bon Appetit, professional chefs, Michelin restaurants, etc.). For each source, extract:
- Exact techniques, temperatures, and timing
- Ingredient ratios and proportions
- The food science behind why their approach works (Maillard reaction temps, emulsification, acid/fat/salt balance, etc.)
- What makes their version exceptional vs. average

Search for at least 5-8 different acclaimed sources. Compare their approaches and note consensus vs. disagreements.

Research brief for context:\n${researchBrief}`,
        },
        {
          focus: "Common Mistakes, Pro Tips & Regional Authenticity",
          prompt: `You are deeply researching "${dish}" for a recipe project. Search broadly and thoroughly — use many searches.

Your job covers two areas:

1. MISTAKES & TIPS: Find the most common mistakes home cooks make with this dish and professional tips to avoid them. Search cooking forums, chef interviews, troubleshooting guides. Focus on pitfalls that separate mediocre from excellent results.

2. AUTHENTICITY & VARIATIONS: Research how this dish is prepared in its region of origin vs. adaptations elsewhere. What are the traditional ingredients, techniques, and serving styles? What do purists insist on? What regional twists exist?

Search for at least 5-8 different sources across both areas.

Research brief for context:\n${researchBrief}`,
        },
        {
          focus: "Home Kitchen Adaptations & Equipment",
          prompt: `You are deeply researching "${dish}" for a home cook recipe project. Search broadly and thoroughly — use many searches.

The cook has access to: ${input.cookware.join(", ")}.

Your job: find how to achieve professional-quality results with home equipment. Search for:
- Equipment-specific techniques and substitutions for home kitchens
- Batch sizing and timing adjustments for home stoves/ovens
- Make-ahead strategies, storage, and reheating tips
- Ingredient sourcing tips and acceptable substitutions
- Scaling considerations

Search for at least 4-6 different sources.

Research brief for context:\n${researchBrief}`,
        },
      ];

      const research = await callClaudeMultiAgentResearch(
        env.ANTHROPIC_API_KEY,
        researchBriefs,
        15 // max searches per agent = up to 45 total searches
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Research Team",
        status: "complete",
        summary: `3 agents completed parallel research`,
      });

      // Agent 2: Recipe Architect (Gemini free, JSON mode)
      await sendSSE(writer, encoder, "agent", {
        agent: 2,
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
        agent: 2,
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
