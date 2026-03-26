interface Env {
  GITHUB_TOKEN: string;
  DEPLOY_HOOK_URL: string;
}

interface PublishRequest {
  slug: string;
  mdx: string;
  research?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let input: PublishRequest;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate slug
  const slug = input.slug;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
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
      const text = await commitRes.text();
      throw new Error(`GitHub API error (${commitRes.status}): ${text}`);
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
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return Response.json(
      { error: `Failed to publish: ${message}` },
      { status: 500 }
    );
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
