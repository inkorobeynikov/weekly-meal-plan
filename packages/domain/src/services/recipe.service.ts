import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import {
  db,
  recipes,
  dishFeedback,
  plannedMeals,
  weeklyPlans,
  recipeRequests,
  type Recipe,
  type RecipeRequest,
} from '@meal-planner/db'
import {
  matchCanonicalAllergens,
  type BudgetMode,
  type CanonicalAllergen,
  type FeedbackReaction,
} from '@meal-planner/shared'
import type { PoolCandidate } from '@meal-planner/ai'
import * as householdService from './household.service.js'

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1)
  return row ?? null
}

// ---------------------------------------------------------------------------
// Phase 13d — pool candidates for plan generation.
// ---------------------------------------------------------------------------

export interface FindCandidatesOptions {
  /** How many candidates to return (default 50). */
  limit?: number
  /** Restrict to recipes that fit a specific slot (replaceMeal). */
  mealType?: 'dinner' | 'lunch'
  /** Recipes already on the plan (replaceMeal must not re-offer them). */
  excludeRecipeIds?: string[]
  /**
   * Phase 13 PR-4: recipes the family asked for via "Dodaj do następnego planu".
   * They are force-included in the returned candidate list and flagged
   * `requested: true` so the prompt insists on them — BUT only if they survive
   * the same allergen HARD-CONSTRAINT SQL filter. The allergen filter is NEVER
   * bypassed for a request.
   */
  mustOfferRecipeIds?: string[]
}

export interface RecipeCandidate extends PoolCandidate {
  servings: number
  allergens: CanonicalAllergen[]
}

/** How many days back a dont_repeat reaction keeps a recipe out of the pool. */
const DONT_REPEAT_WINDOW_DAYS = 90
const DEFAULT_CANDIDATE_LIMIT = 50
const MAIN_INGREDIENTS_PER_CANDIDATE = 6

function budgetScore(costLevel: string, budgetMode: BudgetMode): number {
  if (budgetMode === 'economical') {
    if (costLevel === 'cheap') return 1
    if (costLevel === 'expensive') return -2
    return 0
  }
  if (budgetMode === 'normal') return costLevel === 'expensive' ? -1 : 0
  return 0 // flexible
}

function normalizeTerm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Pool candidates for a household's plan generation (Phase 13d).
 *
 * HARD CONSTRAINT enforced HERE, at the SQL level: any pool recipe whose
 * canonical `allergens` intersect the family's allergies/hardRestrictions
 * (mapped via matchCanonicalAllergens) never leaves the database — nothing
 * forbidden can even appear in the prompt. The textual post-generation guard
 * in plan.service remains as the second line of defense.
 *
 * Soft preferences (time budget, budgetMode vs costLevel, likes/preferred
 * cuisines, recent dont_repeat feedback) shape the score; a small random
 * jitter keeps consecutive weeks from offering an identical list.
 */
