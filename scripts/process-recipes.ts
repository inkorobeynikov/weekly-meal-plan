/**
 * Recipe import processor (Phase 13c) — LLM rewrite/normalize raw scraped
 * recipes into the global pool in the `recipes` table.
 *
 * Usage:
 *   pnpm process-recipes --dry-run --limit 3        # preview, no DB writes
 *   pnpm process-recipes --limit 50                 # process 50 new raw files
 *   pnpm process-recipes --site aniagotuje          # only one site's files
 *   pnpm process-recipes --force                    # re-process existing hashes
 *
 * For each data/raw-recipes/{contentHash}.json not yet in the DB (by
 * contentHash; --force re-processes): OpenAI structured output rewrites the
 * steps in our own words (legal requirement — verbatim source text never
 * reaches the database), normalizes ingredients and infers classification
 * fields. Zod validates the output (rule #4, allergens restricted to the
 * canonical enum) before the upsert. Recipes classified as not-a-meal
 * (desserts, breads, sides, preserves...) are skipped — the pool covers
 * obiady/kolacje — and their hashes are recorded in data/raw-recipes/
 * .not-meals.json so later runs don't pay for re-classifying them
 * (--force re-evaluates).
 */
import './load-env.js' // MUST be first: db client reads DATABASE_URL at import time
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  findExistingContentHashes,
  rewriteRawRecipe,
  upsertImportedRecipe,
  type RawRecipeInput,
} from '@meal-planner/domain/recipe-import'

// ----- raw file shape (produced by scripts/scrape-recipes.ts) -----

interface RawRecipeFile extends RawRecipeInput {
  contentHash: string
  sourceUrl: string
  siteId: string
}

function readRawRecipeFile(path: string): RawRecipeFile | null {
  const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (data === null || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((s) => typeof s === 'string')
  if (
    typeof obj.contentHash !== 'string' ||
    typeof obj.sourceUrl !== 'string' ||
    typeof obj.siteId !== 'string' ||
    typeof obj.title !== 'string' ||
    !isStringArray(obj.ingredients) ||
    !isStringArray(obj.steps) ||
    obj.ingredients.length === 0 ||
    obj.steps.length === 0
  ) {
    return null
  }
  const optString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  return {
    contentHash: obj.contentHash,
    sourceUrl: obj.sourceUrl,
    siteId: obj.siteId,
    title: obj.title,
    description: optString(obj.description),
    servingsText: optString(obj.servingsText),
    timeText: optString(obj.timeText),
    cuisine: optString(obj.cuisine),
    ingredients: obj.ingredients,
    steps: obj.steps,
    categories: isStringArray(obj.categories) ? obj.categories : [],
    tags: isStringArray(obj.tags) ? obj.tags : [],
  }
}

// ----- CLI -----

interface CliArgs {
  limit: number
  dryRun: boolean
  force: boolean
  site: string | null
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { limit: Number.POSITIVE_INFINITY, dryRun: false, force: false, site: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--force') args.force = true
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? '')
    else if (arg?.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg === '--site') args.site = argv[++i] ?? null
    else if (arg?.startsWith('--site=')) args.site = arg.slice('--site='.length)
    else {
      console.error(`Unknown argument: ${arg}`)
      console.error('Usage: pnpm process-recipes [--dry-run] [--force] [--limit <n>] [--site <id>]')
      process.exit(1)
    }
  }
  if (Number.isNaN(args.limit) || args.limit <= 0) {
    console.error('--limit must be a positive number')
    process.exit(1)
  }
  return args
}

// Cost estimate at gpt-4o-mini rates (USD per 1M tokens) — adjust mentally if
// OPENAI_MODEL_FAST points elsewhere; the token counts are always exact.
const INPUT_USD_PER_1M = 0.15
const OUTPUT_USD_PER_1M = 0.6

// ----- not-a-meal skip list (avoids re-paying for known desserts/sides) -----

function loadSkipList(path: string): Set<string> {
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (Array.isArray(data)) return new Set(data.filter((h): h is string => typeof h === 'string'))
  } catch {
    // Missing or malformed — start fresh.
  }
  return new Set()
}

