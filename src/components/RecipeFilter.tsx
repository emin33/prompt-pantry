import { useState, useMemo } from "react";

interface RecipeData {
  title: string;
  slug: string;
  description: string;
  cuisine: string;
  category: string;
  difficulty: string;
  totalTime: number;
  tags: string[];
  publishedDate: string;
}

interface Props {
  recipes: RecipeData[];
}

type SortOption = "newest" | "time" | "difficulty";

const difficultyOrder: Record<string, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Project: 4,
};

const difficultyLevels: Record<string, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Project: 3,
};

export default function RecipeFilter({ recipes }: Props) {
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const cuisines = useMemo(
    () => [...new Set(recipes.map((r) => r.cuisine))].sort(),
    [recipes]
  );
  const categories = useMemo(
    () => [...new Set(recipes.map((r) => r.category))].sort(),
    [recipes]
  );

  const filtered = useMemo(() => {
    let result = recipes;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q))
      );
    }
    if (cuisine) result = result.filter((r) => r.cuisine === cuisine);
    if (category) result = result.filter((r) => r.category === category);
    if (difficulty) result = result.filter((r) => r.difficulty === difficulty);

    result = [...result].sort((a, b) => {
      if (sort === "newest")
        return b.publishedDate.localeCompare(a.publishedDate);
      if (sort === "time") return a.totalTime - b.totalTime;
      return (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0);
    });

    return result;
  }, [recipes, search, cuisine, category, difficulty, sort]);

  const hasFilters = search || cuisine || category || difficulty;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="search"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-charcoal placeholder:text-warm-gray/50 focus:outline-none focus:border-terracotta/40 transition-colors"
        />

        <select
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
        >
          <option value="">All Cuisines</option>
          {cuisines.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="px-3 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
        >
          <option value="">All Difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Project">Project</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-2 rounded-lg border border-warm-gray/20 bg-warm-white text-sm text-charcoal focus:outline-none focus:border-terracotta/40"
        >
          <option value="newest">Newest</option>
          <option value="time">Cook Time</option>
          <option value="difficulty">Difficulty</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setCuisine("");
              setCategory("");
              setDifficulty("");
            }}
            className="text-xs text-warm-gray hover:text-terracotta transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-center text-warm-gray py-12">
          No recipes match your filters. Try broadening your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <a
              key={r.slug}
              href={`/recipes/${r.slug}`}
              className="group block bg-warm-white rounded-xl border border-warm-gray/10 hover:border-warm-gray/25 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden no-underline"
            >
              <div className="h-1.5 bg-golden-light border-b border-golden/20" />
              <div className="p-5">
                <h3 className="font-display text-xl text-charcoal group-hover:text-terracotta transition-colors leading-snug mb-2">
                  {r.title}
                </h3>
                <p className="text-sm text-warm-gray line-clamp-2 mb-4">
                  {r.description}
                </p>
                <div className="flex items-center justify-between text-xs text-warm-gray">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full bg-terracotta/8 text-terracotta font-medium">
                      {r.cuisine}
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3 h-3 ${
                            i < (difficultyLevels[r.difficulty] || 1)
                              ? "text-golden"
                              : "text-warm-gray/20"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2c-1 4-4 6-4 10a4 4 0 008 0c0-4-3-6-4-10z" />
                        </svg>
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12,6 12,12 16,14" />
                    </svg>
                    {r.totalTime} min
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
