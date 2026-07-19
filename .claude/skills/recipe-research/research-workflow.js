export const meta = {
  name: 'recipe-research',
  description: 'Exhaustive 5-pillar culinary research on a dish, adversarially verified, assembled into the house research dossier',
  phases: [
    { title: 'Scope', detail: 'propose the dish-specific research angles for each pillar' },
    { title: 'Research', detail: 'parallel researchers across 5 pillars + GF/equipment/history side-research, each adversarially verified inline' },
    { title: 'Gap', detail: 'completeness critic finds missing angles, spawns a round 2' },
    { title: 'Sections', detail: 'write each part of the dossier from the verified findings' },
    { title: 'Assemble', detail: 'architecture + citations in parallel, then seam-repaired final doc' },
  ],
}

// ---------------------------------------------------------------------------
// Parameters (from the workflow `args` global, with fallbacks)
// ---------------------------------------------------------------------------

const A = (typeof args === 'object' && args) ? args : {}

// No default dish. A fallback here silently researches the wrong dish and
// produces a plausible-looking successful run against it — the worst failure
// mode available, because nothing downstream looks wrong.
if (!A.dish) throw new Error('research-workflow: args.dish is required (no default)')

const DISH = A.dish
const SLUG = A.slug || String(DISH)
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')

// The repo slugifier strips all non-ASCII, so a native-script dish name can
// slug to the empty string — which would write a dotfile and collide in scratch.
if (!SLUG) {
  throw new Error('research-workflow: could not derive a slug from dish "' + DISH + '"; pass args.slug explicitly')
}

const IS_NOT = Array.isArray(A.isNot) ? A.isNot : (A.isNot ? [String(A.isNot)] : [])
const NOTES = A.notes || ''
const REPO = A.repo || 'C:/Projects/Web/Prompt Pantry'
const SCRATCH = A.scratch || (REPO + '/.research-scratch/' + SLUG)

const OUT_PATH = `${REPO}/public/research/${SLUG}.md`
const RAW_DIR = `${SCRATCH}/raw`
const SEC_DIR = `${SCRATCH}/sections`

// Cap on how many claims per researcher get adversarially verified. The prior
// run fanned out 136 verifiers (51% of total tokens) and exhausted the global
// WebSearch budget; the top-N claims carry nearly all the risk.
const VERIFY_PER_ANGLE = 3
// Hard cap on the assembled citation section.
const MAX_CITATIONS = 120
// Cap on source lines fed INTO the citation agent. ~17 researchers at maxItems 20
// plus 6 gap-fillers can approach 400+ lines; MAX_CITATIONS only bounds output.
const MAX_SOURCE_LINES = 400

const CONFUSION = IS_NOT.length
  ? IS_NOT.map(x => `- ${x}`).join('\n')
  : '(No confusable-dish list was supplied. Determine for yourself which neighbouring dishes are commonly conflated with this one, and distinguish them explicitly.)'

const DISH_BRIEF = `
DISH: ${DISH}

IS NOT — these are commonly confused with the dish and must be kept rigorously distinct:
${CONFUSION}
${NOTES ? `\nCOOK'S CONSTRAINTS AND CONTEXT:\n${NOTES}\n` : ''}
CROSS-CUTTING MANDATE — EFFORT VS PAYOFF:
The person cooking this is willing to do real work IF it demonstrably improves the taste, but wants no ritual complexity that adds little. For EVERY technique, ingredient upgrade, or procedural step you document, you MUST tag it with an explicit verdict:
  [HIGH PAYOFF] — meaningfully changes the result; worth the effort
  [MODERATE PAYOFF] — noticeable improvement, modest cost
  [LOW PAYOFF / SKIPPABLE] — traditional or oft-repeated but contributes little for a home cook
  [DISPUTED] — authorities disagree on whether it matters
Split the verdict when equipment or cut changes the answer (e.g. "[HIGH PAYOFF on a weak burner; LOW PAYOFF with real BTUs]"), and pair each verdict with an explicit cost line naming what the effort actually costs ("Cost: one bowl and twenty passive minutes." / "Cost: free; it is the absence of an action."). This is the single most important thing you produce.

