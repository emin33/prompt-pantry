import { toSlug } from "./slug";

interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
}

interface IngredientGroup {
  name: string;
  items: IngredientItem[];
}

interface RecipeStep {
  title: string;
  body: string;
  timerMinutes: number | null;
  timerLabel: string | null;
}

interface RecipeNote {
  title: string;
  content: string;
}

export interface RecipeJSON {
  title: string;
  description: string;
  cuisine: string;
  category: string;
  prepTime: number;
  cookTime: number;
  restTime: number;
  servings: number;
  ingredients: IngredientGroup[];
  tags: string[];
  equipment: string[];
  overview: string;
  steps: RecipeStep[];
  notes: RecipeNote[];
}

const VALID_CATEGORIES = [
  "Pasta",
  "Meat",
  "Seafood",
  "Vegetarian",
  "Soup",
  "Dessert",
  "Breakfast",
  "Sides",
  "Sauces",
  "Bread",
];

const VALID_DIFFICULTIES = ["Easy", "Medium", "Hard", "Project"];

function escapeYaml(str: string): string {
  // If it contains special chars, wrap in double quotes and escape internal quotes
  if (/[:#\[\]{}&*!|>'"`,@%]/.test(str) || str.includes("\n")) {
    return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${str}"`;
}

function validateCategory(category: string): string {
  const match = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === category.toLowerCase()
  );
  return match || "Meat"; // fallback
}

function validateDifficulty(difficulty: string): string {
  const match = VALID_DIFFICULTIES.find(
    (d) => d.toLowerCase() === difficulty.toLowerCase()
  );
  return match || "Medium"; // fallback
}

export function buildMDX(recipe: RecipeJSON, difficulty: string): string {
  const slug = toSlug(recipe.title);
  const category = validateCategory(recipe.category);
  const validDifficulty = validateDifficulty(difficulty);
  const totalTime = recipe.prepTime + recipe.cookTime + (recipe.restTime || 0);
  const today = new Date().toISOString().split("T")[0];

  // Build YAML frontmatter
  const lines: string[] = ["---"];
  lines.push(`title: ${escapeYaml(recipe.title)}`);
  lines.push(`slug: ${escapeYaml(slug)}`);
  lines.push(`description: ${escapeYaml(recipe.description)}`);
  lines.push(`cuisine: ${escapeYaml(recipe.cuisine)}`);
  lines.push(`category: ${escapeYaml(category)}`);
  lines.push(`difficulty: ${escapeYaml(validDifficulty)}`);
  lines.push(`prepTime: ${recipe.prepTime}`);
  lines.push(`cookTime: ${recipe.cookTime}`);
  lines.push(`restTime: ${recipe.restTime || 0}`);
  lines.push(`totalTime: ${totalTime}`);
  lines.push(`servings: ${recipe.servings}`);

  // Ingredients
  lines.push("ingredients:");
  for (const group of recipe.ingredients) {
    lines.push(`  - name: ${escapeYaml(group.name)}`);
    lines.push("    items:");
    for (const item of group.items) {
      lines.push(
        `      - { name: ${escapeYaml(item.name)}, amount: ${item.amount}, unit: ${escapeYaml(item.unit)} }`
      );
    }
  }

  // Tags
  lines.push(
    `tags: [${recipe.tags.map((t) => escapeYaml(t.toLowerCase())).join(", ")}]`
  );

  // Equipment
  if (recipe.equipment.length > 0) {
    lines.push(
      `equipment: [${recipe.equipment.map((e) => escapeYaml(e)).join(", ")}]`
    );
  }

  lines.push("techniques: []");
  lines.push("published: true");
  lines.push(`publishedDate: ${escapeYaml(today)}`);
  lines.push("---");
  lines.push("");

  // Imports
  const hasTimers = recipe.steps.some((s) => s.timerMinutes);
  if (hasTimers) {
    lines.push("import StepTimer from '../../components/StepTimer';");
    lines.push("");
  }

  // Overview
  lines.push("## Overview");
  lines.push("");
  lines.push(recipe.overview);
  lines.push("");

  // Steps
  lines.push("## Steps");
  lines.push("");
  recipe.steps.forEach((step, i) => {
    lines.push(`### ${i + 1}. ${step.title}`);
    lines.push("");
    lines.push(step.body);
    lines.push("");
    if (step.timerMinutes && step.timerLabel) {
      lines.push(
        `<StepTimer client:load minutes={${step.timerMinutes}} label="${step.timerLabel.replace(/"/g, '\\"')}" />`
      );
      lines.push("");
    }
  });

  // Notes
  if (recipe.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    for (const note of recipe.notes) {
      lines.push(`- **${note.title}**: ${note.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function parseRecipeJSON(text: string): RecipeJSON {
  // Try to extract JSON from the response — handle markdown code blocks
  let jsonStr = text.trim();

  // Strip markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  // Validate required fields exist
  const required = [
    "title",
    "description",
    "cuisine",
    "category",
    "prepTime",
    "cookTime",
    "servings",
    "ingredients",
    "overview",
    "steps",
  ];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Defaults
  parsed.restTime = parsed.restTime || 0;
  parsed.tags = parsed.tags || [];
  parsed.equipment = parsed.equipment || [];
  parsed.notes = parsed.notes || [];

  return parsed as RecipeJSON;
}
