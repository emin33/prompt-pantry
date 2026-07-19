---
name: recipe-research
description: Run the Prompt Pantry research phase for a dish and produce a house-format research dossier at public/research/{slug}.md. Use when the user says "research pad see ew", "add a recipe for X", "start the research phase for X", "do the research on X", "write a dossier for X", "I want to add X to the site", or names a dish alongside Prompt Pantry, promptpantry.org, the recipe pipeline, or a research doc. Also use when the user asks to research a dish's techniques, authoritative sources, regional variations, or gluten-free adaptation before a recipe exists. Produces raw findings only — never the recipe MDX, never a git commit.
tags: [prompt-pantry, recipe, research, dossier, food-science, gluten-free]
---

# Prompt Pantry — Recipe Research

Stage 1 of the three-stage Prompt Pantry pipeline: **research → synthesis → MDX formatting**. This skill produces the raw findings dossier that a later, separate session turns into a recipe. Stopping at the artifact is deliberate — synthesis stays human-in-the-loop.

Repo root: `C:/Projects/Web/Prompt Pantry`. Output: `public/research/{slug}.md`.

**Invocation inputs.** The dish name is required. Optional extras the user may supply, and which you should ask for only if the dish is ambiguous: a difficulty target, dietary constraints beyond the standing gluten-free workstream, equipment on hand, and an explicit "it is NOT ___" disambiguation.

## What this stage produces, and what it must not

Produce a single self-contained markdown file of **raw organized findings**. State inside the document, near the end, that it is findings only and not a recipe.

House-style note, stated accurately so you do not over-trust the corpus: only three of the 24 files in `public/research/` currently carry that disclaimer (`jamaican-jerk-chicken.md`, `louisiana-chicken-andouille-gumbo.md`, `slow-cooker-pasta-e-fagioli.md`). It is the intended convention going forward, not a universal existing one. Where this document tells you something is "house style," treat it as the target; where it cites a corpus count, that count was measured.

Do not:
- write or edit `src/content/recipes/*.mdx`
- run `git add`, `git commit`, or `git push`
- create or convert images
- invent a source, a quote, an attribution, a page number, a temperature, or a ratio

Unverified claims are marked `[UNVERIFIED]` inline, not quietly dropped and not laundered into confident prose. Retrieval failures (blocked hosts, HTTP 402/403, exhausted search budget) are recorded inline in a short sourcing note near the top, not hidden.

## Deriving the slug

The slug is the join key across three artifacts that must agree: `public/research/{slug}.md`, `src/content/recipes/{slug}.mdx`, and the live route `/recipes/{slug}`.

It comes from `src/lib/slug.ts`: lowercase, trim, strip `[^\w\s-]`, collapse whitespace and underscores to hyphens, collapse repeated hyphens, trim hyphens.

That slugifier does **no Unicode normalization** — accented letters are deleted, not transliterated. "Ragù" became `rag` and "Gruyère" became `gruyre` in already-live slugs. When the dish name carries accents, apostrophes, or an ampersand, propose the slug to the user and confirm before writing the file. Hand-chosen shorter slugs are also normal (`butterbeer` for "Frozen Butterbeer"). Variants use a `-gf` suffix or a descriptive prefix (`slow-cooker-`), and a variant may legitimately reuse the parent's dossier rather than getting its own.

**The image path is NOT slug-derived.** `image` is `z.string().optional()` (`src/content.config.ts:42`) and its real values are hand-chosen: `/images/gumbo.webp` for `louisiana-chicken-andouille-gumbo`, `/images/jerk-chicken.webp` for `jamaican-jerk-chicken`, `/images/spicy-pork-belly.webp` for `spicy-pork-belly-yakiniku`. Nine of 25 recipe files have no `image` at all, and `minessales-pizza` and `minessales-pizza-gf` share one. Never assume or assert `public/images/{slug}.webp`.

**Record the research path for stage 2.** `src/content.config.ts:44` defines `research: z.string().optional()`, and every real recipe uses the public-URL form — `research: "/research/beef-wellington.md"`, not a repo path. Because you may choose a slug that diverges from the dish name, your choice is load-bearing for a field stage 2 has to fill in. In your closing report, state the exact string the recipe frontmatter will need: `research: "/research/{slug}.md"`.