RULES:
- Return RAW FINDINGS ONLY. Do NOT write a finished recipe.
- Prefer professional chefs, food scientists, acclaimed cookbooks, native-language sources, and demonstrably expert communities over generic SEO food blogs. Name and credential every source.
- Quote exact ratios, temperatures, and timings when a source gives them. Include URLs in your structured source list.
- PAGE NUMBERS: cite a cookbook page number ONLY if you actually retrieved the page itself (a scan, a Google Books page view, a publisher excerpt showing pagination). If you have the quote only secondhand, attribute it to the intermediary ("as quoted by Serious Eats") with NO page number. If you have the claim but no verified quote, paraphrase and mark it UNVERIFIED — never upgrade a paraphrase into quotation marks.
- Where sources disagree, say so explicitly and weigh which side has more authoritative backing. Never average a dispute away.
- Calibrate to a real home kitchen. If a technique is genuinely out of reach domestically, say so plainly instead of prescribing it.
- Never invent a source, a quote, an attribution, or a number. If you could not verify something, mark it UNVERIFIED.
- Record retrieval failures inline (blocked hosts, HTTP codes, exhausted search budget) rather than silently omitting them.
`

const TOOLING = `Before searching, load web tools with ToolSearch using the query "select:WebSearch,WebFetch". Use many distinct searches, and actually FETCH the promising pages rather than relying on search snippets alone. Native-language searches in the dish's language of origin are strongly encouraged.`

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ANGLES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angles'],
  properties: {
    angles: {
      type: 'array',
      minItems: 8,
      maxItems: 14,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'pillar', 'angle'],
        properties: {
          key: { type: 'string', description: 'short kebab-case id prefixed with the pillar number, e.g. p2-<technique-name>' },
          pillar: { type: 'integer', minimum: 1, maximum: 5 },
          angle: { type: 'string', description: 'A full paragraph of specific, dish-particular research instruction naming the authorities, ingredients, techniques and controversies to chase.' },
        },
      },
    },
  },
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'claims', 'sources'],
  properties: {
    summary: { type: 'string', description: '3-6 sentence summary of what this angle turned up' },
    claims: {
      type: 'array',
      description: 'Load-bearing factual claims downstream synthesis will rely on. Max 8, MOST IMPORTANT FIRST — only the top few are independently fact-checked.',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'attribution', 'payoff'],
        properties: {
          claim: { type: 'string' },
          attribution: { type: 'string', description: 'Who/what source asserts this, with URL if available' },
          payoff: { type: 'string', enum: ['HIGH', 'MODERATE', 'LOW', 'DISPUTED', 'N/A'] },
        },
      },
    },
    sources: {
      type: 'array',
      maxItems: 20,
      description: 'One line per source: "Outlet or author — Title — URL if available". These are collected mechanically into the citation section, so keep them clean: no HTTP status notes, no page ranges, no commentary.',
      items: { type: 'string' },
    },
  },
}

// status enum rather than a bare boolean: the previous run converted search-budget
// exhaustion into 88 false "refuted" verdicts that were then fed to the section
// writers as an omit-list. UNVERIFIED must never reach that list.
const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'confidence', 'reasoning', 'correction'],
  properties: {
    status: {
      type: 'string',
      enum: ['CONFIRMED', 'CORRECTED', 'REFUTED', 'UNVERIFIED'],
      description: 'CONFIRMED: independently corroborated. CORRECTED: substantially right but a detail/attribution/number is wrong. REFUTED: affirmatively shown false or misattributed. UNVERIFIED: you could not check it (no corroborating source found, search unavailable, or budget exhausted) — this is NOT the same as false.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
    correction: { type: 'string', description: 'For CORRECTED/REFUTED, the corrected version. Empty string otherwise.' },
  },
}

// ---------------------------------------------------------------------------
// Phase: Scope — generate the dish-specific research angles
// ---------------------------------------------------------------------------

phase('Scope')
log(`Scoping research angles for ${DISH} (slug: ${SLUG})`)
log(`Scratch: ${SCRATCH}`)
log(`Output:  ${OUT_PATH}`)

const scoped = await agent(
  `${DISH_BRIEF}

${TOOLING}

You are the lead researcher scoping a definitive culinary research dossier on this dish. Do enough preliminary searching to understand what the dish actually IS, what its genuinely contested questions are, and which authorities matter — then design the research plan.

Propose 8-14 concrete research angles distributed across these five fixed pillars:
  PILLAR 1 — Renowned recipes and authoritative sources. Cover at least these four lenses as separate angles: (a) the dish's own cuisine authorities and acclaimed cookbooks, (b) food-science and test-kitchen voices, (c) native-language / street-level / home-tradition practice, (d) the professional or ancestral lineage the dish descends from.
  PILLAR 2 — Technique deep-dive. Split into 2-4 angles around the techniques that ACTUALLY determine success for THIS dish — the ones where skill, heat, timing or handling decide the outcome. Name them specifically.
  PILLAR 3 — Ingredient analysis. Split into 2-3 angles. One must be the single most confused or most consequential ingredient category in this dish (the thing home cooks substitute wrongly). One must build a MASTER RATIO TABLE normalized across sources. One should chase "secret weapons" — what appears in the best versions that casual recipes omit.
  PILLAR 4 — Regional and stylistic variations, including the documented lineage and how the dish differs by region, era, and restaurant-vs-home context.
  PILLAR 5 — Pitfalls and non-obvious knowledge. At least one angle on the exhaustive failure-mode catalog, and one on knowledge that does not surface in casual recipe search (chef interviews, line-cook accounts, expert forum threads, native-language comment corrections).

Each angle must be a full paragraph of SPECIFIC instruction naming real chefs, real ingredient names (in the native script where relevant), real brands, real techniques and real controversies for THIS dish. Generic instructions like "research the technique" are useless. Keys must be short, kebab-case, and prefixed with the pillar number, e.g. "p2-<technique-name>".

The "pillar" field must be an INTEGER (2), not a string ("2").

Do not propose angles for gluten-free adaptation, equipment, or etymology/history — those are standing side-research slots handled separately.`,
  { label: 'scope-angles', phase: 'Scope', schema: ANGLES_SCHEMA, effort: 'high' }
)

