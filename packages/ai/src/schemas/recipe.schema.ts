import { z } from 'zod'

export const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
})

export const RecipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().positive(),
  timeMinutes: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  costLevel: z.enum(['cheap', 'moderate', 'expensive']),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(z.string()).min(1),
  substitutions: z
    .array(
      z.object({
        original: z.string(),
        substitute: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  leftoversNotes: z.string().optional(),
  storageNotes: z.string().optional(),
  childFriendlyNotes: z.string().optional(),
  allergenNotes: z.string().optional(),
  isKidFriendly: z.boolean(),
  isGoodForLeftovers: z.boolean(),
  whyThisMeal: z.string(),
})

export type Recipe = z.infer<typeof RecipeSchema>
export type Ingredient = z.infer<typeof IngredientSchema>
