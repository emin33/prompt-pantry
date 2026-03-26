import { useState } from "react";

interface Step {
  title: string;
  body: string;
  timerMinutes: number | null;
  timerLabel: string | null;
}

interface Note {
  title: string;
  content: string;
}

interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
}

interface IngredientGroup {
  name: string;
  items: IngredientItem[];
}

interface PreviewData {
  title: string;
  description: string;
  cuisine: string;
  category: string;
  difficulty: string;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  overview: string;
  steps: Step[];
  notes: Note[];
  ingredients: IngredientGroup[];
  equipment: string[];
  tags: string[];
}

interface Props {
  preview: PreviewData;
  slug: string;
  mdx: string;
  onPublish: (password: string) => void;
  onRegenerate: () => void;
  publishing: boolean;
  published: boolean;
  publishError: string | null;
}

function formatAmount(amount: number): string {
  const fractions: Record<string, string> = {
    "0.125": "1/8",
    "0.25": "1/4",
    "0.333": "1/3",
    "0.5": "1/2",
    "0.667": "2/3",
    "0.75": "3/4",
  };

  if (Number.isInteger(amount)) return amount.toString();

  const whole = Math.floor(amount);
  const frac = amount - whole;
  const fracStr =
    fractions[frac.toFixed(3)] || fractions[frac.toFixed(2)] || frac.toFixed(1);

  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

export default function RecipePreview({
  preview,
  slug,
  mdx,
  onPublish,
  onRegenerate,
  publishing,
  published,
  publishError,
}: Props) {
  const [password, setPassword] = useState("");
  const [showMdx, setShowMdx] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-warm-gray/15 pb-6">
        <h2 className="font-display text-3xl text-charcoal mb-2">
          {preview.title}
        </h2>
        <p className="text-warm-gray leading-relaxed">{preview.description}</p>

        {/* Metadata pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="px-3 py-1 rounded-full bg-sage-light text-sage-dark text-xs font-medium">
            {preview.cuisine}
          </span>
          <span className="px-3 py-1 rounded-full bg-golden-light text-warm-gray text-xs font-medium">
            {preview.difficulty}
          </span>
          <span className="px-3 py-1 rounded-full bg-cream text-muted text-xs font-medium border border-warm-gray/15">
            {preview.totalTime} min
          </span>
          <span className="px-3 py-1 rounded-full bg-cream text-muted text-xs font-medium border border-warm-gray/15">
            {preview.servings} servings
          </span>
        </div>
      </div>

      {/* Overview */}
      <div>
        <h3 className="font-display text-xl text-charcoal mb-2">Overview</h3>
        <p className="text-warm-gray leading-relaxed">{preview.overview}</p>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="font-display text-xl text-charcoal mb-3">
          Ingredients
        </h3>
        <div className="space-y-4">
          {preview.ingredients.map((group, i) => (
            <div key={i}>
              <h4 className="text-sm font-semibold text-terracotta mb-2">
                {group.name}
              </h4>
              <ul className="space-y-1">
                {group.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex gap-2 text-sm text-warm-gray py-1 border-b border-warm-gray/10"
                  >
                    <span className="font-medium text-charcoal whitespace-nowrap">
                      {formatAmount(item.amount)}
                      {item.unit ? ` ${item.unit}` : ""}
                    </span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div>
        <h3 className="font-display text-xl text-charcoal mb-3">Steps</h3>
        <div className="space-y-4">
          {preview.steps.map((step, i) => (
            <div
              key={i}
              className={`p-5 rounded-xl border border-warm-gray/10 ${i % 2 === 0 ? "bg-warm-white" : "bg-cream"}`}
            >
              <h4 className="font-display text-lg text-charcoal mb-2">
                {i + 1}. {step.title}
              </h4>
              <p className="text-warm-gray leading-relaxed text-sm">
                {step.body}
              </p>
              {step.timerMinutes && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terracotta/10 text-terracotta text-xs font-medium">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {step.timerMinutes} min — {step.timerLabel}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {preview.notes.length > 0 && (
        <div>
          <h3 className="font-display text-xl text-charcoal mb-3">Notes</h3>
          <ul className="space-y-2">
            {preview.notes.map((note, i) => (
              <li
                key={i}
                className="p-4 rounded-lg bg-warm-white border border-warm-gray/10 text-sm text-warm-gray"
              >
                <strong className="text-terracotta">{note.title}:</strong>{" "}
                {note.content}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw MDX toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowMdx(!showMdx)}
          className="text-xs text-muted hover:text-charcoal transition-colors"
        >
          {showMdx ? "Hide" : "Show"} raw MDX
        </button>
        {showMdx && (
          <pre className="mt-2 p-4 rounded-lg bg-charcoal text-cream text-xs overflow-x-auto max-h-96 overflow-y-auto">
            {mdx}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-warm-gray/15 pt-6 space-y-4">
        {published ? (
          <div className="p-4 rounded-lg bg-sage-light border border-sage text-sage-dark text-sm">
            Recipe published! It will be live at{" "}
            <a
              href={`/recipes/${slug}`}
              className="font-semibold underline"
            >
              /recipes/{slug}
            </a>{" "}
            in about 30 seconds after the site rebuilds.
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Publish password"
                className="flex-1 px-4 py-2.5 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage text-sm"
                disabled={publishing}
              />
              <button
                type="button"
                onClick={() => onPublish(password)}
                disabled={publishing || !password}
                className="px-6 py-2.5 rounded-lg bg-sage text-white font-semibold text-sm hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? "Publishing..." : "Publish to Site"}
              </button>
            </div>

            <button
              type="button"
              onClick={onRegenerate}
              disabled={publishing}
              className="w-full px-4 py-2.5 rounded-lg border border-warm-gray/20 text-muted font-medium text-sm hover:border-terracotta/40 hover:text-terracotta transition-colors disabled:opacity-50"
            >
              Regenerate
            </button>
          </>
        )}

        {publishError && (
          <div className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">
            {publishError}
          </div>
        )}
      </div>
    </div>
  );
}
