const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_BATCH_API_URL = "https://api.anthropic.com/v1/messages/batches";

interface ContentBlock {
  type: string;
  text?: string;
  citations?: Array<{
    type: string;
    url?: string;
    title?: string;
    cited_text?: string;
  }>;
}

interface ClaudeResponse {
  content: ContentBlock[];
  error?: { message: string };
}

function extractText(content: ContentBlock[]): string {
  const textParts = content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!);

  if (textParts.length === 0) {
    throw new Error("No text response from Claude");
  }

  return textParts.join("\n\n");
}

/**
 * Run multiple parallel research agents using the Batch API (50% cost savings).
 * Each agent gets its own web search budget for independent searching.
 * Falls back to parallel direct calls if batch API fails.
 */
export async function callClaudeMultiAgentResearch(
  apiKey: string,
  researchBriefs: Array<{ focus: string; prompt: string }>,
  maxSearchesPerAgent: number | number[] = 10
): Promise<string> {
  // Build batch requests
  const requests = researchBriefs.map((brief, index) => {
    const maxSearches = Array.isArray(maxSearchesPerAgent)
      ? maxSearchesPerAgent[index] ?? maxSearchesPerAgent[maxSearchesPerAgent.length - 1]
      : maxSearchesPerAgent;

    return {
      custom_id: `research-${index}`,
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: `You are a culinary research specialist focused on: ${brief.focus}.
Search thoroughly — use multiple searches to find the best sources.
Look for professional chefs, food scientists, acclaimed cookbooks, and authoritative recipe developers.
Be specific with findings: include exact ratios, temperatures, timing, and technique details.
Cite your sources.`,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: maxSearches,
          },
        ],
        messages: [
          {
            role: "user",
            content: brief.prompt,
          },
        ],
      },
    };
  });

  try {
    // Create batch
    const createRes = await fetch(CLAUDE_BATCH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ requests }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Batch create failed (${createRes.status}): ${text}`);
    }

    const batch = await createRes.json() as { id: string; processing_status: string; results_url: string | null };
    const batchId = batch.id;

    // Poll until complete (check every 10 seconds, max 5 minutes)
    const maxPollAttempts = 30;
    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise((r) => setTimeout(r, 10000));

      const pollRes = await fetch(`${CLAUDE_BATCH_API_URL}/${batchId}`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json() as { processing_status: string; results_url: string | null };

      if (pollData.processing_status === "ended") {
        // Fetch results
        const resultsRes = await fetch(`${CLAUDE_BATCH_API_URL}/${batchId}/results`, {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });

        if (!resultsRes.ok) {
          throw new Error(`Failed to fetch batch results: ${resultsRes.status}`);
        }

        const resultsText = await resultsRes.text();
        const resultLines = resultsText.trim().split("\n");

        // Parse each JSONL line and extract text by custom_id
        const resultMap = new Map<string, string>();
        for (const line of resultLines) {
          try {
            const result = JSON.parse(line);
            if (result.result?.type === "succeeded" && result.result?.message?.content) {
              const text = extractText(result.result.message.content);
              resultMap.set(result.custom_id, text);
            } else if (result.result?.type === "errored") {
              resultMap.set(result.custom_id, `[Research failed: ${result.result?.error?.message || "unknown error"}]`);
            }
          } catch {
            // Skip malformed lines
          }
        }

        // Combine results in order
        const combinedResults = researchBriefs.map((brief, index) => {
          const text = resultMap.get(`research-${index}`) || "[No result returned]";
          return `## ${brief.focus}\n\n${text}`;
        });

        return combinedResults.join("\n\n---\n\n");
      }
    }

    throw new Error("Batch processing timed out after 5 minutes");
  } catch (err) {
    // Fallback to parallel direct calls if batch fails
    console.error("Batch API failed, falling back to direct calls:", err);
    return callClaudeMultiAgentResearchDirect(apiKey, researchBriefs, maxSearchesPerAgent);
  }
}

/**
 * Fallback: Run multiple parallel research agents with direct API calls.
 */
async function callClaudeMultiAgentResearchDirect(
  apiKey: string,
  researchBriefs: Array<{ focus: string; prompt: string }>,
  maxSearchesPerAgent: number | number[] = 10
): Promise<string> {
  const results = await Promise.all(
    researchBriefs.map(async (brief, index) => {
      const maxSearches = Array.isArray(maxSearchesPerAgent)
        ? maxSearchesPerAgent[index] ?? maxSearchesPerAgent[maxSearchesPerAgent.length - 1]
        : maxSearchesPerAgent;
      try {
        const result = await callClaudeWithWebSearch(
          apiKey,
          `You are a culinary research specialist focused on: ${brief.focus}.
Search thoroughly — use multiple searches to find the best sources.
Look for professional chefs, food scientists, acclaimed cookbooks, and authoritative recipe developers.
Be specific with findings: include exact ratios, temperatures, timing, and technique details.
Cite your sources.`,
          brief.prompt,
          maxSearches
        );
        return `## ${brief.focus}\n\n${result}`;
      } catch (err) {
        return `## ${brief.focus}\n\n[Research failed: ${err instanceof Error ? err.message : "unknown error"}]`;
      }
    })
  );

  return results.join("\n\n---\n\n");
}

async function callClaudeWithWebSearch(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxSearches: number = 15
): Promise<string> {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxSearches,
      },
    ],
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error (${res.status}): ${text}`);
  }

  const data: ClaudeResponse = await res.json();
  if (data.error) {
    throw new Error(`Claude error: ${data.error.message}`);
  }

  return extractText(data.content);
}
