// Public catalog endpoint consumed by the Chef Carl agent at cold start.
//
// Emits every published recipe and technique with its full frontmatter
// and raw MDX body. The agent re-parses the body for StepTimer tags and
// derived fields; no rendering happens here.
//
// Prerendered at build time so this is just a static file on Cloudflare
// Pages. Every site deploy refreshes it; Carl's Lambda cold start picks
// up the new content on its next warm-up without any agent redeploy.
//
// URL: https://promptpantry.org/api/catalog.json

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

export const GET: APIRoute = async () => {
  const [recipes, techniques] = await Promise.all([
    getCollection("recipes", ({ data }) => data.published !== false),
    getCollection("techniques", ({ data }) => data.published !== false),
  ]);

  const payload = {
    // ISO timestamp of when this snapshot was built (build-time, not
    // request-time — the file is static). The agent logs this so we can
    // tell at a glance how stale its cached catalog is.
    generated_at: new Date().toISOString(),
    recipes: recipes.map((r) => ({
      id: r.id,
      data: r.data,
      body: r.body ?? "",
    })),
    techniques: techniques.map((t) => ({
      id: t.id,
      data: t.data,
      body: t.body ?? "",
    })),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 5 minute CDN cache. Agent fetches at cold start (roughly every
      // 15 min of idle on Lambda) and explicitly refreshes periodically.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      // Allow Lambda (any origin) to fetch this. Catalog is public data.
      "Access-Control-Allow-Origin": "*",
    },
  });
};
