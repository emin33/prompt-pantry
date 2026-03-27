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

  if (!body.password || !timingSafeEqual(body.password, env.PUBLISH_PASSWORD)) {
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
