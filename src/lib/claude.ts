const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

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

export async function callClaudeWithWebSearch(
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
    console.error(`Claude API error (${res.status}): ${await res.text()}`);
    throw new Error(`Claude API error (${res.status})`);
  }

  const data: ClaudeResponse = await res.json();
  if (data.error) {
    throw new Error(`Claude error: ${data.error.message}`);
  }

  return extractText(data.content);
}

/**
 * Run multiple parallel research agents, each focused on a different dimension.
 * Each agent gets its own web search budget for independent searching.
 */
export async function callClaudeMultiAgentResearch(
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