**Write location and collisions.** Write to `public/research/`, never the deprecated root-level `research/`. That deprecated directory still exists and still holds three stale files — `authentic-pad-thai.md`, `gluten-free-beef-stroganoff.md`, `pasta-fagioli-soup.md` — all of which are duplicated under `public/research/`. Ignore the root copies entirely; do not read them for style, do not update them, do not delete them.

Before writing, check whether `public/research/{slug}.md` already exists. If it does, stop and ask the user whether to overwrite, write to a new slug, or abort. Never silently overwrite. This matters immediately: `public/research/pad-see-ew.md` exists and is the pathological 46,733-word file, and "research pad see ew" is a literal trigger phrase for this skill.

## The research prompt

This is Eric's template. Fill the placeholders; keep the pillar structure and wording intact.

> You are a culinary research agent. Conduct exhaustive internet research on **{DISH}** and compile raw findings that a separate synthesis agent will later turn into a definitive home recipe. Return raw findings only. Do NOT write a recipe.
>
> **{DISH} is:** {one line — what it IS}. **It is NOT:** {what it is commonly confused with}.
>
> **PILLAR 1 — RENOWNED RECIPES & AUTHORITATIVE SOURCES.** The most respected, technically rigorous, highly praised versions from professional chefs, serious food-science voices, acclaimed cookbooks, competition winners, and demonstrably expert communities — over generic blogs. For each: source, author credentials, distinguishing ingredients and ratios, key differentiating choices. Flag consensus points.
>
> **PILLAR 2 — TECHNIQUE DEEP-DIVE.** The techniques separating transcendent from merely good — prep, timing, temperatures, resting and finishing. Surface technique debates and say which side has more authoritative backing. Science-backed explanations where they exist.
>
> **PILLAR 3 — INGREDIENT ANALYSIS.** Master ingredient list across sources with frequency of appearance and notable substitutions. Flag "secret weapon" or unexpected ingredients appearing in the highest-rated versions. Quality and sourcing callouts, seasoning ratios.
>
> **PILLAR 4 — REGIONAL & STYLISTIC VARIATIONS.** Distinct regional and stylistic variations and what defines each. Where traditions diverge; modern and hybrid approaches top makers use.
>
> **PILLAR 5 — PITFALLS, PRO TIPS & NON-OBVIOUS KNOWLEDGE.** Common failure modes, expert-cited fixes, non-obvious tips absent from a casual recipe search.
>
> **ADDITIONAL CONTEXT:** {dish-specific notes, constraints, the experience being chased}

The IS / IS-NOT line does real work — it is what keeps a pad see ew run from drifting into pad thai. Write it before searching, and carry it into every subagent prompt.

## Standing mandates — apply these without being asked

**Effort/payoff.** The cook will do real work if it demonstrably improves taste, and rejects ritual complexity that adds little. This is not a request for shortcuts; it is a request for an honest audit that is willing to say a revered traditional step is a waste of time.

Tag every technique, ingredient upgrade, and step inline with `[HIGH PAYOFF]`, `[MODERATE PAYOFF]`, `[LOW PAYOFF / SKIPPABLE]`, or `[DISPUTED]`, with a justification. Split the verdict when equipment or cut changes the answer. Pair each verdict with an explicit cost line naming what the effort actually costs. Verdicts appear twice: locally per section, then consolidated into a closing payoff ranking table and a **Worth The Work / Skip It** split, ending with the verdict in one paragraph.

This mandate is the thing most likely to be silently skipped or invented, and the corpus gives you no clean model — `grep -l "HIGH PAYOFF" public/research/*.md` returns exactly one file, `pad-see-ew.md`, the one this skill tells you not to imitate. So the worked examples below are the specification. Follow their shape literally.

Inline verdict, plain case:

> **Velveting the pork in bicarbonate before the sear.** Twenty minutes in a 1%-by-weight baking-soda slurry raises surface pH and measurably suppresses protein contraction, and every test-kitchen source that ran a side-by-side reported a texture difference blind tasters could name. `[HIGH PAYOFF]` — this is the difference between tender and merely cooked. Cost: one bowl, twenty passive minutes, and a rinse.

Inline verdict, split by equipment:

