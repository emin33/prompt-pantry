import Anthropic from "@anthropic-ai/sdk";
import { VALID_CATEGORIES } from "./mdx-builder";

/**
 * Model per pipeline stage. Opus does the quality-critical synthesis (small
 * input, the recipe itself); Sonnet does the token-heavy web research; Haiku
 * does the yes/no validation.
 */
export const CLAUDE_MODELS = {
  validator: "claude-haiku-5-5",
  promptEngineer: "claude-sonnet-5-5",
  researcher: "claude-sonnet-5-5",
  architect: "claude-opus-5-5",
} as const;

type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS];
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// USD per 1M tokens: [input, output, cache read]. Used for the per-recipe cost log only.
// Includes the models server-side fallback can route declines to.
const PRICING: Record<string, [number, number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5, 0.01],
  "claude-sonnet-5-5": [2, 10, 0.2],
  "claude-opus-5-5": [4, 20, 0.2],
  "claude-sonnet-5": [2, 10, 0.2],
  "claude-opus-5": [5, 25, 0.5],
  "claude-opus-4-8": [5, 25, 0.5],
};
const WEB_SEARCH_COST = 0.01; // $10 per 1,000 searches

// Haiku has no server-side fallback; the others retry classifier declines on another model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_CONTINUATIONS = 5;

interface TokenCounts {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

function tokenCost(model: string, u: TokenCounts): number {
  const [inRate, outRate, cacheRate] = PRICING[model] ?? PRICING["claude-opus-5-5"];
  return (
    ((u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25) * inRate +
      (u.cache_read_input_tokens ?? 0) * cacheRate +
      u.output_tokens * outRate) /
    1_000_000
  );
}

/** Accumulates estimated spend across every Claude call in one recipe generation. */
export class CostTracker {
  usd = 0;
  searches = 0;

  add(model: ClaudeModel, usage: Anthropic.Beta.BetaUsage) {
    const searches = usage.server_tool_use?.web_search_requests ?? 0;
    this.searches += searches;
    this.usd += searches * WEB_SEARCH_COST;
    // With a fallback, top-level usage covers only the final attempt; iterations
    // lists each attempt (declined + fallback) with the model that ran it.
    const attempts = usage.iterations?.filter(
      (it) => it.type === "message" || it.type === "fallback_message"
    );
    if (attempts?.length) {
      for (const it of attempts) {
        this.usd += tokenCost(it.model ?? model, it);
      }
    } else {
      this.usd += tokenCost(model, usage);
    }
  }
}

interface ClaudeCallOptions {
  apiKey: string;
  model: ClaudeModel;
  system: string;
  user: string;
  effort: Effort;
  maxTokens?: number;
  tools?: Anthropic.Beta.BetaToolUnion[];
  jsonSchema?: Record<string, unknown>;
  cost?: CostTracker;
}

/**
 * One Claude request, streamed (research turns can be long), resuming
 * `pause_turn` when the server-side web search loop hits its iteration cap.
 * Returns the concatenated text of the final assistant turn.
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const useFallback = opts.model !== CLAUDE_MODELS.validator;
  const assistantContent: Anthropic.Beta.BetaContentBlockParam[] = [];
  let completed = false;
  let containerId: string | undefined; // web search's dynamic filtering runs in a container; resume in the same one

  for (let turn = 0; turn <= MAX_CONTINUATIONS && !completed; turn++) {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.user }];
    if (assistantContent.length) messages.push({ role: "assistant", content: assistantContent });

    const response = await client.beta.messages
      .stream({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 32000,
        system: opts.system,
        messages,
        tools: opts.tools,
        container: containerId,
        output_config: {
          effort: opts.effort,
          ...(opts.jsonSchema && { format: { type: "json_schema", schema: opts.jsonSchema } }),
        },
        ...(useFallback && { betas: [FALLBACK_BETA], fallbacks: "default" as const }),
      })
      .finalMessage();

    opts.cost?.add(opts.model, response.usage);

    if (response.stop_reason === "refusal") {
      throw new Error(`Claude declined the request (${response.stop_details?.category ?? "no category"})`);
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(`Claude response hit max_tokens on ${opts.model}`);
    }

    assistantContent.push(...(response.content as Anthropic.Beta.BetaContentBlockParam[]));
    containerId = response.container?.id ?? containerId;
    completed = response.stop_reason !== "pause_turn";
  }
  if (!completed) {
    throw new Error(`Claude turn still paused after ${MAX_CONTINUATIONS} continuations on ${opts.model}`);
  }

  // No separator: citations and mid-stream fallbacks split one continuous text
  // (possibly mid-JSON-string) across blocks.
  const text = assistantContent
    .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("No text response from Claude");
  return text;
}

/**
 * Run multiple parallel research agents, each focused on a different dimension.
 * Each agent gets its own web search budget for independent searching.
 */
export async function callClaudeMultiAgentResearch(
  apiKey: string,
  researchBriefs: Array<{ focus: string; prompt: string }>,
  maxSearchesPerAgent: number | number[] = 10,
  cost?: CostTracker
): Promise<string> {
  const results = await Promise.all(
    researchBriefs.map(async (brief, index) => {
      const maxSearches = Array.isArray(maxSearchesPerAgent)
        ? maxSearchesPerAgent[index] ?? maxSearchesPerAgent[maxSearchesPerAgent.length - 1]
        : maxSearchesPerAgent;
      try {
        const result = await callClaude({
          apiKey,
          model: CLAUDE_MODELS.researcher,
          effort: "medium",
          system: `You are a culinary research specialist focused on: ${brief.focus}.
Search thoroughly — use multiple searches to find the best sources.
Look for professional chefs, food scientists, acclaimed cookbooks, and authoritative recipe developers.
Be specific with findings: include exact ratios, temperatures, timing, and technique details.
Cite your sources.`,
          user: brief.prompt,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }],
          cost,
        });
        return `## ${brief.focus}\n\n${result}`;
      } catch (err) {
        return `## ${brief.focus}\n\n[Research failed: ${err instanceof Error ? err.message : "unknown error"}]`;
      }
    })
  );

  return results.join("\n\n---\n\n");
}

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });
const strictObject = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const VALIDATION_SCHEMA = strictObject({
  valid: { type: "boolean" },
  reason: { type: "string" },
});

/** Mirrors the JSON shape described in RECIPE_ARCHITECT_SYSTEM / RecipeJSON. */
export const RECIPE_SCHEMA = strictObject({
  title: { type: "string" },
  description: { type: "string" },
  cuisine: { type: "string" },
  category: { type: "string", enum: VALID_CATEGORIES },
  prepTime: { type: "number" },
  cookTime: { type: "number" },
  restTime: { type: "number" },
  servings: { type: "number" },
  ingredients: {
    type: "array",
    items: strictObject({
      name: { type: "string" },
      items: {
        type: "array",
        items: strictObject({
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
        }),
      },
    }),
  },
  tags: { type: "array", items: { type: "string" } },
  equipment: { type: "array", items: { type: "string" } },
  overview: { type: "string" },
  steps: {
    type: "array",
    items: strictObject({
      title: { type: "string" },
      body: { type: "string" },
      timerMinutes: nullable("number"),
      timerLabel: nullable("string"),
    }),
  },
  notes: {
    type: "array",
    items: strictObject({
      title: { type: "string" },
      content: { type: "string" },
    }),
  },
});
