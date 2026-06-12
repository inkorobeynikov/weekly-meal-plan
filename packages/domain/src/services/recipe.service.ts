import { and, eq, gte, isNull, notInArray, sql } from 'drizzle-orm'
import { db, recipes, dishFeedback, type Recipe } from '@meal-planner/db'
import {
  matchCanonicalAllergens,
  type BudgetMode,
  type CanonicalAllergen,
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

  return scored.slice(0, limit).map(({ row }) => ({
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
  }))
}