> **Cooking in two batches rather than one crowded pan.** `[HIGH PAYOFF on a 12,000 BTU domestic burner; LOW PAYOFF with a real wok range]` — domestically the pan cannot recover temperature after a full load, so a single batch steams instead of searing; at restaurant BTUs the recovery is fast enough that the batch split buys almost nothing. Cost: four extra minutes and a second plate.

Skippable verdict:

> **Rinsing the rice a full seven times "until the water runs clear."** The traditional instruction long predates modern milling; two changes of water remove essentially all the loose surface starch on contemporary product, and no source produced a controlled comparison supporting the higher count. `[LOW PAYOFF / SKIPPABLE]`. Cost: free; it is the absence of an action.

Closing ranking table — every dossier ends with one in this shape:

| Rank | Move | Verdict | Taste delta per unit effort | Cost |
|---|---|---|---|---|
| 1 | Velvet the pork | `[HIGH PAYOFF]` | Large; the single biggest texture lever | One bowl, 20 passive min |
| 2 | Sear in two batches | `[HIGH PAYOFF]`* | Large on a domestic burner | 4 min, one extra plate |
| 3 | Toast the spices whole | `[MODERATE PAYOFF]` | Real but subtle; survives into the sauce | 3 min, one dry pan |
| 4 | Seven-rinse the rice | `[LOW PAYOFF / SKIPPABLE]` | None detected | Negative — saves time |

\* equipment-dependent; see the split verdict above.

Then the **Worth The Work / Skip It** split as two prose lists, then "The verdict in one paragraph."

Calibrate to a real home kitchen — roughly a 12,000 BTU burner, no combi oven, no salamander. When a technique is out of reach, say so plainly rather than prescribing it.

**Gluten-free.** GF diners are a standing household constraint, so GF side-research runs on every dish by default. But research the **uncompromised** dish — never narrow the search to GF versions. That rule is encoded in the app itself (`src/lib/agents/prompt-engineer.ts:19,21`): the best version of a dish is the best version, and dietary enforcement belongs to the synthesis stage. GF is a parallel workstream, not a filter.

The GF section covers where the gluten actually is, component-by-component conversion with honest losses, cross-contact versus ingredient risk, and GF-specific payoff verdicts.

Which pattern to recommend depends on the dish:
- **Gluten is structural** (breads, doughs, pasta, dumplings, spinners) → separate variant file, using the `variants` / `variantOf` frontmatter pair. Established house style; `minessales-pizza` ↔ `minessales-pizza-gf` and `jamaican-chicken-soup` ↔ `jamaican-chicken-soup-gf` are the real pairs. Per `src/content.config.ts:48-55` the shapes are `variants: [{ label, slug }]` (an array) on the parent and `variantOf: { label, slug }` (a single object) on the child; `label` is required on both and real files set it to the string `"Gluten-Free"`. Recommend the exact values stage 2 should write.
- **Dish is batch-cooked or portioned and gluten lives only in sauces/seasonings** → keep the main recipe uncompromised and document GF as a swap sidebar with cook-order and cross-contamination guidance. This is Eric's stated forward preference; it does not exist in the repo yet, so present it as a recommendation, not as existing convention. The realized approximation today is a `gluten-free` tag plus a Notes bullet naming the swap and the store-bought components to verify.

**Sourcing honesty.** Prefer named authorities with stated credentials over SEO food blogs. Quote native-language sources in original script with translation. Never average away a disagreement — weigh it and say who is on each side.

**Page numbers and the traceability rule.** House style quotes cookbooks with page numbers, but you must never produce one you did not see. WebFetch cannot confirm a print page, and the output format bans URLs, so nothing in the finished file lets a human audit where a citation came from — which means the discipline has to happen while you write. Apply this rule:

- Cite a page number **only when you actually retrieved the page itself** (a scan, a Google Books page view, a publisher excerpt showing pagination).
- If you have the quote but only secondhand — someone else's blog quoting the book — attribute it to the intermediary: `Kenji López-Alt, The Food Lab, as quoted by Serious Eats` — with no page number.
- If you have the claim but not a verified quote, paraphrase and mark it `[UNVERIFIED]`. Never upgrade a paraphrase into quotation marks.
- Every named authority in the finished dossier must trace to a search result or fetch you actually performed in this session. If it does not, cut it.

## Output document structure