export async function findCandidates(
  householdId: string,
  options: FindCandidatesOptions = {},
): Promise<RecipeCandidate[]> {
  const preferences = await householdService.getPreferences(householdId)
  if (!preferences) throw new Error(`Preferences not found for household ${householdId}`)

  // HARD CONSTRAINT: allergies + hardRestrictions → canonical allergens → SQL exclusion.
  const forbiddenAllergens = matchCanonicalAllergens([
    ...preferences.allergies,
    ...preferences.hardRestrictions,
  ])

  // Recently rejected recipes (dont_repeat) stay out of the offered pool.
  const windowStart = new Date(Date.now() - DONT_REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rejected = await db
    .select({ recipeId: dishFeedback.recipeId })
    .from(dishFeedback)
    .where(
      and(
        eq(dishFeedback.householdId, householdId),
        eq(dishFeedback.reaction, 'dont_repeat'),
        gte(dishFeedback.createdAt, windowStart),
      ),
    )
  const excluded = [
    ...new Set([...rejected.map((r) => r.recipeId), ...(options.excludeRecipeIds ?? [])]),
  ]

  const conditions = [
    eq(recipes.source, 'imported'),
    eq(recipes.validationStatus, 'valid'),
    isNull(recipes.householdId), // global pool only
  ]
  if (forbiddenAllergens.length > 0) {
    // jsonb ?| text[] — true when any forbidden allergen is present; we negate.
    conditions.push(
      sql`NOT (${recipes.allergens} ?| ARRAY[${sql.join(
        forbiddenAllergens.map((a) => sql`${a}`),
        sql`, `,
      )}]::text[])`,
    )
  }
  if (options.mealType) {
    conditions.push(sql`${recipes.mealTypes} @> ${JSON.stringify([options.mealType])}::jsonb`)
  }
  if (excluded.length > 0) {
    conditions.push(notInArray(recipes.id, excluded))
  }

  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      cuisine: recipes.cuisine,
      tags: recipes.tags,
      mealTypes: recipes.mealTypes,
      timeMinutes: recipes.timeMinutes,
      costLevel: recipes.costLevel,
      servings: recipes.servings,
      isGoodForLeftovers: recipes.isGoodForLeftovers,
      allergens: recipes.allergens,
      ingredientsJson: recipes.ingredientsJson,
    })
    .from(recipes)
    .where(and(...conditions))

  const likes = preferences.likes.map(normalizeTerm)
  const preferredCuisines = preferences.preferredCuisines.map(normalizeTerm)
  const dislikes = preferences.dislikes.map(normalizeTerm)

  const scored = rows.map((row) => {
    const haystack = normalizeTerm(`${row.title} ${row.tags.join(' ')} ${row.cuisine ?? ''}`)
    let score = 0
    if (row.cuisine && preferredCuisines.some((c) => normalizeTerm(row.cuisine ?? '').includes(c)))
      score += 2
    score += Math.min(
      3,
      likes.filter((l) => l.length > 2 && haystack.includes(l)).length,
    )
    if (dislikes.some((d) => d.length > 2 && haystack.includes(d))) score -= 2
    if (row.timeMinutes <= preferences.cookingTimeWeekdayMinutes) score += 1
    score += budgetScore(row.costLevel, preferences.budgetMode)
    score += Math.random() // jitter: vary the offered list week to week
    return { row, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const limit = options.limit ?? DEFAULT_CANDIDATE_LIMIT

  // Phase 13 PR-4: force-include requested recipes that survive the allergen
  // HARD-CONSTRAINT filter. They go FIRST and are flagged so the prompt insists
  // on them; the allergen filter (forbiddenAllergens) is reapplied here so a
  // request can never smuggle a forbidden recipe into the pool.
  const requestedCandidates = await fetchMustOfferCandidates(
    options.mustOfferRecipeIds ?? [],
    forbiddenAllergens,
  )

  const out: RecipeCandidate[] = []
  const seen = new Set<string>()
  for (const candidate of requestedCandidates) {
    out.push(candidate)
    seen.add(candidate.id)
  }
  for (const { row } of scored) {
    if (out.length >= limit) break
    if (seen.has(row.id)) continue
    out.push(rowToCandidate(row, false))
    seen.add(row.id)
  }
  return out
}

// Row shape shared by the scored query and the must-offer query.
interface CandidateRow {
  id: string
  title: string
  cuisine: string | null
  tags: string[]
  mealTypes: string[]
  timeMinutes: number
  costLevel: string
  servings: number
  isGoodForLeftovers: boolean
  allergens: CanonicalAllergen[]
  ingredientsJson: { name: string }[]
}

function rowToCandidate(row: CandidateRow, requested: boolean): RecipeCandidate {
  return {
    id: row.id,
    title: row.title,
    cuisine: row.cuisine,
    tags: row.tags,
    mealTypes: row.mealTypes,
    timeMinutes: row.timeMinutes,
    costLevel: row.costLevel,
    servings: row.servings,
    isGoodForLeftovers: row.isGoodForLeftovers,
    allergens: row.allergens,
    mainIngredients: row.ingredientsJson
      .slice(0, MAIN_INGREDIENTS_PER_CANDIDATE)
      .map((i) => i.name),
    requested,
  }
}

// Fetch the requested pool recipes, reapplying the allergen HARD-CONSTRAINT
// exclusion (and the global-pool/valid conditions). Anything that does not
// survive is silently dropped — a request never overrides an allergy.
async function fetchMustOfferCandidates(
  recipeIds: string[],
  forbiddenAllergens: CanonicalAllergen[],
): Promise<RecipeCandidate[]> {
  if (recipeIds.length === 0) return []
  const conditions = [
    inArray(recipes.id, [...new Set(recipeIds)]),
    eq(recipes.source, 'imported'),
    eq(recipes.validationStatus, 'valid'),
    isNull(recipes.householdId),
  ]
  if (forbiddenAllergens.length > 0) {
    // HARD CONSTRAINT: identical allergen exclusion as the main query.
    conditions.push(
      sql`NOT (${recipes.allergens} ?| ARRAY[${sql.join(
        forbiddenAllergens.map((a) => sql`${a}`),
        sql`, `,
      )}]::text[])`,
    )
  }
  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      cuisine: recipes.cuisine,
      tags: recipes.tags,
      mealTypes: recipes.mealTypes,
      timeMinutes: recipes.timeMinutes,
      costLevel: recipes.costLevel,
      servings: recipes.servings,
      isGoodForLeftovers: recipes.isGoodForLeftovers,
      allergens: recipes.allergens,
      ingredientsJson: recipes.ingredientsJson,
    })
    .from(recipes)
    .where(and(...conditions))
  return rows.map((row) => rowToCandidate(row, true))
}

