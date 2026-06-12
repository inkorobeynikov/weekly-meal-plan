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
  // F4 "intelligent surface": the model flags a dish as a deliberate "try
  // something new" pick (drives the Try-new badge on the day cards / detail).
  isTryNew: z.boolean(),
  // F4 price indicator. AI's rough per-recipe ingredient cost in GROSZE (integer
  // minor units — never floats). Optional so older generation paths and partial
  // model outputs stay backward compatible. Validated here before it ever
  // touches the DB.
  priceEstimateGrosze: z.number().int().nonnegative().optional(),
  whyThisMeal: z.string(),
})

export type Recipe = z.infer<typeof RecipeSchema>
export type Ingredient = z.infer<typeof IngredientSchema>