// `pillar` is coerced to a number here. Relational operators coerce strings, so
// a stringified "2" would pass a `>= 1 && <= 5` filter and survive into the
// angle list — but `pillars.indexOf(r.pillar)` in keysFor() is STRICT, so
// [2].indexOf("2") === -1 and the angle would silently vanish from every
// section's read list. Failure would be invisible: no error, just a thin dossier.
const proposed = (scoped && Array.isArray(scoped.angles) ? scoped.angles : [])
  .filter(a => {
    if (!a || !a.key || !a.angle) return false
    const p = Number(a.pillar)
    return Number.isInteger(p) && p >= 1 && p <= 5
  })
  .map(a => ({
    key: String(a.key).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
    pillar: Number(a.pillar),
    angle: a.angle,
  }))

// De-dupe generated keys so raw/<key>.md filenames stay unique.
const keySeen = {}
const dishAngles = []
for (const a of proposed) {
  let k = a.key || ('p' + a.pillar + '-angle')
  if (keySeen[k]) { let n = 2; while (keySeen[k + '-' + n]) n++; k = k + '-' + n }
  keySeen[k] = true
  dishAngles.push({ key: k, pillar: a.pillar, angle: a.angle })
}

// Standing side-research slots — generic across every dish, parameterized by name.
const SIDE = [
  { key: 'side-gf', pillar: 6, angle: `SIDE RESEARCH — GLUTEN-FREE. This site publishes gluten-free variants, so map the gluten in ${DISH} precisely. Where does wheat actually live in this dish — the starch itself, the sauces, the seasonings, a thickener, a coating, a stock base, or a store-bought component? For each wheat-bearing component: the GF substitutes that exist, brand-level and certification-level recommendations, and an HONEST statement of what texture, flavour or colour is lost with each swap. Cover cross-contact risk separately from ingredient risk. Note whether gluten is STRUCTURAL here (dough, pasta, dumplings, bread — implying a separate variant recipe) or merely seasoning-level (implying an inline swap in a single cook). Give GF-specific payoff verdicts. Research the uncompromised dish elsewhere — this angle is the adaptation study, not a narrowing of scope.` },
  { key: 'side-equipment', pillar: 6, angle: `SIDE RESEARCH — EQUIPMENT ADAPTATION for a normal home kitchen. What vessel, heat source, and tools does ${DISH} actually demand, and what does a standard domestic kitchen realistically deliver (assume roughly a 12,000 BTU gas burner, or an induction or glass-top range)? Which professional equipment genuinely changes the outcome and which is theatre? Cover the no-special-equipment fallback path honestly, plus induction/electric strategies, and any purchasable specifics with model names, capacities and cost. Include the handling tools that prevent the dish's signature mechanical failure. Real, purchasable specifics and payoff verdicts only.` },
  { key: 'side-authenticity', pillar: 6, angle: `SIDE RESEARCH — AUTHENTICITY, ETYMOLOGY, and HISTORY of ${DISH}. Trace the documented record: origin, migration, the etymology of the dish's name in its native language and script, when it first appears in print, and how the modern version diverged from the historical one. What do serious food historians and native writers say versus what gets repeated uncritically online? Explicitly flag popular origin claims that are UNVERIFIED or folklore, and separate documented history from received story.` },
]

const RESEARCHERS = dishAngles.concat(SIDE)
log(`Scope produced ${dishAngles.length} dish-specific angles + ${SIDE.length} standing side-research slots = ${RESEARCHERS.length} researchers`)

// ---------------------------------------------------------------------------
// Phase: Research (verification runs inline, per angle)
// ---------------------------------------------------------------------------

phase('Research')