// ---------------------------------------------------------------------------
// Phase 13 PR-4 — Favorites (reuse the dishFeedback 'favorite' reaction).
// ---------------------------------------------------------------------------

/** True when the household has a 'favorite' reaction row for this recipe. */
export async function isFavorite(householdId: string, recipeId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dishFeedback.id })
    .from(dishFeedback)
    .where(
      and(
        eq(dishFeedback.householdId, householdId),
        eq(dishFeedback.recipeId, recipeId),
        eq(dishFeedback.reaction, 'favorite'),
      ),
    )
    .limit(1)
  return row !== undefined
}

/**
 * Idempotent favorite toggle. `favorite: true` ensures exactly one 'favorite'
 * row exists for (household, recipe); `favorite: false` removes every such row.
 * Returns the resulting state.
 */
export async function setFavorite(
  householdId: string,
  recipeId: string,
  favorite: boolean,
): Promise<{ isFavorite: boolean }> {
  if (!favorite) {
    await db
      .delete(dishFeedback)
      .where(
        and(
          eq(dishFeedback.householdId, householdId),
          eq(dishFeedback.recipeId, recipeId),
          eq(dishFeedback.reaction, 'favorite'),
        ),
      )
    return { isFavorite: false }
  }
  // Only insert when there is no existing favorite row (one row per pair).
  const already = await isFavorite(householdId, recipeId)
  if (!already) {
    await db.insert(dishFeedback).values({
      householdId,
      recipeId,
      reaction: 'favorite',
    })
  }
  return { isFavorite: true }
}

// ---------------------------------------------------------------------------
// Phase 13 PR-4 — "Dodaj do następnego planu" request queue.
// ---------------------------------------------------------------------------

/** Recipe ids the household has an active (un-consumed) request for. */
export async function getActiveRequestRecipeIds(householdId: string): Promise<string[]> {
  const rows = await db
    .select({ recipeId: recipeRequests.recipeId })
    .from(recipeRequests)
    .where(
      and(
        eq(recipeRequests.householdId, householdId),
        isNull(recipeRequests.consumedByPlanId),
      ),
    )
  return [...new Set(rows.map((r) => r.recipeId))]
}

export async function isRecipeRequested(
  householdId: string,
  recipeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: recipeRequests.id })
    .from(recipeRequests)
    .where(
      and(
        eq(recipeRequests.householdId, householdId),
        eq(recipeRequests.recipeId, recipeId),
        isNull(recipeRequests.consumedByPlanId),
      ),
    )
    .limit(1)
  return row !== undefined
}

/**
 * Queue a recipe to be offered to the next generated plan. Idempotent: at most
 * one active (un-consumed) request per (household, recipe).
 */
export async function requestRecipeForNextPlan(
  householdId: string,
  recipeId: string,
): Promise<RecipeRequest> {
  const [existing] = await db
    .select()
    .from(recipeRequests)
    .where(
      and(
        eq(recipeRequests.householdId, householdId),
        eq(recipeRequests.recipeId, recipeId),
        isNull(recipeRequests.consumedByPlanId),
      ),
    )
    .limit(1)
  if (existing) return existing
  const [row] = await db
    .insert(recipeRequests)
    .values({ householdId, recipeId })
    .returning()
  if (!row) throw new Error('Failed to queue recipe request')
  return row
}

/**
 * Mark the household's active requests for the given recipes as fulfilled by a
 * plan. Called from plan generation once the requested dishes land in a plan.
 */
export async function markRequestsConsumed(
  householdId: string,
  recipeIds: string[],
  planId: string,
): Promise<{ consumed: number }> {
  if (recipeIds.length === 0) return { consumed: 0 }
  const rows = await db
    .update(recipeRequests)
    .set({ consumedByPlanId: planId })
    .where(
      and(
        eq(recipeRequests.householdId, householdId),
        isNull(recipeRequests.consumedByPlanId),
        inArray(recipeRequests.recipeId, [...new Set(recipeIds)]),
      ),
    )
    .returning({ id: recipeRequests.id })
  return { consumed: rows.length }
}

