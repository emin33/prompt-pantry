interface Env {
  GEMINI_API_KEY: string;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  recipeContext: string;
}

const GEMINI_STREAM_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

// Simple in-memory rate limiting
const rateLimits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const max = 10;

  const timestamps = rateLimits.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < window);
  rateLimits.set(ip, recent);

  if (recent.length >= max) return true;
  recent.push(now);
  return false;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, recipeContext } = (await request.json()) as ChatRequest;

  if (!messages || !recipeContext) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are a friendly, concise cooking assistant helping someone who is currently looking at a recipe on Prompt Pantry.

THE RECIPE (this is the primary source — your advice should be based on what this recipe says):
${recipeContext}

IMPORTANT: The recipe above is the finalized, tested version that the user is cooking from. It was synthesized from extensive research and represents the best approach chosen by the recipe author. If research notes are also included below, they provide additional background context — alternative techniques, source comparisons, and deeper explanations — but the recipe itself takes priority. Use the research to give richer answers when relevant, but never contradict the recipe's specific choices unless the user explicitly asks about alternatives.

Guidelines:
- Answer questions about this recipe concisely (2-4 sentences usually)
- Help with substitutions, timing, technique questions, and troubleshooting
- If the research notes mention why a particular choice was made, share that insight — it helps the user understand the recipe better
- If they ask about scaling, reference the ingredient amounts in the recipe
- If asked about something completely unrelated to cooking, politely redirect: "I'm here to help with cooking questions! What can I help you with for this recipe?"
- Be warm and encouraging — they might be a beginner
- Use plain language, not chef jargon unless they used it first`;

  const geminiMessages = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: geminiMessages,
  };

  const res = await fetch(`${GEMINI_STREAM_URL}&key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini error (${res.status}): ${errText}`);
    return new Response(JSON.stringify({ error: "AI service error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Forward the SSE stream from Gemini
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body!.getReader();

  (async () => {
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              await writer.write(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          } catch {}
        }
      }
    } finally {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