Open with a single H1 that is a descriptive editorial sentence-case title — never the slug, never `# Research: {slug}`. The dossier formula is "The definitive research dossier on X" or "The definitive research guide to X". Follow it immediately with either a bolded `**Bottom line:**` thesis paragraph stating the conclusion up front, or a `## TL;DR` bullet list (the newer form). No frontmatter, no date, no byline.

Then the five-pillar spine as H2s separated by `---` rules, then the standing extensions:

```
## PILLAR 1 — Renowned recipes and authoritative sources
## PILLAR 2 — Technique deep-dive
## PILLAR 3 — Ingredient analysis
## PILLAR 4 — Regional and stylistic variations
## PILLAR 5 — Pitfalls, pro tips, and non-obvious knowledge
## Gluten-free adaptation and equipment
## Recommended recipe architecture   (ratios, order of operations, difficulty calibration — not a formatted recipe)
## The effort/payoff verdict          (Worth The Work / Skip It / the verdict in one paragraph)
## Caveats                            (confidence levels, unverified claims, speculation flags)
```

**How literally to take those strings.** The `PILLAR n — ` prefix, the em dash, and sentence case are fixed. The descriptive tail is paraphrasable to fit the dish, and the corpus proves it: the three files carrying the pillar spine (`jamaican-chicken-soup.md`, `louisiana-chicken-andouille-gumbo.md`, `potato-leek-soup.md`) disagree with each other — you will find both `## PILLAR 1 — Renowned recipes and where the authorities diverge` and `## PILLAR 4 — Regional and cultural variations`. Match the pattern, not the exact wording.

Be aware that **no existing file has both halves of this skeleton.** The pillar spine appears in those three files; `## Caveats` appears in a disjoint three (`butterbeer.md`, `grand-marnier-orange-slush.md`, `slow-cooker-pasta-e-fagioli.md`); `## Recommended recipe architecture` in only two (`pad-see-ew.md`, `spicy-tomato-basil-pappardelle.md`); `## The effort/payoff verdict` in `pad-see-ew.md` alone. This structure is the target the skill defines, not a convention you can copy wholesale from any single file. Build it from this document.

Content moves that recur in every good dossier, regardless of where they land: a named-authority survey with credentials stated; an explicit **consensus versus disagreement** treatment naming who falls on each side; numeric ranges shown as the full spread with each value attributed to its authority ("3.5 min (Prudhomme) → 45 min (Toups) → 90 min (Brown, oven)"), never averaged; a food-science mechanism passage citing named researchers, journals, and years; a normalized comparison table scaling every source to one common portion; a ranked failure-mode catalog ordered by observed frequency; an "if you only do one thing" list attributed per authority; storage, reheating, make-ahead and freezing; and a closing addressed explicitly to the synthesis stage — the decisions it will have to make.

**Formatting conventions:**
- Tables are the signature device — per-authority spec sheets, ingredient presence matrices, decision-point splits, ranked comparisons. Use them heavily.
- Cite inline in prose: `(Krasnow et al.)`, `"Gumbo is a project, not a recipe" (Tasting Table)`. **No markdown links, no bare URLs** — only `pad-see-ew.md` violates this, 42 times. Bare domain names as plain text are fine.
- Prefer a source table near the top with an explicit **Credibility** column over a trailing bibliography. If a citation section is included, group by category, one entry per entity with its works listed together — never one entry per URL, and never padded with fetch-status noise or ISBNs.
- No blockquotes. Run quotations inline in double quotes with attribution.
- Carry emphasis with `**bold**` on the claim, evidence in plain prose after it. No emoji, no callout syntax, no SCREAMING-CAPS headings.
- H1/H2/H3 only. Exactly one H1. Deeper nesting is a machine-output tell.
- Separate top-level sections with `---`.

**Length: hard ceiling 7,000 words; target 4,500–6,500 for a dish with real depth.**

The ceiling is the real constraint and it is well evidenced — the corpus maximum excluding the outlier is 6,782 words (`louisiana-chicken-andouille-gumbo.md`), and one past run produced a 46,733-word dossier (`pad-see-ew.md`) that is unusable downstream because the file is fetched whole into an LLM's context at runtime. If the material overruns, compress; do not ship long.

