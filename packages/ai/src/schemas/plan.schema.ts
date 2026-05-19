import { z } from 'zod'
import { RecipeSchema } from './recipe.schema.js'

export const PlannedMealSchema = z.object({
  dayOffset: z.number().int().min(0).max(6),
  mealType: z.enum(['dinner', 'lunch_leftover', 'breakfast_template']),
  leftoversPlanned: z.boolean(),
  recipe: RecipeSchema,
})

export const WeeklyPlanSchema = z.object({
  reasoningSummary: z.string(),
  meals: z.array(PlannedMealSchema).min(5).max(7),
})

export type PlannedMeal = z.infer<typeof PlannedMealSchema>
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>
