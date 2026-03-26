import { callGemini } from "../../src/lib/gemini";
import { callClaudeWithWebSearch } from "../../src/lib/claude";
import {
  PROMPT_ENGINEER_SYSTEM,
  buildPromptEngineerMessage,
} from "../../src/lib/agents/prompt-engineer";
import {
  RESEARCH_AGENT_SYSTEM,
  buildResearchMessage,
} from "../../src/lib/agents/research-agent";
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

      // Agent 1: Research Agent (Claude Haiku + web search)
      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Research Agent",
        status: "running",
      });

      const research = await callClaudeWithWebSearch(
        env.ANTHROPIC_API_KEY,
        RESEARCH_AGENT_SYSTEM,
        buildResearchMessage(researchBrief)
      );

      await sendSSE(writer, encoder, "agent", {
        agent: 1,
        name: "Research Agent",
        status: "complete",
        summary: research.slice(0, 300) + "...",
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
