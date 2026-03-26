import { useState, useCallback } from "react";
import GeneratorForm, { type GeneratorInput } from "./GeneratorForm";
import GeneratorProgress from "./GeneratorProgress";
import RecipePreview from "./RecipePreview";

type State = "idle" | "generating" | "preview" | "publishing" | "published";

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

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, data);
            } catch {
              // Skip malformed data
            }
            eventType = "";
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

  const handlePublish = useCallback(
    async (password: string) => {
      if (!recipe) return;
      setState("publishing");
      setPublishError(null);

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

        setState("published");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to publish";
        setPublishError(message);
        setState("preview");
      }
    },
    [recipe]
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

      {/* Progress — shown during generation */}
      {state === "generating" && (
        <GeneratorProgress agents={agents} error={error} />
      )}

      {/* Preview — shown after generation */}
      {(state === "preview" ||
        state === "publishing" ||
        state === "published") &&
        recipe && (
          <RecipePreview
            preview={recipe.preview as any}
            slug={recipe.slug}
            mdx={recipe.mdx}
            onPublish={handlePublish}
            onRegenerate={handleRegenerate}
            publishing={state === "publishing"}
            published={state === "published"}
            publishError={publishError}
          />
        )}
    </div>
  );
}