const researched = await pipeline(
  RESEARCHERS,
  (r) => agent(
    `${DISH_BRIEF}

${TOOLING}

SEARCH BUDGET: you share a global web-search budget with a downstream fact-checking team. Be efficient — prefer a smaller number of high-yield searches followed by full page fetches over shotgunning queries. Do not exhaust the budget.

YOUR ASSIGNED ANGLE:
${r.angle}

Research this angle exhaustively. Then write your full raw findings — long-form, detailed, with quotes, numbers, brands, URLs, and payoff verdicts — to the file:
  ${RAW_DIR}/${r.key}.md
(create the directory if needed; use the Write tool). Aim for genuine depth: 1200-2500 words of substance, not a summary. Dense specifics beat length.

Then return the structured object: a summary, your most load-bearing claims ORDERED MOST IMPORTANT FIRST (the top ${VERIFY_PER_ANGLE} will be independently fact-checked, so be precise about attribution), and your clean source list.`,
    { label: `research:${r.key}`, phase: 'Research', schema: FINDINGS_SCHEMA }
  ).then(res => ({ ...r, res })),

  // Guard the whole item, not just its fields: if the stage-1 promise rejects,
  // the harness may hand this stage null/undefined, and destructuring in the
  // parameter list would throw before any internal guard could run.
  (item) => {
    if (!item) return null
    const { res, key } = item
    if (!res || !res.claims || !res.claims.length) return { key, res, verdicts: [] }
    const toCheck = res.claims.slice(0, VERIFY_PER_ANGLE)
    return parallel(toCheck.map((c, i) => () =>
      agent(
        `You are an adversarial fact-checker for culinary research on ${DISH}.

${TOOLING}

CLAIM UNDER REVIEW:
"${c.claim}"

ATTRIBUTED TO: ${c.attribution}
ASSIGNED PAYOFF TAG: ${c.payoff}

Your job is to try to REFUTE this claim. Search independently and check:
1. Is the attribution real? Does that chef/source/book actually say this? Misattribution is the most common failure — verify it.
2. Are any numbers (ratios, temperatures, times, weights) accurate as stated?
3. Is the causal or scientific reasoning sound, or is it folk-wisdom repeated uncritically?
4. Is the payoff tag defensible, or is this a low-impact step being oversold?
5. Does it confuse ${DISH} with a neighbouring dish${IS_NOT.length ? ' — specifically ' + IS_NOT.join('; ') : ''}?

Hold the claim to a high bar: do not mark it CONFIRMED on plausibility alone, only on independent corroboration you actually found.

Report status honestly and precisely:
- CONFIRMED only if you independently corroborated it.
- CORRECTED if it is substantially right but a number, attribution or nuance is wrong — supply the correction.
- REFUTED only if you can affirmatively show it is false or misattributed, and say what the evidence is.
- UNVERIFIED if you simply could not check it — no corroborating source found, a source was blocked, or the search budget was unavailable. "I could not confirm it" is UNVERIFIED, never REFUTED. Do not manufacture a refutation out of your own inability to search.`,
        { label: `verify:${key}#${i + 1}`, phase: 'Research', schema: VERDICT_SCHEMA }
      ).then(v => ({ claim: c, verdict: v }))
    )).then(verdicts => {
      // Filter on the VERDICT, not the wrapper. The wrapper is always truthy
      // even when the checker returned null, so filter(Boolean) here would be
      // dead code and a checker crash would masquerade as an honest UNVERIFIED.
      const good = verdicts.filter(v => v && v.verdict)
      const dropped = verdicts.length - good.length
      if (dropped) log(`WARNING: ${dropped}/${verdicts.length} verifier(s) for ${key} returned nothing — not counted as verified`)
      return { key, res, verdicts: good }
    })
  }
)

// A pipeline item is { key, res, verdicts } — always truthy even when `res` is
// null, so filter(Boolean) would let a null-res item through and the gap prompt
// below would throw on r.res.summary after every research token was spent.
const ok = researched.filter(r => r && r.res)
const allChecked = ok.flatMap(r => (r.verdicts || []).map(v => ({ key: r.key, ...v })))
const statusOf = (c) => (c.verdict && c.verdict.status) || 'UNVERIFIED'
const corrections = allChecked.filter(c => statusOf(c) === 'REFUTED' || statusOf(c) === 'CORRECTED')
const unverified = allChecked.filter(c => statusOf(c) === 'UNVERIFIED')
const confirmed = allChecked.filter(c => statusOf(c) === 'CONFIRMED')
log(`${ok.length}/${RESEARCHERS.length} researchers returned usable findings. ${allChecked.length} claims checked: ${confirmed.length} confirmed, ${corrections.length} corrected/refuted, ${unverified.length} unverified.`)

// ---------------------------------------------------------------------------
// Phase: Gap
// ---------------------------------------------------------------------------

phase('Gap')

