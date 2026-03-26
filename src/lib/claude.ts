const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

interface ClaudeResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
  error?: { message: string };
}

export async function callClaudeWithWebSearch(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 10,
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
      "anthropic-version": "2025-04-15",
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

  // Extract all text blocks from the response
  const textParts = data.content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!);

  if (textParts.length === 0) {
    throw new Error("No text response from Claude");
  }

  return textParts.join("\n\n");
}
