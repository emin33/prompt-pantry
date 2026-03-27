import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const ingredientItem = z.object({
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
});

const ingredientGroup = z.object({
  name: z.string(),
  items: z.array(ingredientItem),
});

const recipes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/recipes" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    cuisine: z.string(),
    category: z.enum([
      "Noodles",
      "Meat",
      "Seafood",
      "Vegetarian",
      "Soup",
      "Dessert",
      "Breakfast",
      "Sides",
      "Sauces",
      "Bread",
    ]),
    difficulty: z.enum(["Easy", "Medium", "Hard", "Project"]),
    prepTime: z.number(),
    cookTime: z.number(),
    restTime: z.number().optional().default(0),
    totalTime: z.number(),
    servings: z.number(),
    ingredients: z.array(ingredientGroup),
    image: z.string().optional(),
    tags: z.array(z.string()),
    techniques: z.array(z.string()).optional().default([]),
    equipment: z.array(z.string()).optional().default([]),
    source: z.enum(["curated", "community"]).default("curated"),
    published: z.boolean().default(true),
    publishedDate: z.string(),
    lastUpdated: z.string().optional(),
  }),
});

const techniques = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/techniques" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    category: z.enum([
      "Fundamentals",
      "Heat Control",
      "Knife Skills",
      "Sauce Work",
      "Baking",
      "Meat",
      "Noodles",
    ]),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    relatedTechniques: z.array(z.string()).optional().default([]),
    published: z.boolean().default(true),
  }),
});

export const collections = { recipes, techniques };