const gapReport = await agent(
  `${DISH_BRIEF}

A research team just completed ${ok.length} parallel investigations into ${DISH}. Here is what each angle produced:

${ok.map(r => `### ${r.key}\n${r.res.summary}\nTop claims: ${(r.res.claims || []).map(c => `[${c.payoff}] ${c.claim}`).join(' | ')}`).join('\n\n')}

CORRECTED OR REFUTED CLAIMS (${corrections.length}):
${corrections.map(c => `- (${c.key}) "${c.claim.claim}" [${statusOf(c)}] → ${c.verdict.reasoning}${c.verdict.correction ? ' CORRECTION: ' + c.verdict.correction : ''}`).join('\n') || '(none)'}

CLAIMS THAT COULD NOT BE VERIFIED — these are open questions, not errors (${unverified.length}):
${unverified.map(c => `- (${c.key}) "${c.claim.claim}"`).join('\n') || '(none)'}

You are the completeness critic. Identify what is MISSING. Specifically look for:
- A pillar of the brief that is thin or unevenly covered
- A technique claim that got refuted, leaving a hole that needs re-research
- A load-bearing claim left UNVERIFIED that a different search modality could settle
- A search modality nobody ran (native-language sources, video, forums, academic food science, cookbook text)
- An unresolved disagreement between authorities that needs a tiebreaker
- Anything where the effort-vs-payoff verdict is still genuinely unclear

Return 3 to 6 concrete follow-up research assignments, each a full paragraph of specific instruction — not vague topics. Format as a numbered list, one item per number, each starting with the number followed by a period.

Begin each assignment with a pillar tag in square brackets naming which part of the dossier it belongs to: [P1], [P2], [P3], [P4], [P5], or [SIDE] for gluten-free/equipment/history. Put the tag immediately after the number, e.g. "1. [P2] Investigate...". This routes your finding to the right section writer.

If coverage is genuinely complete in some area, do not manufacture work for it.`,
  { label: 'gap-analysis', phase: 'Gap', effort: 'high' }
)

let followups = String(gapReport || '')
  .split(/\n(?=\s*\d+[\.\)])/)
  .map(s => s.trim())
  .filter(s => /^\d+[\.\)]/.test(s) && s.length > 120)
  .slice(0, 6)

// The old parser failed silently when the critic returned prose. Fall back to
// paragraph splitting so the gap round never no-ops without warning.
if (!followups.length) {
  log('WARNING: numbered-list parse of the gap report failed; falling back to paragraph split')
  followups = String(gapReport || '')
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 200)
    .slice(0, 4)
}
log(`Completeness critic identified ${followups.length} gaps — launching round 2`)

// Route each gap file to the section that actually needs it, so all six section
// writers do not ingest all six gap files and duplicate the same findings.
const gapPillarOf = (text) => {
  const m = String(text).match(/\[\s*(P\s*[1-5]|SIDE)\s*\]/i)
  if (!m) return null
  const tag = m[1].replace(/\s+/g, '').toUpperCase()
  return tag === 'SIDE' ? 6 : Number(tag.slice(1))
}
const gapRoutes = followups.map((f, i) => ({ file: `gap-${i + 1}`, pillar: gapPillarOf(f) }))
const untagged = gapRoutes.filter(g => g.pillar === null).map(g => g.file)
if (untagged.length) log(`NOTE: ${untagged.length} gap assignment(s) carried no pillar tag; they will be offered to every section writer`)

const round2 = await parallel(followups.map((f, i) => () =>
  agent(
    `${DISH_BRIEF}

${TOOLING}

You are a round-2 researcher filling a specific gap the completeness critic identified after the first research sweep on ${DISH}:

${f}

Research it thoroughly and write your findings to ${RAW_DIR}/gap-${i + 1}.md (use the Write tool — that exact filename, since the section writers are told to read specific gap files by name). Keep it to 1000-2000 words of dense specifics. Then return your structured findings.`,
    { label: `gap-fill:${i + 1}`, phase: 'Gap', schema: FINDINGS_SCHEMA }
  )
))
const round2ok = round2.filter(Boolean)
log(`Round 2 complete: ${round2ok.length}/${followups.length} gaps filled`)

// ---------------------------------------------------------------------------
// Phase: Sections
// ---------------------------------------------------------------------------

phase('Sections')

const CORRECTIONS_NOTE = corrections.length
  ? `\n\nIMPORTANT — THESE CLAIMS WERE FACT-CHECKED AND FOUND WRONG OR IMPRECISE. Do NOT repeat them as stated; use the correction, or omit them:\n${corrections.map(c => `- "${c.claim.claim}" → ${c.verdict.reasoning}${c.verdict.correction ? '\n  CORRECTED: ' + c.verdict.correction : ''}`).join('\n')}`
  : ''

const UNVERIFIED_NOTE = unverified.length
  ? `\n\nTHESE CLAIMS COULD NOT BE INDEPENDENTLY CONFIRMED. They are not known to be wrong — do NOT omit them. Include them where relevant, attribute them cautiously to whoever asserted them, and mark them UNVERIFIED inline:\n${unverified.map(c => `- "${c.claim.claim}" (asserted by ${c.claim.attribution})`).join('\n')}`
  : ''

// Section reads are DERIVED from the generated angle keys, not hardcoded, and
// gap files are routed by their pillar tag rather than handed to everyone.
const keysFor = (pillars) => {
  const list = RESEARCHERS.filter(r => pillars.indexOf(r.pillar) !== -1).map(r => r.key)
  const gaps = gapRoutes
    .filter(g => g.pillar === null || pillars.indexOf(g.pillar) !== -1)
    .map(g => g.file)
  const all = list.concat(gaps)
  return all.length ? all.join(', ') : '(none)'
}

const SECTIONS = [
  { n: '01', key: 'part1', title: `PART 1 — Renowned Recipes & Authoritative Sources`,
    reads: keysFor([1]) + ', side-authenticity',
    spec: `Write a chef-by-chef / source-by-source breakdown in the style of a rigorous research dossier. For each major authority: their credentials, their exact approach, distinguishing ingredients and ratios, and what sets them apart. Quote cookbook authorities verbatim ONLY where the raw findings supply a verified quote, and carry a page number ONLY if the raw findings recorded one as actually retrieved — otherwise attribute to the intermediary with no page number. Quote native-language sources in the original script with an English rendering. Then a "Consensus Across Top Sources" subsection and a separate "Disagreements & Divergences" subsection that names who is on each side and weighs the evidence rather than averaging it. Close with a short documented-history and etymology subsection that clearly separates documented history from folklore.` },
  { n: '02', key: 'part2', title: `PART 2 — Technique Deep-Dive`,
    reads: keysFor([2]) + ', side-equipment',
    spec: `One subsection per technique the research identified as decisive, covering the mechanism (physically, why it works) and the honest home reproduction. Cover heat management, timing, sequencing and batch sizing across the whole cook. Every technique gets its [HIGH/MODERATE/LOW/DISPUTED PAYOFF] tag, a justification, and an explicit cost line. Include a final "Technique Payoff Ranking" table ordering every technique by taste-improvement-per-unit-effort — this table is the single most valuable artifact in the document.` },
  { n: '03', key: 'part3', title: `PART 3 — Ingredient Analysis`,
    reads: keysFor([3]),
    spec: `Lead with a rigorous disambiguation table for the dish's most-confused ingredient category (type, native name, role, what breaks if substituted, recommended brands). Then the remaining ingredients, aromatics and sugars. Then the MASTER RATIO TABLE compiled across sources and normalized to one common portion size, with a stated consensus ratio and the full spread attributed source by source — show the range, never just an average. Then a "Secret Weapons" subsection with honest payoff verdicts, explicitly calling out which are worth it and which are cargo cult.` },
  { n: '04', key: 'part4', title: `PART 4 — Regional & Stylistic Variations`,
    reads: keysFor([4]) + ', side-authenticity',
    spec: `Native/street version vs the export or restaurant version (be specific about what changed and why). The documented lineage and immigrant or regional history. The dish family: how this dish relates to and differs from its closest siblings. Regional treatments, era differences, restaurant-vs-home differences, modern chef reinterpretations, and protein or component conventions by region.` },
  { n: '05', key: 'part5', title: `PART 5 — Pitfalls, Pro Tips & Non-Obvious Knowledge`,
    reads: keysFor([5]),
    spec: `A lettered, exhaustive failure-mode catalog (A1, A2, ...) ordered by how frequently the failure actually occurs. Each failure gets the MECHANISM (why it happens, physically) and the FIX that authorities cite. Then a "Non-Obvious Pro Knowledge" subsection of things recipe writers omit. Then "Contrarian Takes With Real Backing." Then a short "If you only do one thing" list, attributed per authority.` },
  { n: '06', key: 'part6', title: `PART 6 — Gluten-Free Adaptation, Equipment & Storage`,
    reads: keysFor([6]),
    spec: `A complete GF conversion guide: where the gluten actually is, a component-by-component conversion table, brand-level and certification-level recommendations, cross-contact risk handled separately from ingredient risk, and an honest statement of what is lost with each swap plus GF-specific payoff verdicts. State explicitly whether gluten is structural here (arguing for a separate variant recipe) or seasoning-level (arguing for an inline swap within one cook), and if inline, give cook-order and cross-contamination guidance. Then equipment adaptation for a standard home kitchen with real purchasable specifics and payoff verdicts, including the no-special-equipment path. Close with storage, reheating, make-ahead and freezing behaviour.` },
]

