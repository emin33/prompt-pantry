import { useState } from "react";

const DEFAULT_COOKWARE = [
  "Stainless steel skillet",
  "Cast iron skillet",
  "Non-stick pan",
  "Dutch oven",
  "Sheet pan",
  "Instant Pot / pressure cooker",
  "Wok",
  "Grill",
  "Stand mixer",
  "Food processor",
  "Immersion blender",
];

export interface GeneratorInput {
  dish: string;
  difficulty: string;
  cookware: string[];
  dietary: string;
  servings: number;
}

interface Props {
  onSubmit: (input: GeneratorInput) => void;
  disabled: boolean;
}

export default function GeneratorForm({ onSubmit, disabled }: Props) {
  const [dish, setDish] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [cookware, setCookware] = useState<string[]>([...DEFAULT_COOKWARE]);
  const [dietary, setDietary] = useState("");
  const [servings, setServings] = useState(4);
  const [showCookware, setShowCookware] = useState(false);

  const toggleCookware = (item: string) => {
    setCookware((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dish.trim()) return;
    onSubmit({ dish: dish.trim(), difficulty, cookware, dietary, servings });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dish name */}
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-2">
          What do you want to cook?
        </label>
        <input
          type="text"
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder="e.g. Pad Thai, Beef Bourguignon, Sourdough Bread..."
          className="w-full px-4 py-3 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta text-base"
          disabled={disabled}
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      {/* Difficulty + Servings row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-charcoal mb-2">
            Difficulty
          </label>
          <div className="flex gap-2">
            {["Easy", "Medium", "Hard"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                disabled={disabled}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  difficulty === d
                    ? "bg-terracotta text-white border-terracotta"
                    : "bg-warm-white text-muted border-warm-gray/20 hover:border-terracotta/40"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-charcoal mb-2">
            Servings
          </label>
          <input
            type="number"
            value={servings}
            onChange={(e) =>
              setServings(Math.max(1, Math.min(20, Number(e.target.value))))
            }
            min={1}
            max={20}
            className="w-full px-4 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta text-base"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Cookware */}
      <div>
        <button
          type="button"
          onClick={() => setShowCookware(!showCookware)}
          className="flex items-center gap-2 text-sm font-semibold text-charcoal hover:text-terracotta transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showCookware ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Available Cookware
          <span className="text-xs text-muted font-normal">
            ({cookware.length}/{DEFAULT_COOKWARE.length} selected)
          </span>
        </button>

        {showCookware && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEFAULT_COOKWARE.map((item) => (
              <label
                key={item}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  cookware.includes(item)
                    ? "bg-sage-light border-sage text-charcoal"
                    : "bg-warm-white border-warm-gray/20 text-muted line-through"
                }`}
              >
                <input
                  type="checkbox"
                  checked={cookware.includes(item)}
                  onChange={() => toggleCookware(item)}
                  disabled={disabled}
                  className="sr-only"
                />
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    cookware.includes(item)
                      ? "bg-sage border-sage text-white"
                      : "border-warm-gray/30"
                  }`}
                >
                  {cookware.includes(item) && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                {item}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Dietary restrictions */}
      <div>
        <label className="block text-sm font-semibold text-charcoal mb-2">
          Dietary restrictions{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={dietary}
          onChange={(e) => setDietary(e.target.value)}
          placeholder="e.g. dairy-free, gluten-free, vegetarian..."
          className="w-full px-4 py-3 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta text-base"
          disabled={disabled}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled || !dish.trim()}
        className="w-full px-6 py-3 rounded-lg bg-terracotta text-white font-semibold text-base hover:bg-terracotta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {disabled ? "Generating..." : "Generate Recipe"}
      </button>
    </form>
  );
}
