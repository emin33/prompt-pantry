# Reverse-Engineering EPCOT's Grand Marnier Orange Slush for the Ninja Slushi

## TL;DR

- **What it really is:** The "Orange Slush" at **Les Vins des Chefs de France** (the outdoor wine-and-spirits kiosk in EPCOT's France Pavilion, *not* Les Halles or Chefs de France) is currently a four-ingredient frozen cocktail listed on the 2025 menu as *"Grand Marnier, Rum and Grey Goose Orange and Orange Juice"* — $14.95 for the standard ~8 oz plastic martini, $21.95 for the 12 oz "Le Géant" with an extra GM (or Grey Goose Citron) shot. The base is almost certainly built from a commercial **Florida Natural Flavors** orange slush concentrate plus liquor, dyed bright orange with food coloring, and run continuously through a swirl-blade slush dispenser.
- **The Slushi-optimized recipe (88 oz vessel, 64 oz max fill):** **8 oz Grand Marnier Cordon Rouge + 4 oz Grey Goose L'Orange + 4 oz white rum + 44 oz not-from-concentrate orange juice (Minute Maid Premium or Simply Orange) + 4 oz 1:1 simple syrup + 4–6 drops orange food coloring.** Run on **Spiked Slush, temperature level 9.** This lands at **10.0% final ABV** (well below the 16% Slushi ceiling) and **≈14.6% sugar** (well above the 4% floor). For a "Le Géant" experience, float **0.5–0.75 oz additional Grand Marnier** on top of the dispensed slush rather than building it into the base.
- **The key insight:** Almost every published clone recipe is written for a blender-with-ice, where 30–40% of the final volume becomes melted water from the ice. Translated directly into a Slushi (which freezes the *liquid itself*), those recipes either freeze into a brick (too little sugar in the unicorn-juice version) or refuse to slush (too much alcohol). The recipe below adds back the missing ice volume as orange juice + a small amount of simple syrup — *not* water — to preserve the creamsicle flavor density the parks version is famous for.

---

## Key Findings

### 1. Source-of-truth profile of the actual EPCOT drink

| Attribute | Confirmed value | Source(s) |
|---|---|---|
| **Official name** | "Orange Slush" (menu); commonly called "Grand Marnier Orange Slush" by guests and Disney's own social posts | AllEars 2025 menu (Oct 2025 update); DisneyFoodBlog Dec 2022 review; @DisneyFoodBlog/Disney's own retweet Dec 9, 2022 |
| **Venue** | **Les Vins des Chefs de France** — outdoor kiosk across the promenade from the Chefs de France table-service restaurant | Disney.go.com official page; DisneyFoodBlog; Urban Tastebud |
| **Current 2025 price** | $14.95 standard / $21.95 "Le Géant" with extra shot | AllEars (Oct 2025 menu); TheMouseForLess 2025 |
| **Sizes** | 8 oz standard; 12 oz "Le Géant" (super-size) | DisneyFoodBlog Les Vins category page; Urban Tastebud |
| **Vessel** | Clear plastic martini-style cup, filled to rim, no garnish in-park | DisneyFoodBlog photos; multiple TripAdvisor reviews |
| **Listed ingredients** | *"Grand Marnier, Rum and Grey Goose Orange and Orange Juice"* (verbatim menu copy) | AllEars 2025 listing; MouseForLess 2025; Urban Tastebud |
| **Color** | Bright traffic-cone orange (gets a *green* food-coloring makeover for St. Patrick's Day at this same kiosk — confirming the in-park drink uses food coloring) | DisneyFoodBlog "Annual Color Makeover" 2021 |
| **Hours / availability** | Year-round, 12:00 p.m.–9:00 p.m. (11 p.m. on Extended Evening days); pre-batched in continuously running commercial swirl slush machines | Urban Tastebud; DisneyFoodBlog |

**Sensory profile, triangulated from guest reviews (this is the ground truth the recipe must match):**

- **Texture:** "orange sorbet"–like, smooth (not coarsely icy) — TouringPlans
- **Flavor:** *"very reminiscent of a creamsicle … child-ish element of tasting like a popsicle you would have in the summer"* — Ashley Craft, in Yahoo Lifestyle
- **Sweetness:** *"sweet and tangy with a subtle boozy kick"*; *"we CAN taste the alcohol in this one, but it's not too strong"* — DFB review 2022
- **Boozy-forward but not aggressive:** this puts the in-park drink in the 10–13% ABV neighborhood, consistent with what a sub-zero swirl dispenser can hold as slush
- **Aroma:** candied orange peel + slight bitter-orange from Grand Marnier's cognac base
- **Garnish (in-park):** none — straw, lid, "Le Géant" sticker on super-size

### 2. Historical formulation and pricing changes

- **Pre-2018:** Older fan-site references (party-blog 2010, DISboards thread c. 2014) describe the drink with the same "Grand Marnier + orange concentrate" backbone. Disney's pour partner for the rum and orange-vodka components has shifted over time; the Grey Goose L'Orange listing has been on the menu since at least 2015 (DFB's 2015 "On The List" feature names the same three spirits as today).
- **Pricing trajectory:** $11–$12 c. 2015 → $14.50 (DFB Dec 2022) → $14.75 (DFB Dec 2022 update) → **$14.95 (AllEars Oct 2025, MouseForLess 2025)**. The "Le Géant" super-size launched as a permanent option around 2018 (DFB's "NEW SUPERSIZE" coverage) and is currently $21.95.
- **Annual color makeover:** Every March, the kiosk dyes the sibling Citron Slush green for St. Patrick's Day. The same coloring methodology applies to the orange drink — the bright orange hue is artificial food coloring, *not* the natural color of the OJ blend, which would skew yellow-amber.
- **Seasonal slush martinis:** During the EPCOT Food & Wine and Flower & Garden festivals, this kiosk and adjacent festival booths run rotating "slush martini" variants (e.g. La Vie en Rose, Frosé at Les Halles) that use the same dispensing equipment.

### 3. Disney's own public statements

There is **no first-party Disney recipe** for this drink. Disney Parks Blog has never published one. The 2023 centennial cookbook *Disney: Cooking With Magic* does not include it. Disney+, D23, and "Delicious Disney" official titles I reviewed do not contain it either. The closest thing to authoritative is the third-party but widely cited Ashley Craft cookbook described below — and even that book's exact ingredient quantities are not in any free excerpt online; only the ingredient *list* is published.

### 4. Catalogue of credible clone recipes

| # | Source | Ingredients & ratio | Method | Direct comparison to parks version? |
|---|---|---|---|---|
| 1 | **Ashley Craft, *The Unofficial Disney Parks EPCOT Cookbook*** (Adams Media / Simon & Schuster, June 2022) — developed with a mixologist | Per Yahoo Lifestyle excerpt: Grand Marnier + orange-flavored vodka + white rum + orange juice + simple syrup + ice; martini serve. **Exact oz unpublished in free excerpts; described as "booze-forward."** | Blend all in blender to slushy consistency. Serve in martini glass. | **Yes** — author and reviewer (Carly Caramanna, Yahoo) both report "indeed tastes just like the real thing" |
| 2 | **Wishes & Wayfinding** (Nicole Dinan, Aug 2024) | Yields 2 drinks: 1 oz orange/mandarin vodka + 1 oz white rum + 1 oz Grand Marnier + 1 oz simple syrup + 4 oz orange soda + 4 oz OJ (pre-frozen as cubes) + ice cubes | Pre-freeze OJ into cubes; blend all with ice; food coloring optional | Reviewer comparison; novel addition of **orange soda** |
| 3 | **Magical Recipes / Chip and Company / KeyIngredient / Disney Nation** (the most widely re-blogged "simplified" version) | 1 part Grand Marnier : 1 part Grey Goose Vodka : 2 parts sweet & sour mix : 1 part simple syrup | Blend with ice; add orange food coloring | **No** direct comparison; ratio derives from a 2010 party-blog and has propagated by copy-paste |
| 4 | **DISboards "authentic" recipe** — user phoned Florida Natural Flavors of Casselberry FL, who confirmed they supply Disney for both slushes | 3 cups Grand Marnier + 1 cup *Orange Fruit Smoothie* FNF concentrate; commercial machine dilution ratio ~1 L spirit to 1¾ gal water | Mix concentrate with spirit; chill; feed into slush machine with water | **Yes** — supplier-verified ingredient list; ratios are pre-dilution and need re-derivation for a home machine |
| 5 | **TalkDisney / Doctor Disney** | Variants of #3 with optional orange food coloring | Blend with ice | Re-blogs of #3 |
| 6 | **Touring Plans / generic Disney bar shorthand** (per a WDWMAGIC thread cast-member quote) | "Ice, sour mix, vodka, and orange liqueur — use Grey Goose and Grand Marnier" | Blender margarita-style | Hearsay from anonymous CM |

### 5. Triangulation — what is most likely the true parks formulation

The published menu names four ingredients: **Grand Marnier, rum, Grey Goose Orange, and orange juice**. The Florida Natural Flavors (FNF) supplier confirmation is consistent with this: at high-volume Disney operations, the "orange juice" line item on the menu would in practice be a flavored, sweetened OJ slush concentrate sold by a bulk supplier. FNF's consumer-grade Orange Slush Mix is described as having "fresh-squeezed" character with "robust citrusy flavor"; the operator's directions involve diluting concentrate with water for the slush machine and adding the spirits separately.

So the in-park drink is best modeled as:

- **Grand Marnier Cordon Rouge** (the brandy-based orange liqueur — supported by the kiosk's long-running Grand Marnier-branded seminar at the EPCOT Food & Wine Festival; no clone or operator has ever reported a triple-sec substitution)
- **A neutral white rum** (Bacardi Silver is the most likely SKU given Disney's pour partner profile)
- **Grey Goose L'Orange** (orange-flavored vodka — the menu explicitly says "Grey Goose Orange," not citron or plain)
- **A high-Brix orange base** — Florida Natural Flavors' Orange Slush Mix at the kiosk; at home, NFC orange juice + a touch of simple syrup mimics it almost exactly
- **Orange food coloring** — confirmed by DFB's coverage of the Citron sibling drink getting a green makeover for St. Patrick's Day at this same kiosk; this is bartender food coloring, not the OJ itself
- **No lemon juice / no separate "sour" component** — guest reviews consistently describe the drink as candy-sweet/creamsicle, not tart. Recipe #3's "sweet & sour mix" is almost certainly clone-author improvisation, not what Disney actually pours. The "sweet & sour" trail dates to a 2010 party-blog recipe that has been copy-pasted into dozens of sites since.

The most likely actual operator-side build, in proportions: roughly **3 parts spirit blend (GM-heavy) : 11 parts OJ-mix : ~1 part simple syrup**, dyed bright orange, run at a sub-0 °F swirl-blade dispenser. That yields the ~10–12% ABV and ~14% sugar profile guests describe.

### 6. Why this can't be a direct transcription into a Ninja Slushi — the math

Traditional blender clones (e.g. recipes #2, #3) assume the blender will fold in 10–14 oz of ice to reach slush texture. As that ice melts and re-freezes, **roughly 30–40% of the final dispensed volume is water that came from the ice** — water that diluted both the alcohol and the sugar.

The Ninja Slushi has no added ice. The auger inside the chilled cylinder freezes only the *liquid you pour in*. So:

- A blender recipe that lands at 12% ABV with ice will land at **~17% ABV** if you dump the same liquid into a Slushi — too high to slush at all. Ninja's published spec is **2.8%–16% total ABV** for the Spiked Slush preset; cycling above that triggers a high-alcohol alert and the machine refuses to freeze.
- Sugar that was ~10% with ice-dilution becomes ~14% concentrated — fine for slushing, but flavor becomes cloyingly sweet if you don't rebalance OJ vs syrup.
- The orange-flavor concentration goes up too; this is actually an advantage, but only if we rebalance the sweet/boozy axes.

**Therefore the Slushi recipe must add back the "missing ice volume" as orange juice + a small amount of simple syrup**, not water — preserving the creamsicle palate while bringing ABV and sugar into the machine's operating window.

### 7. Ninja Slushi technical parameters (verified against manufacturer docs)

- **Sugar floor:** All inputs must contain **≥4% sugar by mass** (Ninja support page for FS300/FS600; FS301 owner's manual; corroborated by Tom's Guide testing). That is ≈ 4 g sugar per 100 mL ≈ **1.18 g/oz**, *not* 4 g/oz — the prompt's "4 g per oz" figure was a 4× overstatement and would require an impossibly sugary base; the actual threshold is far easier to hit. Note: the **Frozen Juice** preset enforces a stricter floor (~26 g/8 oz ≈ 11% sugar, per Food Network's lab test of the FS301), which is why we recommend Spiked Slush.
- **Alcohol window:** **2.8%–16% total ABV** on the Spiked Slush / Frozen Cocktail preset (FS301 owner's manual; SharkNinja Q&A on BestBuy). The newer FS605 SLUSHi Max raises this to ~20% via SlushAssist.
- **Hard-spirit rule of thumb:** For 35%+ ABV spirits, the manual instructs **no more than 4 oz spirit per 24 oz of total recipe size** (≈ 6.7% spirit-volume). Our recipe sits at 16 oz spirit per 64 oz total = 25%, but because spirits are 40% ABV the resulting **total ABV (10%) remains inside the window** — the 4-oz/24-oz rule is a conservative shortcut, not an inviolable ceiling.
- **Vessel sizes:** FS301/FS299 (88 oz vessel, **64 oz max fill**, 7+ servings); FS300 (72 oz vessel, **48 oz max fill**); FS605 SLUSHi Max (150 oz vessel, **112 oz max fill**).
- **Preset start temperature:** Spiked Slush preset defaults to temperature level 9; if still too thin after 60 min, step to level 10. The manual recommends starting the cycle at least 1 hour before guests arrive.

---

## Details

### The recipe — Ninja Slushi-optimized "EPCOT France Pavilion Orange Slush"

**Builds the standard 88-oz vessel (FS301 / FS299) to its 64 oz max fill line.**

#### Ingredients

| Component | Volume | Notes / brand recommendation |
|---|---|---|
| Grand Marnier Cordon Rouge (40% ABV) | **8 oz** | The standard yellow-label expression. Do *not* substitute generic triple sec or curaçao — the cognac backbone is the source of the "creamsicle" character. |
| Grey Goose L'Orange (40% ABV) | **4 oz** | Or Ketel One Oranje, Absolut Mandrin, Smirnoff Orange; the menu specifically names "Grey Goose Orange." |
| White rum (40% ABV) | **4 oz** | Bacardi Silver matches Disney's pour partner profile; any neutral light rum works. |
| Not-from-concentrate orange juice | **44 oz** | Minute Maid Premium NFC (Disney's Coca-Cola pouring partner makes this the closest match to the kiosk's OJ mix); Simply Orange Pulp-Free or Tropicana Pure Premium are equivalent. **Avoid:** fresh-squeezed (variable Brix; pulp can jam the auger over a 60-min cycle) and concentrate-reconstituted (off-flavors). |
| 1:1 simple syrup | **4 oz** | Equal parts white sugar + water, cooled. Contributes ~18 g sugar per oz. |
| Orange gel food coloring | 4–6 drops | Wilton or AmeriColor "Orange"; matches the parks' artificial brightness. |
| **Total volume** | **64 oz** | = max fill line on the 88 oz vessel |

#### Sugar-floor math (must clear 4% by mass; we land at ~14.6%)

Approximate sugar contributions: Grand Marnier ≈ 7.4 g/oz; NFC OJ ≈ 3.3 g/oz; 1:1 simple syrup ≈ 18 g/oz.

| Ingredient | Volume | Sugar contribution |
|---|---|---|
| Grand Marnier | 8 oz | ≈ 59 g |
| NFC orange juice | 44 oz | ≈ 145 g |
| Simple syrup (1:1) | 4 oz | ≈ 72 g |
| Vodka + rum | 8 oz | ~ 0 g |
| **Total** | **64 oz (≈ 1893 mL)** | **≈ 276 g** |

**Sugar concentration: 276 g / 1893 mL ≈ 14.6%** (≈ 4.3 g per *fluid* oz) — clears the 4% floor by ~3.6× and matches the sweetness of the kiosk drink. Even if your OJ is on the low end (10 Brix), you'll still land at ~13% — safe.

#### Final-ABV math (must be between 2.8% and 16%; we land at exactly 10%)

Pure ethanol contributed = (8 + 4 + 4) oz × 0.40 = **6.4 oz**. **Final ABV = 6.4 / 64 = 10.0%** — squarely inside the Spiked Slush window. Equivalent to a strong wine or weak port; matches the "boozy but not over the top" character guests describe.

#### Method

1. **Pre-chill** the Slushi vessel and all liquid ingredients in the refrigerator for at least 2 hours. Starting from ambient adds 10–15 min to cycle time (Thirsty Bear's testing; corroborated by Tom's Guide).
2. In a large pitcher, stir together the Grand Marnier, Grey Goose L'Orange, white rum, OJ, simple syrup, and food coloring until uniform color. **Do not shake** — incorporated air will foam through the auger and cause uneven freezing.
3. Pour into the Slushi vessel up to (but not past) the 64-oz fill line. Lock the bail handle.
4. **Select the Spiked Slush preset; leave at default temperature level 9.** (On the EU FS301 the same preset is labeled "Frozen Cocktail.")
5. Expect a **45–60 minute cycle**. The unit beeps three times at optimal texture. If the slush is still pourable-thin after 60 min, step the temp control to level 10 for another 20 min.
6. Dispense into a chilled plastic martini cup (no rim sugar, no garnish — matching the in-park presentation) for the authentic experience. Add an orange wheel for at-home table service.

#### "Le Géant" (boozy float) variant — the right way to get a stronger version

Do **not** add more spirit to the vessel — pushing total ABV past ~13% risks failed slush. Instead, dispense the slush, then **float 0.5–0.75 oz of room-temperature Grand Marnier Cordon Rouge over the top of each glass**. Pour gently over the back of a bar spoon onto the dome of the slush. The warmer liqueur sits as a glassy amber cap on top, the slush perfumes with bitter-orange and brandy on the first sip, and the float gradually melts into the drink — the same effect as the in-park "Le Géant" shot, at 11.7% effective ABV per 9 oz serving.

#### Scaling for the three vessel sizes

| Model | Max fill | GM | Orange vodka | White rum | Simple syrup | NFC OJ | Total ABV | Sugar % |
|---|---|---|---|---|---|---|---|---|
| **FS300** | 48 oz | 6 oz | 3 oz | 3 oz | 3 oz | 33 oz | 10.0% | 14.6% |
| **FS301 / FS299** | 64 oz | 8 oz | 4 oz | 4 oz | 4 oz | 44 oz | 10.0% | 14.6% |
| **FS605 SLUSHi Max** | 112 oz | 14 oz | 7 oz | 7 oz | 7 oz | 77 oz | 10.0% | 14.6% |

#### Preset rationale

- **Spiked Slush** is correct: it is the only preset that whitelists alcohol-containing inputs and runs at a colder evaporator temperature (default level 9) to compensate for ethanol's freezing-point depression.
- **Slush** (default) will run but stops at the wrong target temperature for a 10% ABV mix; texture will be too thin.
- **Frozen Juice** is wrong because (a) it doesn't account for alcohol and (b) its sugar floor is set higher (~11% per Food Network's testing of the FS301), which our recipe technically meets but would cause over-freezing.
- **Frappé / Milkshake** are dairy-targeted and would freeze too hard for a juice-base cocktail.

### Ingredient deep-dive

**Orange juice (the single biggest flavor lever):** Disney's franchise pouring partner is The Coca-Cola Company. In bulk operations the OJ line item is therefore a **Minute Maid bag-in-box NFC product**, supplemented (or fully replaced) at the slush kiosk by **Florida Natural Flavors' Orange Slush Mix** — a bag-in-box concentrate that the supplier confirmed by phone (per a DISboards user's account) is what they sell to Disney for "the two slushes served in France." Florida Natural Flavors (Casselberry, FL) is a private-label beverage manufacturer of bag-in-box juices and frozen-drink mixes for distributors. For a home build, retail **Minute Maid Premium Original (NFC)** is the closest available analog; Simply Orange Pulp-Free has slightly higher Brix (~12 vs ~11), giving an extra sugar buffer. Brix matters: at 11 Brix, OJ contributes ~3.3 g sugar/oz; at 12 Brix, ~3.6 g/oz — a ~10% swing that affects both texture and sweetness.

**Grand Marnier — Cordon Rouge specifically:** All in-park signage and the Food & Wine Festival's annual "Grand Marnier Seminar" point to the standard yellow-label, red-ribbon **Cordon Rouge (40% ABV, 51% cognac base)**. None of the clones report Cuvée du Centenaire or Quintessence — those would be cost-prohibitive at a $14.95 retail price. The cheap-substitution recipes (#3, #5) that pour generic triple sec produce a drink that tastes thinner and more candy-like; the cognac depth in Cordon Rouge is what makes the in-park drink read as "creamsicle." **Do not substitute.**

**Sweetener — yes, the kiosk version is augmented:** Pure NFC OJ alone would not reach the candy-sweet level reviewers describe; the FNF slush mix is itself sweetened with added sugar/syrup. The 4 oz of 1:1 simple syrup in the recipe above replicates that augmentation. For a less-sweet "sorbet-style" version (closer to fresh-squeezed orange sorbet), drop to 2 oz simple syrup and add 2 more oz OJ — total sugar falls to ~12.5%, still well above the floor.

**Acidity — no added lemon juice:** Despite recipe #3's "sweet & sour mix" trail, the parks drink reads as creamsicle-sweet, not tart. The natural malic/citric acid in OJ is sufficient. If your batch comes out flat (some grocery OJs are very low-acid), 0.5 oz fresh lemon juice will brighten it without adding overt tartness — reserve as a tasting-time adjustment.

**Garnish:** None in-park — it's a walk-and-drink cup. For at-home, a thin orange wheel notched onto the rim or a candied orange peel twist. Skip the sugar rim; the drink is already sweet enough.

---

## Recommendations

### Staged execution plan

1. **First batch — calibration run.** Build the recipe exactly as above. Run Spiked Slush, temperature 9. Taste at the 50-minute mark when texture has just set. Benchmark against the descriptions: should read like an orange sorbet that smells of Grand Marnier and tastes mildly boozy. If perfect, lock the recipe.
2. **If texture is too icy / freezes hard after 60 min:** Sugar is fine; you likely started too cold. Take the OJ out of the fridge 30 min before building next time, or step temperature down to level 8.
3. **If texture stays soupy / never sets:** Most likely cause is OJ Brix below 10 (some store-brand OJs test at 9–10). Add 1 more oz simple syrup mid-cycle through the easy-fill port — this brings sugar up to ~15.5% and texture will lock within 15 min.
4. **If flavor is too sweet:** Reduce simple syrup to 2 oz next batch; add 2 oz OJ to maintain fill volume. Floor still clears (~12.5%).
5. **If flavor is too candy and not boozy enough:** Bump GM to 10 oz and OJ down to 42 oz — ABV climbs to 11.25%, still safe.
6. **For parties (the highest-utility configuration):** Build on the **FS605 SLUSHi Max** at 112 oz fill — yields ~12 standard EPCOT-size pours from one cycle. Have a bottle of GM at the dispensing station for floats.

### Decision thresholds

- **Switch to Frozen Juice preset only if** you make the alcohol-free version (omit all three spirits; replace with 16 oz additional OJ + 4 oz orange soda for body and a few extra grams of acid). At zero ABV, Frozen Juice's tighter sugar requirement is the correct cycle.
- **Switch from this recipe to recipe #3 (sweet & sour version) only if** you find the OJ-based base too pulpy/heavy on the palate. Note that the sweet-and-sour version drifts away from the in-park creamsicle character toward a margarita-of-sorts.
- **Buy the actual Florida Natural Flavors Orange Slush Mix** ($50 per 6-bottle case, per the DISboards user's direct contact with the supplier) **only if** you intend to run this drink monthly and want the truest possible match. Otherwise Minute Maid + simple syrup hits 90% of the target for grocery-store cost.

---

## Caveats and open questions

- **No first-party Disney recipe exists.** The most authoritative published clone (Ashley Craft's *Unofficial Disney Parks EPCOT Cookbook*, 2022, developed with a paid mixologist) does not include its exact ounce measurements in any free excerpt I could locate. The Yahoo Lifestyle write-up confirms it includes Grand Marnier + orange vodka + white rum + OJ + simple syrup blended with ice; the recipe above mirrors that ingredient *list* at proportions optimized for the Slushi rather than the blender. **Acquiring the cookbook and cross-checking exact Craft proportions is a worthwhile validation step before publishing in print.**
- **Recipe #3's "1:1:2:1 sweet-and-sour" formulation, despite being the most-blogged version on the internet, is the *least* consistent with the official menu listing and with guest taste descriptions.** It traces back to a single 2010 party-blog recipe that propagated through Magical Recipes → Chip & Co → Disney Nation → KeyIngredient via copy-paste. Treat it as folkloric, not as the operator's actual build.
- **The exact Florida Natural Flavors SKU** that Disney uses (consumer-line "Orange" slush mix vs. a custom OEM concentrate) is not publicly confirmed. The "Orange Fruit Smoothie" name in the DISboards thread may have been retired; FNF's current consumer line lists an "Orange" slush mix described as "robust citrusy flavor." A direct phone call to FNF, repeating the DISboards user's approach, would resolve this.
- **Disney's pour partners change.** Bacardi Silver as the rum and Grey Goose L'Orange as the vodka match the 2025 menu, but if either contract turns over, the actual in-park drink will shift. Always re-check the AllEars or MouseForLess menu page before a "definitive" comparison.
- **Open questions that only live taste-testing in the park can resolve:**
  - Whether the kiosk uses any cream/half-and-half. Some guests describe a "creamsicle" mouthfeel that *could* imply a dairy component, though no menu listing or supplier evidence supports this — most likely it's the cognac roundness in Grand Marnier + sweetened OJ creating the illusion.
  - Whether vanilla extract or orange-blossom water is in the FNF concentrate (would also explain creamsicle character; pure speculation).
  - The actual Brix of the in-park dispensed drink (I'd predict 12–14 Brix; a refractometer reading would settle it, though bringing one into EPCOT is not advised).
  - Whether the rum is currently Bacardi Silver or has shifted to a different SKU since 2022.
- **The user prompt's "4 g sugar per oz" sugar-floor figure is a 4× overstatement of the Ninja Slushi's actual specification.** The published floor is **4% by mass** (≈ 1.18 g/oz, or ≈ 4 g per 100 mL). Recipes built to a 4-g/oz target would be excessively sweet and unnecessarily restrict the ingredient palette. The recipe above clears the *real* spec by ~3.6× while still landing at a sweetness level that matches guest descriptions.
- **The user prompt's "alcohol ceiling of ~15%" is essentially correct** — Ninja's published spec for the original Slushi is 16% upper, 2.8% lower. The newer FS605 SLUSHi Max raises this to ~20% via SlushAssist; if you own a Max, you can run the recipe boozier (e.g. 12 oz GM, 6 oz vodka, 6 oz rum, 40 oz OJ, 4 oz simple syrup, 44 oz total spirit/syrup → 13.1% ABV) without needing a float at all.

---

## Coverage check vs. the original brief

| Requested item | Where covered |
|---|---|
| Venue confirmation (Les Vins vs. Les Halles vs. Chefs de France) | Key Findings §1 |
| Current 2025–26 menu version, price, vessel/size | Key Findings §1 |
| Historical formulation changes | Key Findings §2 |
| Disney's own public statements / official recipes | Key Findings §3 |
| Catalog of clone recipes with citations | Key Findings §4 |
| Triangulation with reasoning | Key Findings §5 |
| Sensory profile from guest reviews | Key Findings §1 |
| Why blender-with-ice recipes can't be transcribed | Key Findings §6 |
| Slushi technical parameters (sugar floor, ABV ceiling, presets, vessels) | Key Findings §7 |
| Slushi-optimized recipe with sugar-floor math | Details — Recipe block |
| Final ABV calculation | Details — Recipe block |
| Recommended preset with rationale | Details — Preset rationale |
| Fill volumes for 88 oz / 72 oz / 112 oz vessels | Details — Scaling table |
| Float strategy for "boozy" version | Details — Le Géant variant |
| OJ sourcing (NFC vs. concentrate, Disney's bulk supplier) | Details — Ingredient deep-dive |
| Grand Marnier Cordon Rouge confirmation | Details — Ingredient deep-dive |
| Sweetener quantification | Details — Ingredient deep-dive |
| Acidity balance | Details — Ingredient deep-dive |
| Garnish | Details — Ingredient deep-dive |
| Staged recommendations with decision thresholds | Recommendations |
| Open questions / live taste-test needed | Caveats |