# Prompt Pantry — Project Context Document

## Overview

Prompt Pantry (promptpantry.org) is a clean, modern recipe blog built for a family audience. All recipes are AI-generated through a rigorous research pipeline (detailed below). The site is ironic in concept — an AI-powered food blog — but not comedic in execution. The tone is sincere, warm, and clean. Think of it as a genuinely useful cookbook that happens to be authored by AI.

The owner (Eric) does not cook and has no food photography or custom art assets. The design must stand entirely on typography, layout, color, and code-generated visual elements (CSS gradients, SVG icons, subtle patterns). No placeholder images or stock photography.

---

## Recipe Creation Pipeline

This is how recipes are produced before they enter the site. Understanding this context matters for content structure decisions.

1. **Research session**: A dedicated Claude chat is prompted with a comprehensive research prompt that scours the internet for renowned recipes, professional techniques, chef insights, and regional variations for a specific dish. This produces a rich dataset of culinary knowledge.

2. **Recipe synthesis**: That research data is brought back to the primary Claude chat, which synthesizes it into an original recipe — combining the best techniques, ingredients, and approaches from the research into a cohesive dish.

3. **Content formatting**: The final recipe is formatted into the site's MDX content structure (frontmatter + body) and added to the repository.

This pipeline means recipes are not throwaway AI slop — they're research-backed syntheses. The site can lean into this with subtle "sourced from X renowned techniques" notes or similar credibility signals without being pretentious about it.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Astro** | Content-first, ships zero JS by default, perfect for a recipe blog. Fast, great SEO, MDX support built-in. |
| Interactive components | **React islands** (via Astro's React integration) | Only hydrate what needs interactivity: serving scaler, cook mode, timers, ingredient checkboxes. Everything else is static HTML. |
| Content format | **MDX** (Markdown + JSX) | Recipes and technique guides are `.mdx` files with YAML frontmatter. Supports embedding React components inline (technique callouts, tips, etc). |
| Styling | **Tailwind CSS** | Utility-first, pairs well with Astro, easy to maintain a consistent design system. |
| Hosting | **Cloudflare Pages** | Free tier, unlimited bandwidth, automatic deploys from Git. |
| Domain | **promptpantry.org** | Registered on Cloudflare Registrar. DNS is already in the same dashboard — trivial to connect. |
| Deployment | **Git push → auto-build** | Connect GitHub repo to Cloudflare Pages. Push to `main` triggers build and deploy. |

---

## Content Architecture

### Directory Structure

```
src/
├── content/
│   ├── recipes/
│   │   ├── catastrophically-good-carbonara.mdx
│   │   ├── smash-burgers-with-comeback-sauce.mdx
│   │   └── ...
│   ├── techniques/
│   │   ├── tempering-eggs.mdx
│   │   ├── emulsification.mdx
│   │   ├── reverse-sear.mdx
│   │   └── ...
│   └── config.ts  (Astro content collection schemas)
├── components/
│   ├── RecipeCard.astro          (recipe listing card)
│   ├── RecipeHero.astro          (recipe page header with metadata)
│   ├── ServingScaler.tsx         (React island — interactive)
│   ├── IngredientList.tsx        (React island — checkboxes + scaling)
│   ├── CookMode.tsx             (React island — step-by-step with timers)
│   ├── StepTimer.tsx            (React island — inline countdown timer)
│   ├── TechniqueCallout.astro   (inline link/preview to technique guide)
│   ├── TagBadge.astro           (cuisine/difficulty/tag pills)
│   ├── PrintView.astro          (print-friendly recipe layout)
│   ├── RecipeFilter.tsx         (React island — browse/filter recipes)
│   ├── Header.astro
│   ├── Footer.astro
│   └── Layout.astro
├── pages/
│   ├── index.astro              (homepage — featured + recent recipes)
│   ├── recipes/
│   │   ├── index.astro          (browse all recipes with filters)
│   │   └── [...slug].astro      (individual recipe pages)
│   ├── techniques/
│   │   ├── index.astro          (browse all technique guides)
│   │   └── [...slug].astro      (individual technique pages)
│   └── about.astro              (about the project / the pipeline)
└── styles/
    └── global.css               (design tokens, base typography)
```

### Recipe Frontmatter Schema

```yaml
---
title: "Catastrophically Good Carbonara"
slug: "catastrophically-good-carbonara"
description: "A silky, peppery Roman classic built on egg yolks, guanciale, and Pecorino — no cream allowed."
cuisine: "Italian"
category: "Pasta"           # Pasta, Meat, Seafood, Vegetarian, Soup, Dessert, Breakfast, Sides, Sauces, Bread
difficulty: "Medium"        # Easy, Medium, Hard, Project
prepTime: 15                # minutes
cookTime: 20                # minutes
restTime: 0                 # minutes (optional — for resting, marinating, chilling)
totalTime: 35               # minutes
servings: 4
tags: ["pasta", "italian", "eggs", "pork", "quick-meals", "weeknight", "comfort-food"]
techniques: ["tempering-eggs", "emulsification", "pasta-water-management"]
equipment: ["Large pot", "12-inch skillet", "Mixing bowl", "Tongs"]
published: true
publishedDate: "2026-03-26"
lastUpdated: "2026-03-26"
---
```

### Recipe Body Structure (MDX)

The body of each recipe MDX file follows this structure. React components can be embedded inline.

```mdx
## Overview

Brief 2-3 sentence hook about the dish. What makes this version special, what techniques
were synthesized, what to expect.

## Ingredients

Ingredients are defined as structured data in the frontmatter OR as a dedicated data block
that the IngredientList component consumes. Recommended approach: a JSON/YAML block in the
MDX that the React island reads, enabling the serving scaler to recalculate quantities.

<IngredientList
  client:load
  servings={4}
  groups={[
    {
      name: "Pasta",
      items: [
        { name: "spaghetti or rigatoni", amount: 1, unit: "lb" },
        { name: "kosher salt (for pasta water)", amount: 2, unit: "tbsp" }
      ]
    },
    {
      name: "Sauce",
      items: [
        { name: "guanciale, cut into lardons", amount: 6, unit: "oz" },
        { name: "egg yolks", amount: 6, unit: "" },
        { name: "whole eggs", amount: 2, unit: "" },
        { name: "Pecorino Romano, finely grated", amount: 2, unit: "oz" },
        { name: "Parmigiano-Reggiano, finely grated", amount: 1, unit: "oz" },
        { name: "black pepper, freshly cracked", amount: 2, unit: "tsp" }
      ]
    }
  ]}
/>

## Steps

<CookMode client:load>

### 1. Boil the pasta water

Bring a large pot of water to a rolling boil. Season aggressively with salt — it should
taste like the sea. Add the pasta and cook until 1 minute short of al dente (it finishes in
the sauce).

<StepTimer minutes={9} label="Pasta cooking" client:load />

### 2. Render the guanciale

While the water heats, add guanciale to a cold skillet. Render over medium-low heat until
the fat is translucent and the edges are golden and crisp.

<TechniqueCallout slug="rendering-fat" />

<StepTimer minutes={8} label="Guanciale rendering" client:load />

### 3. Build the egg mixture

In a mixing bowl, whisk together egg yolks, whole eggs, grated cheeses, and black pepper
until smooth and creamy. This is your sauce — no cream involved.

<TechniqueCallout slug="tempering-eggs" />

### 4. Marry the pasta and sauce

Reserve 1 cup of starchy pasta water. Drain the pasta, add it to the guanciale skillet
(OFF heat), then pour in the egg mixture. Toss vigorously, adding splashes of pasta water
until you achieve a silky, glossy coating on every strand.

<TechniqueCallout slug="emulsification" />

### 5. Serve immediately

Plate and finish with an aggressive amount of cracked black pepper and a final shower of
Pecorino. Carbonara waits for nobody.

</CookMode>

## Notes

- **Guanciale vs pancetta vs bacon**: Guanciale is non-negotiable for authentic carbonara.
  Pancetta is an acceptable substitute. Bacon adds a smokiness that changes the dish.
- **The cream debate**: Traditional Roman carbonara has no cream. The silkiness comes
  entirely from the emulsion of eggs, cheese, fat, and pasta water.
- **Pasta shape**: Spaghetti is traditional in Rome, but rigatoni holds more sauce in its
  ridges and tubes. Both work.
```

### Technique Guide Frontmatter Schema

```yaml
---
title: "Tempering Eggs"
slug: "tempering-eggs"
description: "How to incorporate eggs into hot mixtures without scrambling them."
category: "Fundamentals"    # Fundamentals, Heat Control, Knife Skills, Sauce Work, Baking, Meat, Pasta
difficulty: "Easy"
relatedTechniques: ["emulsification", "custard-making"]
usedInRecipes: []           # Auto-populated at build time by cross-referencing recipe frontmatter
published: true
---
```

### Technique Guide Body Structure

```mdx
## What It Is

One paragraph explaining the technique in plain terms.

## Why It Matters

When and why you'd use this technique. What goes wrong if you skip it.

## How To Do It

Step-by-step walkthrough of the technique itself.

## Common Mistakes

Bulleted list of what typically goes wrong and how to avoid it.

## Recipes Using This Technique

<!-- Auto-generated list at build time — links to all recipes whose
     frontmatter `techniques` array includes this technique's slug -->
```

---

## Feature Specifications

### 1. Serving Scaler

**Component**: `ServingScaler.tsx` + `IngredientList.tsx` (React islands, `client:load`)

- Default servings shown from recipe frontmatter
- +/- buttons or a number input to adjust servings
- All ingredient quantities recalculate proportionally in real time
- Fractional amounts display cleanly (e.g., 1.5 → "1 ½", 0.33 → "⅓")
- Unit conversions are NOT attempted — just scale the numbers
- Scaling state is shared between the scaler control and the ingredient list via React context or prop drilling within the island

### 2. Cook Mode

**Component**: `CookMode.tsx` (React island, `client:load`)

- Toggle button at the top of the Steps section: "Enter Cook Mode"
- When active:
  - Screen wake lock API (`navigator.wakeLock`) to prevent display sleep
  - Steps displayed one at a time in large, readable text
  - Previous/Next navigation between steps
  - Current step highlighted, previous steps shown as completed
  - Ingredient references in step text are highlighted/bold so they stand out
  - Embedded `StepTimer` components are prominent and easy to tap
- When inactive: all steps display normally in the page flow
- Cook mode should work well on mobile — this is primarily a phone-in-kitchen feature

### 3. Step Timers

**Component**: `StepTimer.tsx` (React island, `client:load`)

- Inline countdown timer embedded within recipe steps
- Shows the target time (e.g., "9 minutes") as a tappable/clickable element
- On tap: starts a visible countdown
- Visual progress indicator (progress bar or circular)
- Audio/vibration alert when timer completes (if browser supports it)
- Multiple timers can run simultaneously across different steps
- Timer state persists within the page session (not across page loads)

### 4. Ingredient Checkboxes

**Part of**: `IngredientList.tsx`

- Each ingredient has a checkbox
- Checked ingredients get a strikethrough/dimmed style
- Helps with mise en place (prepping before cooking)
- State resets on page reload (no persistence needed)

### 5. Recipe Filtering & Browse

**Component**: `RecipeFilter.tsx` (React island, `client:load`)

- Available on the `/recipes/` index page
- Filter by: cuisine, category, difficulty, tags
- Search by recipe title
- Sort by: newest, cook time, difficulty
- Responsive grid of `RecipeCard` components
- Cards show: title, description snippet, cuisine badge, difficulty badge, total time, tags

### 6. Technique Cross-Linking

**Component**: `TechniqueCallout.astro`

- Inline callout that appears within recipe steps
- Shows the technique name as a styled link/card
- On hover/focus: shows the technique's short description
- Links to the full technique guide page
- Visually distinct from regular text — styled as a subtle aside/tip, not interrupting the flow

### 7. Auto-Generated "Used In" Lists

- At build time, technique pages auto-populate a "Recipes Using This Technique" section
- Cross-references every recipe's `techniques` array against the technique's slug
- Rendered as a list of linked recipe cards on the technique page
- Implemented via Astro's content collection queries at build time (zero runtime cost)

### 8. Print View

- CSS `@media print` styles that strip navigation, footer, cook mode UI, and decorative elements
- Shows only: recipe title, metadata (servings/time), ingredients, steps, notes
- Clean, single-column layout optimized for paper
- A "Print Recipe" button in the recipe page UI that triggers `window.print()`

### 9. Jump to Recipe

- A prominent button/link at the very top of the recipe page
- Smooth-scrolls past any intro content directly to the Ingredients section
- A playful nod to the notorious food blog pattern of burying recipes under essays
- Since our intros are short, this is partly ironic — but still useful

### 10. Shopping List Export (Future / Nice-to-Have)

- Button on recipe page to copy ingredients as plain text to clipboard
- Optionally: combine ingredients from multiple selected recipes
- Format: clean plain text suitable for pasting into a notes/reminders app

---

## Design System

### Philosophy

Clean, warm, typography-forward. No photography or illustrations — the design relies entirely on type, whitespace, color, and subtle code-generated visual elements (CSS gradients, SVG icons, geometric patterns). Think Bon Appétit website meets a well-designed indie cookbook.

### Color Palette (Warm & Earthy)

Define as CSS custom properties / Tailwind theme extensions:

| Token | Role | Hex (approximate) |
|-------|------|--------------------|
| `--color-cream` | Page background | `#FAF7F2` |
| `--color-warm-white` | Card/surface background | `#FFFFFF` or `#FFFDFB` |
| `--color-charcoal` | Primary text | `#2C2C2C` |
| `--color-warm-gray` | Secondary text, borders | `#8C8377` |
| `--color-terracotta` | Primary accent (links, buttons, tags) | `#C75B3F` |
| `--color-terracotta-light` | Hover/light accent | `#E8927A` |
| `--color-sage` | Secondary accent (technique callouts, badges) | `#7A9E7E` |
| `--color-sage-light` | Light sage for backgrounds | `#E8F0E9` |
| `--color-golden` | Tertiary accent (timers, highlights) | `#D4A853` |
| `--color-golden-light` | Light gold for backgrounds | `#FDF4E0` |

### Typography

Use Google Fonts. Choose distinctive, characterful fonts — not Inter, Roboto, or system defaults.

Recommendations (the implementer should evaluate and finalize):

- **Display / Headings**: A serif with personality. Consider: **DM Serif Display**, **Playfair Display**, **Lora**, or **Fraunces**. Should feel warm, editorial, cookbook-like.
- **Body text**: A clean, highly readable sans-serif or humanist sans. Consider: **Source Sans 3**, **Nunito Sans**, **DM Sans**, or **Outfit**. Must be excellent at body sizes.
- **Accents / UI labels**: The body font at smaller weights, or a slightly condensed variant for tags and metadata.

### Spacing & Layout

- Max content width: ~720px for recipe body text (optimal reading width)
- Wider max for the browse/grid pages: ~1200px
- Generous vertical spacing between sections
- Cards use subtle warm shadows, not hard borders
- Responsive: mobile-first, single column on small screens, 2-3 column grid for recipe browse

### Visual Elements (No-Asset Strategy)

Since there are no photos or illustrations, use these to create visual interest:

- **Recipe hero sections**: Subtle CSS gradient backgrounds using the palette colors, or a warm-toned geometric pattern (CSS-only or inline SVG)
- **Cuisine/category color coding**: Each cuisine or category gets an accent color from the palette, used on badges and card accents
- **SVG icons**: Use a consistent icon set (Lucide, Heroicons, or similar) for cook time, difficulty, servings, equipment, etc.
- **Decorative dividers**: Subtle SVG or CSS separators between recipe sections — think thin lines with a small icon or flourish, not heavy borders
- **Tag/badge pills**: Rounded, lightly colored pills using the palette for cuisine, difficulty, tags
- **Hover/interaction states**: Warm, subtle transitions. Cards lift slightly on hover. Links underline-animate.

### Difficulty Indicators

Use a visual scale, not just text:

- **Easy**: 1 filled icon (e.g., a single flame or chef hat)
- **Medium**: 2 filled icons
- **Hard**: 3 filled icons
- **Project**: 3 filled icons + a special "project" badge (for all-day or multi-day recipes)

---

## Page Designs

### Homepage (`/`)

- Site header with "Prompt Pantry" wordmark (styled text, no logo image needed) and navigation
- Hero section: warm, inviting tagline. Something like "AI-researched recipes for real kitchens." Keep it brief and sincere.
- Featured recipe (1 large card, manually selected or most recent)
- Recent recipes grid (4-6 cards)
- "Browse All Recipes" CTA
- Brief "What is this?" blurb linking to the About page
- Footer with minimal links

### Recipe Browse (`/recipes/`)

- Sticky filter bar at top: cuisine, category, difficulty, search
- Responsive grid of recipe cards
- Cards show: title, description, cuisine badge, difficulty, total time
- Infinite scroll or pagination (pagination preferred for a content site)

### Recipe Page (`/recipes/[slug]`)

- Jump to Recipe button (top)
- Recipe title (large, display font)
- Metadata bar: cuisine, difficulty, prep/cook/total time, servings scaler
- Equipment list (if applicable)
- Brief intro/overview
- Ingredient list with checkboxes and scaling
- Steps with cook mode toggle, embedded timers, technique callouts
- Notes section
- "You might also like" — 2-3 related recipes based on shared tags/cuisine
- Print button

### Technique Browse (`/techniques/`)

- Simple list or grid of technique cards
- Grouped by category (Fundamentals, Heat Control, etc.)

### Technique Page (`/techniques/[slug]`)

- Title, difficulty, category
- Full guide content
- "Recipes Using This Technique" auto-generated list at bottom

### About Page (`/about`)

- Explains the project: what Prompt Pantry is, how the research pipeline works, the AI angle
- Sincere and straightforward — not trying to be funny, just transparent
- Could include a brief "how to use this site" section for family members

---

## Deployment & Workflow

### Initial Setup

1. Initialize Astro project with React and Tailwind integrations
2. Configure content collections for recipes and techniques
3. Build component library
4. Create a few seed recipes and technique guides to test with
5. Push to GitHub

### Cloudflare Pages Setup

1. In Cloudflare dashboard → Pages → Create a project
2. Connect to GitHub repository
3. Build settings:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy
5. Add custom domain: promptpantry.org (one-click since domain is on Cloudflare)

### Ongoing Content Workflow

1. Eric runs the research pipeline in Claude to generate a recipe
2. Recipe is formatted as an MDX file with proper frontmatter
3. File is added to `src/content/recipes/`
4. Any new techniques are added to `src/content/techniques/`
5. Git commit and push to `main`
6. Cloudflare Pages auto-builds and deploys (~30-60 seconds)

---

## Seed Content

Create 2-3 seed recipes and 2-3 seed techniques to build and test against. Make them varied:

### Seed Recipes
1. **A pasta dish** (e.g., carbonara) — Medium difficulty, ~35 min, Italian, uses tempering eggs + emulsification techniques
2. **A simple weeknight dish** (e.g., smash burgers) — Easy difficulty, ~20 min, American, uses rendering fat + Maillard reaction techniques
3. **A more ambitious dish** (e.g., braised short ribs) — Hard difficulty, ~4 hours, French/American, uses braising + fond-building techniques

### Seed Techniques
1. **Tempering Eggs** — Fundamentals, Easy
2. **Emulsification** — Fundamentals, Easy
3. **Rendering Fat** — Heat Control, Easy
4. **Building a Fond** — Heat Control, Medium
5. **The Maillard Reaction** — Fundamentals, Easy (more of an explainer than a how-to)

Generate actual full content for these — real ingredient lists, real steps, real technique guides. They should be production-quality, not placeholder text.

---

## Non-Goals (Explicitly Out of Scope)

- User accounts, authentication, or login
- Comments or user-submitted content
- Database or CMS backend
- Image upload or management
- Newsletter or email collection
- Analytics (can be added later trivially with Cloudflare Web Analytics — free, no-JS)
- E-commerce or monetization
- Social media integration
- Server-side rendering or dynamic routes — everything is statically built

---

## Implementation Priority

Build in this order:

### Phase 1: Foundation
- [ ] Astro project scaffolding with React + Tailwind
- [ ] Content collection schemas (recipes + techniques)
- [ ] Base layout, header, footer
- [ ] Design tokens (colors, typography, spacing)
- [ ] Global styles

### Phase 2: Recipe Pages
- [ ] Recipe page template (`[...slug].astro`)
- [ ] IngredientList component with checkboxes
- [ ] ServingScaler component
- [ ] Step rendering with proper styling
- [ ] TechniqueCallout component
- [ ] Recipe metadata display (times, difficulty, cuisine, equipment)

### Phase 3: Cook Mode & Timers
- [ ] CookMode component (step-by-step view, wake lock)
- [ ] StepTimer component (countdown, audio alert)
- [ ] Cook mode mobile optimization

### Phase 4: Browse & Discovery
- [ ] RecipeCard component
- [ ] Homepage layout
- [ ] Recipe browse page with RecipeFilter
- [ ] Technique browse page
- [ ] Technique page template

### Phase 5: Cross-Linking & Polish
- [ ] Auto-generated "Recipes Using This Technique" lists
- [ ] "You might also like" recommendations on recipe pages
- [ ] Jump to Recipe button
- [ ] Print styles
- [ ] About page
- [ ] SEO meta tags (title, description, Open Graph)

### Phase 6: Content & Deploy
- [ ] Generate full seed content (3 recipes, 5 techniques)
- [ ] Push to GitHub
- [ ] Connect to Cloudflare Pages
- [ ] Attach promptpantry.org domain
- [ ] Verify build and deploy pipeline

---

## Notes for the Implementer

- **Astro islands are key**: Only the interactive components (ServingScaler, IngredientList, CookMode, StepTimer, RecipeFilter) should be React with `client:load` or `client:visible`. Everything else should be `.astro` components that render to static HTML.
- **Content collections**: Use Astro's built-in content collections with Zod schemas for type-safe frontmatter validation. This catches errors at build time.
- **MDX components**: Register the React components (IngredientList, CookMode, StepTimer, TechniqueCallout) as available in MDX files so recipe authors can use them inline.
- **No external API calls at runtime**: This is a fully static site. All data resolution happens at build time.
- **Mobile-first**: The primary use case for cook mode is someone with their phone propped up on the kitchen counter. Design for that.
- **Accessibility**: Proper heading hierarchy, ARIA labels on interactive elements, keyboard navigation for cook mode, visible focus states.
- **Performance**: Astro's partial hydration means this site should score 95+ on Lighthouse out of the box. Don't add client-side JS unless it genuinely needs interactivity.