const written = await parallel(SECTIONS.map(s => () =>
  agent(
    `You are writing one part of a definitive culinary research dossier on ${DISH}. A separate synthesis agent will later turn this dossier into a recipe — so your job is RAW FINDINGS, richly organized. Do NOT write a finished recipe.

Read the raw research files in ${RAW_DIR}/ — specifically these and ONLY these: ${s.reads}. Use Glob to confirm which exist, then Read them fully. Do not read the whole directory.

Write: ${s.title}

SPEC: ${s.spec}

STYLE: Match a rigorous research report — markdown headings (H2 for the part, H3 for subsections, never deeper), bold lead-ins on claims followed by the evidence in plain prose, and tables wherever the data is tabular. Attribute sources inline in prose, parenthetically or in bold; do NOT use blockquotes and do NOT paste bare URLs into the body — a consolidated citation section is assembled separately. Preserve specific numbers, ratios, timings and brand names from the raw findings; do not sand them down into generalities.

LENGTH: 900-1600 words. This is a hard cap. Six parts plus the closing sections must total under 7,000 words to match the house corpus, so density matters far more than length. Cut restatement, not specifics.

CROSS-CUTTING MANDATE: the cook is willing to work hard IF it improves taste, but wants no ritual complexity that adds little. Tag techniques and upgrades [HIGH PAYOFF] / [MODERATE PAYOFF] / [LOW PAYOFF / SKIPPABLE] / [DISPUTED], justify each, and pair each with a cost line.${CORRECTIONS_NOTE}${UNVERIFIED_NOTE}

Start the file with the heading "## ${s.title}" and write it to ${SEC_DIR}/${s.n}-${s.key}.md using the Write tool. Return only the word count and a one-line note on what you covered.`,
    { label: `write:${s.key}`, phase: 'Sections' }
  )
))
log(`Sections written: ${written.filter(Boolean).length}/${SECTIONS.length}`)

