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

const generationAgents: AgentStatus[] = [
  { agent: 0, name: "Validating Input", status: "pending" },
  { agent: 1, name: "Prompt Engineer", status: "pending" },
  { agent: 2, name: "Research Team", status: "pending" },
  { agent: 3, name: "Recipe Architect", status: "pending" },
];

export default function RecipeGenerator() {
  const [state, setState] = useState<State>("idle");
  const [agents, setAgents] = useState<AgentStatus[]>(generationAgents);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GeneratorInput | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  const pollUntilLive = useCallback(async (slug: string, title: string) => {
    const url = `/recipes/${slug}/`;
    const maxAttempts = 30;
    // Wait at least 15 seconds before first check to let the build start
    await new Promise((r) => setTimeout(r, 15000));
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
        if (res.ok) {
          const text = await res.text();
          // Check for the recipe title in the page content to confirm it's the real page
          if (text.includes(title) && text.includes("recipe-prose")) return true;
        }
      } catch {
        // Not live yet
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  }, []);

  const handleGenerate = useCallback(async (input: GeneratorInput) => {
    setState("generating");
    setError(null);
    setRecipe(null);
    setPublishError(null);
    setLastInput(input);
    setAgents(generationAgents.map((a) => ({ ...a, status: "pending" })));

    let receivedRecipe: RecipeResult | null = null;

    const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case "agent":
          setAgents((prev) =>
            prev.map((a) =>
              a.agent === data.agent
                ? {
                    ...a,
                    name: (data.name as string) || a.name,
                    status: data.status as AgentStatus["status"],
                    summary: (data.summary as string) || a.summary,
                  }
                : a
            )
          );
          break;

        case "recipe":
          receivedRecipe = data as unknown as RecipeResult;
          setRecipe(receivedRecipe);
          break;

        case "error":
          setError(data.message as string);
          // Stay on generating view so user can see the error alongside progress
          break;

        case "done":
          break;
      }
    };

    try {
      // Get JWT token if we don't have one
      let token = jwtToken;
      if (!token) {
        const authRes = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: input.password }),
        });
        if (!authRes.ok) {
          const authErr = await authRes.json().catch(() => ({ error: "Authentication failed" }));
          throw new Error((authErr as { error: string }).error || "Invalid access code");
        }
        const authData = await authRes.json() as { token: string };
        token = authData.token;
        setJwtToken(token);
      }

      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(input),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        // Try to parse as JSON for structured errors
        try {
          const errData = JSON.parse(text);
          throw new Error(errData.error || `HTTP ${res.status}`);
        } catch (e) {
          if (e instanceof Error && e.message !== text) throw e;
          throw new Error(text || `HTTP ${res.status}`);
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

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

      // Show preview after generation
      if (receivedRecipe) {
        setState("preview");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
      // Stay on generating view so user can see the error
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!recipe) return;
    setState("publishing");
    setPublishError(null);

    setAgents([
      ...generationAgents.map((a) => ({ ...a, status: "complete" as const })),
      { agent: 4, name: "Publishing & Deploying", status: "running" as const, summary: "Committing to repository..." },
    ]);

    try {
      const res = await fetch("/api/publish-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwtToken}` },
        body: JSON.stringify({
          slug: recipe.slug,
          mdx: recipe.mdx,
          research: recipe.research,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setState("deploying");
      setAgents((prev) =>
        prev.map((a) =>
          a.agent === 4
            ? { ...a, summary: "Building & deploying — waiting for site to update..." }
            : a
        )
      );

      const isLive = await pollUntilLive(recipe.slug, recipe.title);

      setAgents((prev) =>
        prev.map((a) =>
          a.agent === 4
            ? {
                ...a,
                status: "complete" as const,
                summary: isLive
                  ? "Recipe is live!"
                  : "Published but deploy may still be in progress.",
              }
            : a
        )
      );
      setState("published");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to publish";
      setPublishError(message);
      setState("preview");
    }
  }, [recipe, lastInput, pollUntilLive]);

  const handleRegenerate = () => {
    setState("idle");
    setRecipe(null);
    setError(null);
    setPublishError(null);
    setAgents(generationAgents.map((a) => ({ ...a, status: "pending" })));
  };

  const handleRegenerateWithFeedback = (feedback: string) => {
    if (!lastInput) return;
    handleGenerate({ ...lastInput, feedback });
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

      {/* Progress — shown during generation, publishing, and deploying */}
      {(state === "generating" || state === "publishing" || state === "deploying") && (
        <GeneratorProgress agents={agents} error={error} onRetry={handleRegenerate} />
      )}

      {/* Preview — shown after generation, before publish */}
      {state === "preview" && recipe && (
        <RecipePreview
          preview={recipe.preview as any}
          slug={recipe.slug}
          mdx={recipe.mdx}
          onPublish={handlePublish}
          onRegenerate={handleRegenerate}
          onRegenerateWithFeedback={handleRegenerateWithFeedback}
          publishing={false}
          published={false}
          publishError={publishError}
        />
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
    </div>
  );
}
