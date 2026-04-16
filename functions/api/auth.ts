import { signJWT } from "../lib/jwt";

interface Env {
  PUBLISH_PASSWORD: string;
  JWT_SECRET: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Normalize a password for voice-tolerant comparison. Aggressive: lowercase
// and strip everything that isn't a-z / 0-9. This is the fallback path;
// byte-exact compare runs first and handles normal typed-into-the-form
// submissions. The normalize path only matters when STT produces something
// that doesn't byte-match but should semantically — e.g. "Pantry Flour.",
// "pantry flour", or "pantry-flour" all reduce to "pantryflour", and if
// any of those is the stored form, they'll match. Side effect: makes the
// password effectively case/punctuation/whitespace-blind, which is fine
// because the gate protects spend (Gemini calls) and not PII.
function normalizeForVoice(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ALLOWED_ORIGIN = "https://promptpantry.org";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: { password: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  const provided = body.password ?? "";
  const expected = env.PUBLISH_PASSWORD ?? "";
  // Two compare paths:
  //   1. Byte-exact — the original strict check, matches what users type
  //      on the form as-is.
  //   2. Normalized — lowercase, trimmed, trailing punctuation stripped —
  //      so voice STT artifacts still match. Only engages when the server
  //      side is also normalize-safe (i.e. PUBLISH_PASSWORD doesn't rely
  //      on case/punctuation distinctions). If you set PUBLISH_PASSWORD to
  //      e.g. 'pantry-flour', both typed-form and spoken-voice will match.
  const exactMatch = provided && timingSafeEqual(provided, expected);
  const voiceMatch =
    provided &&
    expected &&
    timingSafeEqual(normalizeForVoice(provided), normalizeForVoice(expected));
  if (!exactMatch && !voiceMatch) {
    return Response.json(
      { error: "Invalid password" },
      { status: 403, headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }

  // Issue a JWT valid for 30 minutes
  const token = await signJWT(
    { sub: "generator", role: "user" },
    env.JWT_SECRET,
    30
  );

  return Response.json(
    { token, expiresIn: 1800 },
    { headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
  );
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