// ---------------------------------------------------------------------------
// Phase: Assemble
// ---------------------------------------------------------------------------

phase('Assemble')

// Citations are built in plain JS from the structured `sources` arrays the
// researchers already returned. NOTE the data-shape asymmetry: pipeline stage 2
// wraps results as { key, res, verdicts }, so sources live at r.res.sources,
// while round2 is a bare parallel() of agent() so its sources live at r.sources.
const rawSources = [
  ...ok.flatMap(r => (r.res && Array.isArray(r.res.sources)) ? r.res.sources : []),
  ...round2ok.flatMap(r => Array.isArray(r.sources) ? r.sources : []),
]

const seen = new Map()
for (const s of rawSources) {
  let t = String(s || '').trim()
  if (!t) continue
  // strip fetch-status noise and trailing punctuation
  t = t.replace(/\s*[\(\[]?\s*(HTTP\s*\d{3}|geo-?blocked|paywalled|fetch(er)?[- ]blocked|403|402|429|500)\b[^\)\]]*[\)\]]?\s*$/i, '').trim()
  t = t.replace(/[.,;:\s)]+$/, '').trim()
  if (!t) continue
  const urlMatch = t.match(/https?:\/\/[^\s)\]]+/)
  const key = urlMatch
    ? urlMatch[0].replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase()
    : t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!key) continue
  if (!seen.has(key)) seen.set(key, t)
}
const deduped = [...seen.values()]
const citationInput = deduped.slice(0, MAX_SOURCE_LINES)
const truncatedCount = deduped.length - citationInput.length
log(`Citations: ${rawSources.length} raw source lines → ${deduped.length} unique after dedup${truncatedCount ? ` (feeding first ${citationInput.length}, ${truncatedCount} truncated)` : ''}`)

