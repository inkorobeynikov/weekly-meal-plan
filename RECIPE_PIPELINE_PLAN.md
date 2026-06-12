# Phase 13 — Recipe Library: Scrape → Rewrite → Pool-based Plan Generation

> Goal: replace "AI invents recipes from scratch" with "AI selects from a curated pool
> of real Polish recipes". Better quality, real proportions, stable shopping lists.

---

## Architecture decisions (agreed 2026-06-11)

| Decision | Choice |
|---|---|
| Sources | Polish recipe sites (kwestiasmaku.com, aniagotuje.pl, beszamel.se.pl, kuchnia-domowa.pl) |
| Usage | Pool + AI selection — candidates injected into plan prompt, AI picks by ID |
| Language | Polish only (matches app + shopping list) |
| Runner | Local script (`scripts/scrape-recipes.ts`), manual runs like `import-promos.ts` |
| Storage | Existing `recipes` table, `source: 'imported'`, `householdId: NULL` (global pool) |

**Legal approach:** most Polish recipe sites expose schema.org/Recipe JSON-LD — we parse
structured data, then **rewrite steps in our own words via LLM** before storing. Ingredient
lists are facts (not copyrightable); creative step text is, so we never store it verbatim.
Keep `sourceUrl` for attribution. Don't hotlink images in v1. Respect robots.txt + rate
limits. (Not legal advice — skim each site's ToS once before scraping.)

---

## 13a — Schema extension (migration 0004)

Add to `recipes`:

- `sourceUrl text` — original URL (dedup key + attribution)
- `contentHash text unique` — hash of sourceUrl, idempotent re-runs
- `cuisine text` — e.g. `polska`, `włoska`
- `tags jsonb string[]` — `['szybkie', 'jednogarnkowe', 'dla dzieci', ...]`
- `mealTypes jsonb string[]` — which slots it fits: `dinner` / `lunch`
- `allergens jsonb string[]` — **canonical allergen list (gluten, laktoza, jaja, orzechy,
  ryby, skorupiaki, soja, seler, gorczyca, sezam)** — enables SQL-level HARD-CONSTRAINT
  pre-filtering before anything reaches the prompt
- `isGoodForLeftovers boolean` — already used by swap logic for `lunch_leftover`

## 13b — Scraper (`scripts/scrape-recipes.ts`)

1. Input: site config (sitemap URL or category listing URLs) + `--limit N`
2. Fetch sitemap → recipe URLs → fetch pages (1 req / 2 s, honor robots.txt, UA string)
3. Parse JSON-LD `schema.org/Recipe` (fallback: microdata). Skip pages without it
4. Dump raw JSON to `data/raw-recipes/{hash}.json` — refetch never repeats, LLM step
   can re-run on cached raw data for free
5. No LLM calls here. Pure fetch + parse. Dependencies: `cheerio` only

## 13c — LLM rewrite/normalize (`scripts/process-recipes.ts`)

For each raw file not yet in DB (by `contentHash`):

1. OpenAI structured output → extended `RecipeSchema` (packages/ai):
   - **rewrite steps in own words**, consistent imperative Polish style
   - normalize ingredients → `Ingredient[]` (name, quantity, unit) using the same
     normalization vocabulary as shopping list / promo matching
   - infer: `difficulty`, `costLevel`, `timeMinutes`, `servings`, `cuisine`, `tags`,
     `mealTypes`, `allergens`, `isGoodForLeftovers`, `childFriendlyNotes`
2. Zod-validate (rule #4); `allergens` must be from the canonical enum — reject otherwise
3. Upsert by `contentHash`, `validationStatus: 'valid'`, `source: 'imported'`
4. `--dry-run` prints without inserting; batch with progress + cost counter

Volume target v1: **300–500 obiady/kolacje**. Cost ≈ negligible on a mini-class model
(~2k tokens/recipe).

## 13d — Plan generation on the pool (`packages/domain`)

1. `recipeService.findCandidates(householdId)`:
   - **SQL hard filter: exclude any recipe whose `allergens` intersects family
     `allergies`/`hardRestrictions`** — HARD CONSTRAINT enforced *before* the prompt,
     not only after (keep the existing post-generation guard as second line)
   - soft filter: `timeMinutes <= cookingTimeWeekday`, `costLevel` vs `budgetMode`,
     boost `likes`/`preferredCuisines` tags, exclude recent `dont_repeat` feedback
   - return ~50 candidates (id, title, tags, time, cost, ingredients summary)
2. New `WeeklyPlanFromPoolSchema`: AI returns `recipeId` per slot + reasoning
   (instead of full recipe objects) → much cheaper + faster generation
3. `generateWeeklyPlan` + `replaceMeal` switch to candidate mode; **fallback:** if the
   pool has no fit for a slot (rare prefs), AI generates ad-hoc as today
4. Feedback loop unchanged — `dishFeedback.recipeId` already points at pool recipes,
   so family memory starts compounding on stable recipe identities (big win)

## 13e — Surface in app

- Mobile tab "Przepisy" exists — back it with `GET /api/recipes` (search + tag filter)
- W02 Recipe Detail already renders the full recipe shape — no UI changes needed

---

## Suggested PR slicing

1. **PR-1:** 13a migration + 13b scraper (no LLM, no behavior change)
2. **PR-2:** 13c processing script → seed first ~300 recipes
3. **PR-3:** 13d candidates + pool-based generation behind env flag `PLAN_FROM_POOL=1`
4. **PR-4:** flip default after a week of family dogfooding; 13e API for Przepisy tab

## Open questions

- Images: skip in v1; later — own photos, AI-generated, or licensed stock
- Embeddings (pgvector) for candidate selection: overkill at ≤1k recipes; tags + SQL
  filters are enough. Revisit at ~5k
- Breakfast templates: pool covers dinner/lunch only for now (matches current mealTypes)
