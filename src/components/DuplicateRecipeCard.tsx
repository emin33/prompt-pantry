import { useState } from "react";

export interface ExistingRecipe {
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  category: string;
  difficulty: string;
  totalTime: number;
  image?: string;
}

interface Props {
  recipe: ExistingRecipe;
  dish: string;
  onMakeAnyway: (variation: string) => void;
  onBack: () => void;
}

// Same fallback art as RecipeCard.astro when a recipe has no photo.
const categoryEmoji: Record<string, string> = {
  Noodles: "\u{1F35D}",
  Meat: "\u{1F969}",
  Seafood: "\u{1F990}",
  Vegetarian: "\u{1F96C}",
  Soup: "\u{1F372}",
  Dessert: "\u{1F370}",
  Breakfast: "\u{1F373}",
  Sides: "\u{1F957}",
  Sauces: "\u{1F9C8}",
  Bread: "\u{1F35E}",
  Beverage: "\u{1F379}",
};

const difficultyLevels: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3, Project: 3 };

export default function DuplicateRecipeCard({ recipe, dish, onMakeAnyway, onBack }: Props) {
  const [showVariation, setShowVariation] = useState(false);
  const [variation, setVariation] = useState("");
  const flames = difficultyLevels[recipe.difficulty] || 1;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="font-display text-2xl text-charcoal">We already have this one</h3>
        <p className="text-sm text-warm-gray">
          "{dish}" is already in the pantry. Here's the recipe:
        </p>
      </div>

      <a
        href={`/recipes/${recipe.slug}`}
        className="group block bg-warm-white rounded-xl border border-warm-gray/10 hover:border-warm-gray/25 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden no-underline"
      >
        {recipe.image ? (
          <div className="aspect-[16/10] overflow-hidden">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="bg-golden-light/50 flex items-center justify-center py-6">
            <span className="text-5xl opacity-80">{categoryEmoji[recipe.category] || "\u{1F37D}\u{FE0F}"}</span>
          </div>
        )}
        <div className="p-5">
          <h4 className="font-display text-xl text-charcoal group-hover:text-terracotta transition-colors leading-snug mb-2">
            {recipe.title}
          </h4>
          <p className="text-sm text-warm-gray line-clamp-2 mb-4 leading-relaxed">{recipe.description}</p>
          <div className="flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-full bg-terracotta/8 text-terracotta font-medium">
                {recipe.cuisine}
              </span>
              <span className="flex gap-0.5" aria-label={`Difficulty: ${recipe.difficulty}`}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`w-3 h-3 ${i < flames ? "text-golden" : "text-warm-gray/20"}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 2c-1 4-4 6-4 10a4 4 0 008 0c0-4-3-6-4-10z" />
                  </svg>
                ))}
              </span>
            </div>
            <span>{recipe.totalTime} min</span>
          </div>
        </div>
      </a>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={`/recipes/${recipe.slug}`}
          className="flex-1 text-center px-4 py-2.5 rounded-lg bg-terracotta text-white font-medium text-sm hover:bg-terracotta-dark transition-colors no-underline"
        >
          View Recipe
        </a>
        <button
          type="button"
          onClick={() => setShowVariation(!showVariation)}
          aria-expanded={showVariation}
          className="flex-1 px-4 py-2.5 rounded-lg border border-warm-gray/20 text-muted font-medium text-sm hover:border-terracotta/40 hover:text-terracotta transition-colors"
        >
          Make a New One Anyway
        </button>
      </div>

      {showVariation && (
        <div className="p-4 rounded-lg bg-cream border border-warm-gray/15 space-y-3">
          <label htmlFor="duplicate-variation" className="block text-sm text-charcoal font-medium">
            What should be different? <span className="text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="duplicate-variation"
            value={variation}
            onChange={(e) => setVariation(e.target.value)}
            maxLength={500}
            placeholder="e.g. 'No spice, kid-friendly' or 'Weeknight version in under 30 minutes' or 'Use fresh tomatoes instead of canned'"
            className="w-full px-3 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal placeholder:text-muted text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 resize-none"
            rows={3}
          />
          <button
            type="button"
            onClick={() => onMakeAnyway(variation.trim())}
            className="w-full px-4 py-2 rounded-lg bg-terracotta text-white font-medium text-sm hover:bg-terracotta-dark transition-colors"
          >
            Create a New Version
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="block mx-auto text-sm text-muted hover:text-terracotta transition-colors"
      >
        Try a different dish
      </button>
    </div>
  );
}
