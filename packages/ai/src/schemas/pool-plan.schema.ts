import { z } from 'zod'

/**
 * Pool-based plan generation (Phase 13d): instead of inventing full recipes,
 * the model SELECTS recipes by id from a pre-filtered candidate list (the
 * SQL-level allergen hard-filter already ran in findCandidates). Much cheaper
 * and faster than WeeklyPlanSchema, and recipe identities stay stable so
 * family feedback compounds.
 *
 * recipeId membership in the offered candidate set is validated in
 * plan.service — Zod can only check the shape here.
 */
export const PoolPlannedMealSchema = z.object({
  dayOffset: z.number().int().min(0).max(13),
  mealType: z.enum(['dinner', 'lunch', 'lunch_leftover']),
  // For lunch_leftover this must repeat the previous day's dinner recipeId.
  recipeId: z.string().min(1),
  leftoversPlanned: z.boolean(),
  whyThisMeal: z.string(),
})

export const WeeklyPlanFromPoolSchema = z.object({
  reasoningSummary: z.string(),
  meals: z.array(PoolPlannedMealSchema).min(1).max(32),
})

// Single-slot replacement pick (pool-mode replaceMeal).
export const PoolReplacementSchema = z.object({
  recipeId: z.string().min(1),
  whyThisMeal: z.string(),
})

export type PoolPlannedMeal = z.infer<typeof PoolPlannedMealSchema>
export type WeeklyPlanFromPool = z.infer<typeof WeeklyPlanFromPoolSchema>
export type PoolReplacement = z.infer<typeof PoolReplacementSchema>
