import { useState, useCallback } from "react";
import GeneratorForm, { type GeneratorInput } from "./GeneratorForm";
import GeneratorProgress from "./GeneratorProgress";
import RecipePreview from "./RecipePreview";

type State = "idle" | "generating" | "preview" | "publishing" | "deploying" | "published";

interface AgentStatus {
  agent: number;
  name: string;
  status: "pending" | "running" | "complete";
  summary?: string;
}

interface RecipeResult {
  slug: string;
  title: string;
  mdx: string;
  research?: string;
  preview: Record<string, unknown>;
}

const initialAgents: AgentStatus[] = [
  { agent: 0, name: "Prompt Engineer", status: "pending" },
  { agent: 1, name: "Research Agent", status: "pending" },
  { agent: 2, name: "Recipe Architect", status: "pending" },
];

export default function RecipeGenerator() {
  const [state, setState] = useState<State>("idle");
  const [agents, setAgents] = useState<AgentStatus[]>(initialAgents);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (input: GeneratorInput) => {
    setState("generating");
    setError(null);
    setRecipe(null);
    setPublishError(null);
    setAgents(initialAgents.map((a) => ({ ...a, status: "pending" })));

    try {
      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newlines
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // keep incomplete event

        for (const event of events) {
          const lines = event.split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr += line.slice(6);
            }
          }

          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              handleSSEEvent(eventType, data);
            } catch {
              // Skip malformed data
            }
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      setState("idle");
    }
  }, []);

  const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case "agent":
        setAgents((prev) =>
          prev.map((a) =>
            a.agent === data.agent
              ? {
                  ...a,
                  status: data.status as AgentStatus["status"],
                  summary: (data.summary as string) || a.summary,
                }
              : a
          )
        );
        break;

      case "recipe":
        setRecipe(data as unknown as RecipeResult);
        setState("preview");
        break;

      case "error":
        setError(data.message as string);
        setState("idle");
        break;

      case "done":
        // Recipe should already be set
        break;
    }
  };

  const pollUntilLive = useCallback(async (slug: string) => {
    const url = `/recipes/${slug}/`;
    const maxAttempts = 30; // 30 * 5s = 2.5 min max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const text = await res.text();
          // Verify the page actually contains the recipe title, not a 404 page or old content
          if (text.includes(slug)) return true;
        }
      } catch {
        // Not live yet
      }
    }
    return false;
  }, []);

  const handlePublish = useCallback(
    async (password: string) => {
      if (!recipe) return;
      setState("publishing");
      setPublishError(null);

      // Add deploy step to agents
      setAgents((prev) => [
        ...prev.map((a) => ({ ...a, status: "complete" as const })),
        { agent: 3, name: "Publishing & Deploying", status: "running" as const, summary: "Committing to repository..." },
      ]);

      try {
        const res = await fetch("/api/publish-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: recipe.slug,
            mdx: recipe.mdx,
            research: recipe.research,
            password,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        // Switch to deploying state and show progress
        setState("deploying");
        setAgents((prev) =>
          prev.map((a) =>
            a.agent === 3
              ? { ...a, summary: "Building & deploying — waiting for site to update..." }
              : a
          )
        );

        // Poll until the recipe page is live
        const isLive = await pollUntilLive(recipe.slug);

        if (isLive) {
          setAgents((prev) =>
            prev.map((a) =>
              a.agent === 3
                ? { ...a, status: "complete" as const, summary: "Recipe is live!" }
                : a
            )
          );
          setState("published");
        } else {
          setAgents((prev) =>
            prev.map((a) =>
              a.agent === 3
                ? { ...a, status: "complete" as const, summary: "Published but deploy may still be in progress. Check back shortly." }
                : a
            )
          );
          setState("published");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to publish";
        setPublishError(message);
        setState("preview");
      }
    },
    [recipe, pollUntilLive]
  );

  const handleRegenerate = () => {
    setState("idle");
    setRecipe(null);
    setError(null);
    setPublishError(null);
    setAgents(initialAgents.map((a) => ({ ...a, status: "pending" })));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Form — shown in idle state */}
      {state === "idle" && (
        <GeneratorForm
          onSubmit={handleGenerate}
          disabled={false}
        />
      )}

      {/* Progress — shown during generation and deploying */}
      {(state === "generating" || state === "deploying") && (
        <GeneratorProgress agents={agents} error={error} />
      )}

      {/* Published — show success with link */}
      {state === "published" && recipe && (
        <div className="text-center py-12 space-y-4">
          <svg className="w-16 h-16 text-sage mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3 className="font-display text-2xl text-charcoal">Recipe Published!</h3>
          <p className="text-warm-gray">{recipe.title} is now live on the site.</p>
          <div className="flex justify-center gap-4">
            <a
              href={`/recipes/${recipe.slug}`}
              className="px-6 py-2.5 bg-terracotta text-warm-white rounded-lg hover:bg-terracotta/90 transition-colors no-underline"
            >
              View Recipe
            </a>
            <button
              onClick={handleRegenerate}
              className="px-6 py-2.5 border border-warm-gray/20 text-charcoal rounded-lg hover:bg-cream transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}

      {/* Preview — shown after generation, before publish */}
      {(state === "preview" || state === "publishing") &&
        recipe && (
          <RecipePreview
            preview={recipe.preview as any}
            slug={recipe.slug}
            mdx={recipe.mdx}
            onPublish={handlePublish}
            onRegenerate={handleRegenerate}
            publishing={state === "publishing"}
            published={false}
            publishError={publishError}
          />
        )}
    </div>
  );
}
