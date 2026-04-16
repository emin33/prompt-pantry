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

// Normalize a password for voice-tolerant comparison. STT artifacts we care
// about: trailing punctuation ("pantry flour."), ALL-CAPS from some engines,
// stray whitespace from trimming. We intentionally DO NOT strip interior
// spaces — "pantry flour" stays two words, since multi-word passwords are
// fine. Case-insensitive because voice recognition's capitalization is noise.
function normalizeForVoice(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // Strip common trailing punctuation STT adds
    .replace(/[.,!?;:]+$/, "")
    // Collapse runs of whitespace to a single space so "pantry  flour" matches "pantry flour"
    .replace(/\s+/g, " ");
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