**There is no hard floor, and you must not pad to reach one.** Five corpus files sit well below 4,500 words and are fine: `pasta-e-fagioli.md` (1,073), `beef-wellington.md` (2,314), `instant-pot-butter-chicken.md` (2,491), `changs-spicy-chicken-soup.md` (2,497), `miso-lacquered-flap-steak.md` (2,794). A simple, thinly documented, or narrowly scoped dish produces a shorter dossier and that is the correct outcome. Length must track how much verified material actually exists.

**Measure before you finish.** Run `wc -w` on the finished file and report the number. Do not estimate it.

The document is never rendered as a page and never linked in the UI. Its only consumer is `RecipeChat.tsx`, which fetches it and injects it into the chat assistant's context, and SignalWire DataSphere, which ingests it with paragraph chunking. Write it self-contained, plain, and information-dense for an LLM reader — not as a skimmable web page.

## Do not emit the machine wrapper

Ten files in `public/research/` open with `# Research: {slug}` then `## Best Recipes, Techniques & Food Science`, and later `## Common Mistakes, Pro Tips & Regional Authenticity`. That trio is an artifact of the in-app RecipeGenerator concatenating two prompts — it is the seam — and it marks bot-published community recipes. Never reproduce it in a hand-run session.

The heading trio is the reliable detector. **H1 count is not** — those ten files carry 1 to 4 H1s (`pad-see-ew.md` and `roasted-broccoli-and-gruyre-cheddar-soup.md` have exactly one; `spicy-tomato-basil-pappardelle.md` has four), so counting H1s will misclassify. Detect by the headings. Relatedly, `Add recipe: {slug}` and `Add research: {slug}` are hardcoded generator commit messages (`functions/api/publish-recipe.ts:151,179`) — never hand-write them, though this skill does not commit at all.

## Choosing the run shape

**Single-agent path — the default.** Load web tools first (`ToolSearch` with `select:WebSearch,WebFetch`; they are deferred). Work the five pillars in sequence with focused searches, then write the file. Right for most dishes: well-documented, English-language sources, no native-script research, no deep equipment question.

**Multi-agent path — run the bundled script, do not hand-roll it.** When the dish genuinely warrants a fan-out — significant non-English source material, sharply contested technique, or an unusual equipment constraint — use `research-workflow.js` in this skill directory. It is the audited implementation of the six-phase run (Scope → Research+Verify → Gap → Sections → Assemble) and it already encodes the budget discipline, the scoped-read rule, the status-enum verdicts, and the citation dedup described below. Hand-rolling a parallel run instead is a mistake: the script exists precisely because the improvised version failed expensively.

Call it with `args`:

```
dish   — required, the dish name. There is no default; the script throws without it.
slug   — optional; derived from `dish` via the repo slugifier when omitted.
isNot  — optional string or array of confusable dishes. Strongly recommended.
notes  — optional cook's constraints, equipment, difficulty target.
repo   — optional, defaults to C:/Projects/Web/Prompt Pantry
```

It writes intermediates to `{repo}/.research-scratch/{slug}/` — `raw/` for per-angle findings, `sections/` for the numbered parts — and the finished dossier to `public/research/{slug}.md`. The scratch directory is working state, not output; leave it in place for inspection and mention its path in your report so Eric can delete it or keep it.

The two failure modes the script defends against, which you should understand before running it. First: researchers will consume the entire global WebSearch budget before any verification pass runs, and a verifier that defaults to "refuted" when it cannot search converts quota exhaustion into mass false refutation — in one run, 88 of 136 claims were marked refuted, 92% of them with could-not-verify phrasing. The script caps verification at the top 3 claims per angle and uses a `CONFIRMED | CORRECTED | REFUTED | UNVERIFIED` status enum, and it never feeds `UNVERIFIED` into an omit-list. Second: unscoped agents globbing the whole scratch directory once burned 567K tokens on a task that should have cost a few thousand; every section writer in the script reads only its own named subset. If you ever deviate from the script, preserve both properties.

Either way, finish with a seam-repair pass over the head, the tail, and every section boundary, and confirm the file has exactly one H1 and no leaked agent commentary.

## Before finishing

Report to the user: the slug, the output path, the `research: "/research/{slug}.md"` string stage 2 will need, the measured word count from `wc -w`, which authorities anchored the findings, the sharpest disagreement found, the headline Worth The Work / Skip It calls, and — if the multi-agent path ran — the scratch directory path. Then stop. Synthesis is the next session's job, and it is Eric's call whether to start it.
