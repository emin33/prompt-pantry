import { verifyJWT } from "../lib/jwt";

interface Env {
  GITHUB_TOKEN: string;
  DEPLOY_HOOK_URL: string;
  JWT_SECRET: string;
  SIGNALWIRE_SPACE_NAME?: string;
  SIGNALWIRE_PROJECT_ID?: string;
  SIGNALWIRE_TOKEN?: string;
}

interface PublishRequest {
  slug: string;
  mdx: string;
  research?: string;
}

const ALLOWED_ORIGIN = "https://promptpantry.org";
const GITHUB_REPO = "emin33/prompt-pantry";

async function uploadResearchToDatasphere(
  env: Env,
  slug: string,
): Promise<void> {
  const space = env.SIGNALWIRE_SPACE_NAME;
  const projectId = env.SIGNALWIRE_PROJECT_ID;
  const token = env.SIGNALWIRE_TOKEN;
  if (!space || !projectId || !token) {
    console.warn(
      `[datasphere] skipping upload for ${slug}: SignalWire env vars not set`,
    );
    return;
  }
  // Use raw GitHub URL — available the instant the commit lands, so we
  // don't have to wait for the Cloudflare Pages rebuild. The deployed
  // promptpantry.org/research/{slug}.md is what the backfill CLI uses,
  // but it isn't live yet at this point in the flow.
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/master/public/research/${slug}.md`;
  const payload = {
    url,
    tags: ["research", "recipe", slug],
    chunking_strategy: "paragraph",
  };
  const auth = btoa(`${projectId}:${token}`);
  try {
    const res = await fetch(`https://${space}/api/datasphere/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[datasphere] upload failed for ${slug}: ${res.status} ${(await res.text()).slice(0, 300)}`,
      );
      return;
    }
    const data = await res.json() as { id?: string; status?: string };
    console.log(
      `[datasphere] uploaded ${slug}: id=${data.id} status=${data.status}`,
    );
  } catch (err) {
    console.error(
      `[datasphere] upload error for ${slug}: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

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

  // Authenticate via JWT
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Missing authentication token" }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
    });
  }
  const jwtResult = await verifyJWT(token, env.JWT_SECRET);
  if (!jwtResult.valid) {
    return Response.json({ error: jwtResult.error }, {
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
      const researchPath = `public/research/${slug}.md`;
      const researchContent = btoa(
        unescape(encodeURIComponent(`# Research: ${slug}\n\n${input.research}`))
      );
      const researchRes = await fetch(
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

      // Fire-and-forget Datasphere upload once the research is in GitHub.
      // Uses raw.githubusercontent.com so we don't have to wait for the
      // Cloudflare rebuild. context.waitUntil keeps the function alive
      // past the response without blocking the user.
      if (researchRes.ok) {
        context.waitUntil(uploadResearchToDatasphere(env, slug));
      } else {
        console.error(
          `[datasphere] skipping upload for ${slug}: research commit failed (${researchRes.status})`,
        );
      }
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