function saveSkipList(path: string, hashes: Set<string>): void {
  writeFileSync(path, JSON.stringify([...hashes].sort(), null, 2), 'utf8')
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ----- main -----

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Add it to .env or the environment.')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or the environment.')
    process.exit(1)
  }

  const rawDir = resolve(process.cwd(), 'data', 'raw-recipes')
  let fileNames: string[]
  try {
    // Dotfiles excluded: .not-meals.json (the skip list) lives in the same dir.
    fileNames = readdirSync(rawDir).filter((f) => f.endsWith('.json') && !f.startsWith('.'))
  } catch {
    console.error(`No raw recipe directory at ${rawDir}. Run pnpm scrape-recipes first.`)
    process.exit(1)
  }

  const all: RawRecipeFile[] = []
  let malformed = 0
  for (const name of fileNames) {
    const raw = readRawRecipeFile(join(rawDir, name))
    if (raw) all.push(raw)
    else malformed++
  }
  const siteFiltered = args.site ? all.filter((r) => r.siteId === args.site) : all

  const skipListPath = join(rawDir, '.not-meals.json')
  const notMeals = args.force ? new Set<string>() : loadSkipList(skipListPath)
  const candidates = siteFiltered.filter((r) => !notMeals.has(r.contentHash))

  const existing = args.force
    ? new Set<string>()
    : await findExistingContentHashes(candidates.map((r) => r.contentHash))
  const pending = candidates.filter((r) => !existing.has(r.contentHash))
  const queue = pending.slice(0, args.limit === Number.POSITIVE_INFINITY ? undefined : args.limit)

  console.log(
    `raw files: ${all.length} (${malformed} malformed)` +
      (args.site ? `, site=${args.site}: ${siteFiltered.length}` : '') +
      `, known not-a-meal: ${siteFiltered.length - candidates.length}` +
      `, already in DB: ${candidates.length - pending.length}, processing now: ${queue.length}` +
      (args.dryRun ? ' [DRY RUN]' : ''),
  )

  let inserted = 0
  let updated = 0
  let skippedNotMeal = 0
  let failed = 0
  let promptTokens = 0
  let completionTokens = 0

  for (let i = 0; i < queue.length; i++) {
    const raw = queue[i]!
    const progress = `[${i + 1}/${queue.length}]`
    try {
      const { recipe, usage } = await rewriteRawRecipe(raw)
      promptTokens += usage.promptTokens
      completionTokens += usage.completionTokens

      // Pool covers obiady/kolacje only: must be a main meal or soup AND fit a slot.
      const isMeal =
        (recipe.dishRole === 'main_meal' || recipe.dishRole === 'soup') &&
        recipe.mealTypes.length > 0
      if (!isMeal) {
        skippedNotMeal++
        if (!args.dryRun) {
          // Remember the verdict so later runs don't pay to re-classify.
          notMeals.add(raw.contentHash)
          saveSkipList(skipListPath, notMeals)
        }
        console.log(
          `${progress} ∅ not obiad/kolacja (${recipe.dishRole}), skipped: ${recipe.title} (${raw.siteId})`,
        )
        continue
      }

      if (args.dryRun) {
        console.log(
          `${progress} [dry] ${recipe.title} — ${recipe.mealTypes.join('/')}, ${recipe.cuisine}, ` +
            `${recipe.timeMinutes} min, ${recipe.servings} porcje, allergens: ` +
            `[${recipe.allergens.join(', ')}], tags: [${recipe.tags.join(', ')}], ` +
            `${recipe.ingredients.length} ingredients, ${recipe.steps.length} steps`,
        )
        console.log(`        step 1: ${recipe.steps[0] ?? ''}`)
        continue
      }

      const outcome = await upsertImportedRecipe({
        contentHash: raw.contentHash,
        sourceUrl: raw.sourceUrl,
        recipe,
      })
      if (outcome === 'inserted') inserted++
      else updated++
      console.log(
        `${progress} ✓ ${outcome}: ${recipe.title} — ${recipe.mealTypes.join('/')}, ` +
          `allergens: [${recipe.allergens.join(', ')}]`,
      )
    } catch (err) {
      failed++
      console.warn(`${progress} ✗ failed: ${raw.title} (${raw.sourceUrl}): ${errMessage(err)}`)
    }
  }

  const cost =
    (promptTokens / 1_000_000) * INPUT_USD_PER_1M +
    (completionTokens / 1_000_000) * OUTPUT_USD_PER_1M
  console.log(
    `Process done: ${inserted} inserted, ${updated} updated, ${skippedNotMeal} skipped (not a meal), ` +
      `${failed} failed, ${malformed} malformed files.` +
      ` Tokens: ${promptTokens} in / ${completionTokens} out (≈$${cost.toFixed(4)} at gpt-4o-mini rates).`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[process-recipes] fatal:', err)
  process.exit(1)
})
