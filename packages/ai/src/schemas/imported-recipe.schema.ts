import { z } from 'zod'
import { CANONICAL_ALLERGENS, type CanonicalAllergen } from '@meal-planner/shared'
import { IngredientSchema } from './recipe.schema.js'

// z.enum needs a non-empty tuple type; CANONICAL_ALLERGENS is a readonly array.
const CanonicalAllergenEnum = z.enum(
  CANONICAL_ALLERGENS as unknown as [CanonicalAllergen, ...CanonicalAllergen[]],
)

/**
 * Structured output for the recipe-import rewrite step (Phase 13c).
 * Validated with Zod before anything touches the database (rule #4);
 * `allergens` is restricted to the canonical vocabulary so SQL-level
 * HARD-CONSTRAINT pre-filtering (13d) can rely on exact values.
 */
export const ImportedRecipeSchema = z.object({
  title: z.string().min(1),
  servings: z.number().int().positive(),
  timeMinutes: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  costLevel: z.enum(['cheap', 'moderate', 'expensive']),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
  leftoversNotes: z.string().nullable(),
  storageNotes: z.string().nullable(),
  childFriendlyNotes: z.string().nullable(),
  allergenNotes: z.string().nullable(),
  cuisine: z.string().min(1),
  tags: z.array(z.string().min(1)),
  // Explicit role classification first — forces the model to decide what the
  // dish IS before deciding where it fits. Only main_meal/soup belong in the
  // obiad/kolacja pool; the import script skips everything else.
  dishRole: z.enum([
    'main_meal',
    'soup',
    'dessert',
    'side',
    'bread',
    'preserve',
    'drink',
    'snack',
    'breakfast',
    'other',
  ]),
  // Which plan slots the dish fits. Empty = not an obiad/kolacja dish
  // (dessert, drink, breakfast-only) — the import script skips those.
  mealTypes: z.array(z.enum(['dinner', 'lunch'])),
  allergens: z.array(CanonicalAllergenEnum),
  isGoodForLeftovers: z.boolean(),
  isKidFriendly: z.boolean(),
})

export type ImportedRecipe = z.infer<typeof ImportedRecipeSchema>
