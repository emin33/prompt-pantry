interface AgentStatus {
  agent: number;
  name: string;
  status: "pending" | "running" | "complete";
  summary?: string;
}

interface Props {
  agents: AgentStatus[];
  error: string | null;
  onRetry?: () => void;
}

const agentDescriptions: Record<number, string> = {
  0: "Checking that your input is a valid dish...",
  1: "Crafting a detailed research brief...",
  2: "Searching the web for renowned recipes and techniques...",
  3: "Synthesizing research into your recipe...",
  4: "Committing and deploying to the site...",
};

export default function GeneratorProgress({ agents, error, onRetry }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl text-charcoal">
        Generating your recipe
      </h3>

      <div className="space-y-3">
        {agents.map((agent, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg border transition-all ${
              agent.status === "running"
                ? "border-terracotta/40 bg-warm-white shadow-sm"
                : agent.status === "complete"
                  ? "border-sage/40 bg-sage-light/50"
                  : "border-warm-gray/15 bg-cream opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0">
                {agent.status === "running" && (
                  <div className="w-5 h-5 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
                )}
                {agent.status === "complete" && (
                  <svg
                    className="w-5 h-5 text-sage"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {agent.status === "pending" && (
                  <div className="w-5 h-5 rounded-full border-2 border-warm-gray/30" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-charcoal">
                    {agent.name}
                  </span>
                  {agent.status === "running" && (
                    <span className="text-xs text-terracotta">
                      {agent.agent === 2 ? "searching..." : agent.agent === 4 ? "deploying..." : "thinking..."}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {agent.status === "complete" && agent.summary
                    ? agent.summary
                    : agentDescriptions[agent.agent]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">
          <p><strong>Error:</strong> {error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 rounded-lg bg-terracotta text-warm-white text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
