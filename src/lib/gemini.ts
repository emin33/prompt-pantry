const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  jsonMode = false
): Promise<string> {
  const body: Record<string, unknown> = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
  };

  if (jsonMode) {
    body.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      lastError = "Rate limited by Gemini API";
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      console.error(`Gemini API error (${res.status}): ${await res.text()}`);
      throw new Error(`Gemini API error (${res.status})`);
    }

    const data: GeminiResponse = await res.json();
    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return text;
  }

  throw new Error(lastError || "Gemini API failed after retries");
}
