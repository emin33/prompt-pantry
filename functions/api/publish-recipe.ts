interface Env {
  GITHUB_TOKEN: string;
  DEPLOY_HOOK_URL: string;
  PUBLISH_PASSWORD: string;
}

interface PublishRequest {
  slug: string;
  mdx: string;
  research?: string;
  password: string;
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

  let input: PublishRequest;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, {
      status: 400,
      headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
    });
  }

  // Authenticate via header
  const pagePassword = request.headers.get("X-API-Secret");
  if (!pagePassword || !timingSafeEqual(pagePassword, env.PUBLISH_PASSWORD)) {
    return Response.json({ error: "Unauthorized" }, {
      status: 403,
      headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
    });
  }

  // Validate slug (max 100 chars, lowercase alphanumeric + hyphens only)
  const slug = input.slug;
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 100) {
    return Response.json(
      { error: "Invalid slug — must be lowercase alphanumeric with hyphens" },
      { status: 400 }
    );
  }

  if (!input.mdx) {
    return Response.json({ error: "MDX content is required" }, { status: 400 });
  }

  const repo = "emin33/prompt-pantry";
  const path = `src/content/recipes/${slug}.mdx`;

  try {
    // Check if file already exists
    const checkRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "prompt-pantry-generator",
        },
      }
    );

    if (checkRes.ok) {
      return Response.json(
        {
          error: `A recipe with slug "${slug}" already exists. Try a different name.`,
        },
        { status: 409 }
      );
    }

    // Commit the file to GitHub
    const content = btoa(unescape(encodeURIComponent(input.mdx)));
    const commitRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "prompt-pantry-generator",
        },
        body: JSON.stringify({
          message: `Add recipe: ${slug}`,
          content,
          branch: "master",
        }),
      }
    );

    if (!commitRes.ok) {
      console.error(`GitHub API error (${commitRes.status}): ${await commitRes.text()}`);
      throw new Error("Failed to commit recipe to repository");
    }

    // Commit research report if provided
    if (input.research) {
      const researchPath = `research/${slug}.md`;
      const researchContent = btoa(
        unescape(encodeURIComponent(`# Research: ${slug}\n\n${input.research}`))
      );
      await fetch(
        `https://api.github.com/repos/${repo}/contents/${researchPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "prompt-pantry-generator",
          },
          body: JSON.stringify({
            message: `Add research: ${slug}`,
            content: researchContent,
            branch: "master",
          }),
        }
      );
    }

    // Trigger Cloudflare Pages rebuild
    if (env.DEPLOY_HOOK_URL) {
      await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    }

    return Response.json({
      success: true,
      url: `/recipes/${slug}`,
      message:
        "Recipe published! It will be live in about 30 seconds after the site rebuilds.",
    }, {
      headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
    });
  } catch (err) {
    console.error("Publish error:", err);
    return Response.json(
      { error: "Failed to publish recipe. Please try again." },
      { status: 500, headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Secret",
    },
  });
};