const [architecture, citations] = await parallel([
  () => agent(
    `You are the lead researcher closing out a dossier on ${DISH}. Read ONLY the six numbered part files ${SEC_DIR}/01-part1.md through ${SEC_DIR}/06-part6.md (Glob "0[1-6]-*.md" in that directory, then Read each) so you know exactly what the dossier establishes. Do not read anything else in that directory — a citations file is being written there concurrently and is not yet complete.
${NOTES ? `\nCOOK'S CONSTRAINTS AND CONTEXT:\n${NOTES}\n` : ''}
Then write TWO closing sections to ${SEC_DIR}/07-architecture.md:

## PART 7 — Recommended Recipe Architecture
A structural recommendation for the synthesis agent — NOT a finished recipe, and NOT formatted as one. Cover: the recommended core ratio to build from and why; the recommended main components and their treatment; the recommended fallback when the ideal ingredient is unavailable; the recommended equipment path; the exact recommended order of operations as a numbered skeleton with target times; the 3-5 decisions that most determine whether this dish succeeds; and a difficulty calibration discussion naming where the difficulty actually sits and warning against miscalibrating it in either direction.

## PART 8 — The Effort/Payoff Verdict
The document's thesis section. Open with a ranked payoff table (columns: Rank, Move, Verdict tag, Taste delta per unit effort, Cost). Then two explicit lists:
- **Worth The Work** — ranked by taste-improvement per unit of effort, each with the evidence and an explicit "Cost:" line
- **Skip It** — steps that are traditional, widely repeated, or intuitively appealing but contribute little for a home cook, each with why
Close with "The verdict in one paragraph." Be opinionated and evidence-backed. This directly answers the cook's stated constraint.

Keep the two parts together under 1,400 words. Return only a one-line confirmation.`,
    { label: 'architecture', phase: 'Assemble', effort: 'high' }
  ),
  () => agent(
    `Below is a PRE-DEDUPLICATED list of ${citationInput.length} sources gathered during research on ${DISH}${truncatedCount ? ` (${truncatedCount} further sources were truncated from this list and should simply be ignored)` : ''}. Your only job is to categorize and format it. Do NOT search, do NOT read any files, do NOT add, infer, or invent any source or URL that is not in this list.

Write a "## Source Citations" section to ${SEC_DIR}/08-citations.md, grouped under these category headings (omit any category that ends up empty, and add at most one extra category if a cluster genuinely fits none of them):
- Cuisine Authorities & Cookbooks
- Food Science & Test Kitchens
- Native-Language & Regional Sources
- Professional & Restaurant Lineage
- Expert Communities & Forums
- Product & Brand References

RULES:
- GROUP BY ENTITY. One numbered entry per author or outlet, listing that entity's works together on the same entry. Never give the same outlet two entries — if "The Woks of Life" or a Wikipedia page appears twelve times, that is ONE entry.
- Keep each entry to roughly 12 words: author or outlet, a short credential or context, and title. Drop ISBNs, page ranges, retrieval dates, and any fetch-status or HTTP noise.
- House style carries attribution in the entry text rather than as raw links. Cite outlet name and title; include a bare domain rather than a full URL where the URL adds nothing.
- HARD CAP: ${MAX_CITATIONS} entries and 1,200 words total. If the list exceeds that after entity-grouping, drop the lowest-authority general-interest entries first and note how many were omitted.

SOURCE LIST:
${citationInput.join('\n')}

Return only the count of unique entities you produced.`,
    { label: 'citations', phase: 'Assemble' }
  ),
])

const finalDoc = await agent(
  `Assemble the final ${DISH} research document.

0. SAFETY CHECK FIRST: if "${OUT_PATH}" already exists, do NOT overwrite it. Stop and report that it exists so the user can decide. Only proceed if it is absent.
1. List ${SEC_DIR}/ and confirm which numbered files exist (01 through 08).
2. Using the Bash tool, concatenate them IN NUMERIC ORDER into "${OUT_PATH}", with a blank line and a "---" separator between sections. Quote every path — they contain spaces. Create the target directory if needed.
3. Prepend a house-style opening at the very top of the file, in this exact shape:
   - a single H1 that is a descriptive, sentence-case editorial title (for example "The definitive research dossier on ${DISH}") — never the slug, and never "# Research: ${SLUG}"
   - a blank line
   - a bolded "**Bottom line:**" thesis paragraph of two to four sentences stating the dossier's central conclusion up front, including where the authorities most sharply disagree and the single highest-payoff move the research identified
   - a blank line, then "---"
4. For house-style reference, read the first ~80 lines of "${REPO}/public/research/louisiana-chicken-andouille-gumbo.md" and "${REPO}/public/research/potato-leek-soup.md". Match their conventions: exactly one H1 in the whole document, sentence-case headings (never SCREAMING CAPS), H1/H2/H3 only, no emoji, no blockquotes, no admonition syntax, bold on the claim with evidence in the prose after it, and "---" rules between top-level sections. Do NOT use "${REPO}/public/research/pad-see-ew.md" as a reference — it is the known-bad outlier.
5. Read the head and tail of the assembled file plus each seam between sections, and fix any broken seams, duplicated or repeated headings, stray agent commentary, or orphaned "Return only..." / word-count artifacts. Do not rewrite the substance — only repair the seams.
6. Add a short "## Caveats" section immediately before the Source Citations section: rate the confidence of the dossier's main conclusions, flag anything marked UNVERIFIED, note any speculation, and record retrieval failures (blocked hosts, exhausted search budget) if the raw findings mention them. Then confirm in one sentence that this document is structured findings only and not a recipe.
7. MEASURE, do not estimate: run "wc -w" and "wc -l" on the finished file via the Bash tool and report the actual numbers. The hard ceiling is 7,000 words. If the assembled document exceeds about 7,500 words, do a compression pass that cuts restatement and hedging while preserving every number, ratio, brand, name and payoff verdict, then re-measure and re-report. There is no minimum — do not pad a short dossier to hit a target.
8. Report the string the recipe frontmatter will need in stage 2: research: "/research/${SLUG}.md"

Do NOT commit to git. Do NOT create the .mdx recipe file. Do NOT add an image. Research artifact only.`,
  { label: 'assemble-final', phase: 'Assemble', effort: 'high' }
)

return {
  dish: DISH,
  slug: SLUG,
  output: OUT_PATH,
  researchField: `/research/${SLUG}.md`,
  scratch: SCRATCH,
  anglesGenerated: dishAngles.length,
  researchers: ok.length,
  claimsChecked: allChecked.length,
  confirmed: confirmed.length,
  correctedOrRefuted: corrections.length,
  unverified: unverified.length,
  gapsFilled: round2ok.length,
  sections: written.filter(Boolean).length,
  uniqueSources: deduped.length,
  citations,
  architecture,
  final: finalDoc,
  correctionDetail: corrections.map(c => ({ angle: c.key, claim: c.claim.claim, status: statusOf(c), why: c.verdict.reasoning, correction: c.verdict.correction })),
}
