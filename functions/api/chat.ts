interface Env {
  GROQ_API_KEY: string;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  recipeContext: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

  const systemPrompt = `You are a friendly, knowledgeable cooking assistant for Prompt Pantry. You have deep expertise on the recipe below because you've studied both the recipe and the detailed research behind it.

RECIPE AND RESEARCH:
${recipeContext}

You know this recipe inside and out — the ingredients, the techniques, the science, the sourcing, the common mistakes, and the reasoning behind every choice. Draw freely from all of this knowledge when answering. Don't preface answers with "based on the research" or "according to the recipe" — just answer naturally as someone who deeply understands this dish.

The recipe represents the finalized approach, so if someone asks "should I do X?" and the recipe chose differently, explain why the recipe went that direction while acknowledging the alternative.

Guidelines:
- Keep responses SHORT — 2-3 sentences max. This is a chat, not an essay.
- If they ask about a list (common mistakes, substitutions, etc.), give the top 2-3 most important ones and offer "Want me to go into more detail?" rather than listing everything
- Share specific details — exact temperatures, timings, ratios — when relevant
- Help with substitutions, timing, technique questions, and troubleshooting
- If they ask about scaling, reference the ingredient amounts in the recipe
- If asked about something completely unrelated to cooking, politely redirect: "I'm here to help with cooking questions! What can I help you with for this recipe?"
- Be warm and encouraging — they might be a beginner
- Use plain language, not chef jargon unless they used it first
- Never use bullet points or numbered lists — write in natural conversational sentences`;

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: openaiMessages,
      max_tokens: 200,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Groq error (${res.status}): ${errText}`);
    return new Response(JSON.stringify({ error: "AI service error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Forward the SSE stream from Groq (OpenAI-compatible format)
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
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);
            const text = data.choices?.[0]?.delta?.content;
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