// ---------------------------------------------------------------------------
// Phase 13 PR-4 — Family cookbook. Deliberately NOT the full imported pool: we
// surface only recipes this household has actually interacted with, via
// planned_meals (incl. cooked_at marks) and dishFeedback.
// ---------------------------------------------------------------------------

export interface CookbookEntry {
  recipe: Recipe
  /** Latest cooked_at across this recipe's planned meals, ISO string or null. */
  lastCookedAt: string | null
  /** How many times this recipe has been planned for the household. */
  timesPlanned: number
  /** Distinct reactions the household gave this recipe (most-recent first). */
  reactions: FeedbackReaction[]
  isFavorite: boolean
  isRequested: boolean
}

export interface FamilyCookbook {
  /** "Ulubione" — recipes with a 'favorite' reaction. */
  favorites: CookbookEntry[]
  /** "Ostatnio gotowane" — recipes with a cooked_at mark, newest first. */
  recentlyCooked: CookbookEntry[]
  /** "Wszystkie wasze dania" — every interacted recipe. */
  all: CookbookEntry[]
}

const RECENTLY_COOKED_LIMIT = 12

export async function getFamilyCookbook(householdId: string): Promise<FamilyCookbook> {
  // 1) Planned-meal aggregates (times planned + last cooked) per recipe.
  const plannedRows = await db
    .select({
      recipeId: plannedMeals.recipeId,
      timesPlanned: sql<number>`cast(count(*) as int)`,
      lastCookedAt: sql<Date | null>`max(${plannedMeals.cookedAt})`,
    })
    .from(plannedMeals)
    .innerJoin(weeklyPlans, eq(plannedMeals.weeklyPlanId, weeklyPlans.id))
    .where(eq(weeklyPlans.householdId, householdId))
    .groupBy(plannedMeals.recipeId)

  // 2) Feedback reactions per recipe (most-recent first).
  const feedbackRows = await db
    .select({ recipeId: dishFeedback.recipeId, reaction: dishFeedback.reaction })
    .from(dishFeedback)
    .where(eq(dishFeedback.householdId, householdId))
    .orderBy(desc(dishFeedback.createdAt))

  // 3) Active requests for the isRequested flag.
  const requestedIds = new Set(await getActiveRequestRecipeIds(householdId))

  const planned = new Map(plannedRows.map((r) => [r.recipeId, r]))
  const reactionsByRecipe = new Map<string, FeedbackReaction[]>()
  for (const row of feedbackRows) {
    const list = reactionsByRecipe.get(row.recipeId) ?? []
    if (!list.includes(row.reaction)) list.push(row.reaction)
    reactionsByRecipe.set(row.recipeId, list)
  }

  const recipeIds = [
    ...new Set([...planned.keys(), ...reactionsByRecipe.keys()]),
  ]
  if (recipeIds.length === 0) {
    return { favorites: [], recentlyCooked: [], all: [] }
  }

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, recipeIds))
  const recipeById = new Map(recipeRows.map((r) => [r.id, r]))

  const entries: CookbookEntry[] = []
  for (const id of recipeIds) {
    const recipe = recipeById.get(id)
    if (!recipe) continue // recipe row gone (e.g. household recipe deleted)
    const agg = planned.get(id)
    const reactions = reactionsByRecipe.get(id) ?? []
    const lastCooked = agg?.lastCookedAt ?? null
    entries.push({
      recipe,
      lastCookedAt: lastCooked ? new Date(lastCooked).toISOString() : null,
      timesPlanned: agg?.timesPlanned ?? 0,
      reactions,
      isFavorite: reactions.includes('favorite'),
      isRequested: requestedIds.has(id),
    })
  }

  // "Wszystkie wasze dania" — most-recently-cooked first, then most-planned,
  // then alphabetical for a stable order.
  const all = [...entries].sort((a, b) => {
    if (a.lastCookedAt && b.lastCookedAt) {
      return b.lastCookedAt.localeCompare(a.lastCookedAt)
    }
    if (a.lastCookedAt) return -1
    if (b.lastCookedAt) return 1
    if (b.timesPlanned !== a.timesPlanned) return b.timesPlanned - a.timesPlanned
    return a.recipe.title.localeCompare(b.recipe.title)
  })

  const favorites = all.filter((e) => e.isFavorite)
  const recentlyCooked = all
    .filter((e) => e.lastCookedAt !== null)
    .slice(0, RECENTLY_COOKED_LIMIT)

  return { favorites, recentlyCooked, all }
}
