// Shared difficulty calibration used by both the prompt engineer and the
// recipe architect, so "Easy" means the same thing at research time and at
// recipe-writing time.

export type RecipeType = "food" | "drink";

const FOOD_CALIBRATION: Record<string, string> = {
  Easy: `Easy means MAXIMALLY LAZY — the simplest possible version that still tastes good. Hard rules: 8 or fewer ingredients where feasible, one cooking vessel where possible, store-bought shortcuts actively encouraged (jarred sauce, rotisserie chicken, pre-chopped produce, slow-cooker dump-and-go). No technique that requires ongoing attention, precision, or timing skill. If a component can be bought instead of made, buy it. Do NOT produce a "somewhat simplified" standard recipe — produce the laziest legitimate version of the dish.`,
  Medium: `Medium means the standard, canonical version of the dish — do not artificially simplify OR complicate. Use proper technique where it genuinely matters and sensible shortcuts where it doesn't. This is the recommended default.`,
  Hard: `Hard means technique-forward. From-scratch components are welcome (stocks, doughs, pastes, sauces), and advanced techniques are encouraged wherever they genuinely improve the result. Assume a confident, patient cook.`,
  Project: `Project means a multi-day or multi-session undertaking. Long ferments, curing, laminated doughs, and multi-component builds are all in scope.`,
};

const DRINK_CALIBRATION: Record<string, string> = {
  Easy: `Easy means the simplest possible build: minimal ingredients, no specialty tools (avoid requiring a shaker, jigger, or strainer if a reasonable version exists without them), and easily batchable. Store-bought mixers and syrups are encouraged.`,
  Medium: `Medium means the classic, properly-made spec of this drink — correct ratios, correct technique (shaken vs stirred, ice choice, dilution), standard bar tools assumed. This is the recommended default.`,
  Hard: `Hard means bartender-level: house-made syrups or infusions welcome, precise dilution and temperature targets, garnish work, and technique explained with the reasoning behind it.`,
  Project: `Project means an ambitious build: infusions, clarified ingredients, fat-washing, or large-format batching for a party.`,
};

export function difficultyDirective(
  difficulty: string,
  recipeType: RecipeType = "food"
): string {
  const table = recipeType === "drink" ? DRINK_CALIBRATION : FOOD_CALIBRATION;
  return table[difficulty] || table.Medium;
}
