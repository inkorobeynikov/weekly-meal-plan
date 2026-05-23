import { z } from 'zod'
import { RecipeSchema } from './recipe.schema.js'

// The plan window is variable: today through the Sunday after next, so up to
// 14 days. dayOffset is 0 on the first day of the window.
export const PlannedMealSchema = z.object({
  dayOffset: z.number().int().min(0).max(13),
  mealType: z.enum(['dinner', 'lunch_leftover', 'breakfast_template']),
  leftoversPlanned: z.boolean(),
  recipe: RecipeSchema,
})

// Meals include dinners (one per day, up to 14) plus optional lunch_leftover
// entries, so the upper bound is generous.
export const WeeklyPlanSchema = z.object({
  reasoningSummary: z.string(),
  meals: z.array(PlannedMealSchema).min(1).max(20),
})

export type PlannedMeal = z.infer<typeof PlannedMealSchema>
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>
