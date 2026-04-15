/**
 * Runtime config endpoint for the Chef Carl widget.
 *
 * Returns the agent URL from the Pages Function's env binding, which Cloudflare
 * populates at runtime from the dashboard's Variables and Secrets. This works
 * even when static build-time env var inlining doesn't — Workers runtime env
 * bindings are a different code path than Astro's `import.meta.env.PUBLIC_*`
 * substitution.
 *
 * Bonus: changing the tunnel URL no longer requires a site rebuild. Just
 * update the env var and the next widget page-load sees the new URL.
 */

interface Env {
  PUBLIC_CARL_AGENT_URL?: string;
}

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  return new Response(
    JSON.stringify({
      agentUrl: env.PUBLIC_CARL_AGENT_URL || "",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
};
