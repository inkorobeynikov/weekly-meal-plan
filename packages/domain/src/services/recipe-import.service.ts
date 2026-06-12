import { eq, inArray } from 'drizzle-orm'
import { db, recipes, type NewRecipe } from '@meal-planner/db'
import {
  getOpenAI,
  MODELS,
  zodResponseFormat,
  ImportedRecipeSchema,
  buildRecipeImportSystemPrompt,
  buildRecipeImportUserPrompt,
  type ImportedRecipe,
  type RawRecipeInput,
} from '@meal-planner/ai'

export type { ImportedRecipe, RawRecipeInput }

export interface ImportUsage {
  promptTokens: number
  completionTokens: number
}

export interface RewriteResult {
  recipe: ImportedRecipe
  usage: ImportUsage
}

/** Which of the given content hashes already exist in the recipes table. */
export async function findExistingContentHashes(hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  const rows = await db
    .select({ contentHash: recipes.contentHash })
    .from(recipes)
    .where(inArray(recipes.contentHash, hashes))
  return new Set(rows.map((r) => r.contentHash).filter((h): h is string => h !== null))
}

/**
 * Rewrite/normalize one raw scraped recipe via OpenAI structured output
 * (Phase 13c). Steps are rewritten in our own words — the verbatim source
 * text is input only and never returned for storage.
 */
export async function rewriteRawRecipe(raw: RawRecipeInput): Promise<RewriteResult> {
  const openai = getOpenAI()
  const completion = await openai.beta.chat.completions.parse({
    model: MODELS.fast, // mini-class model is enough for rewrite/normalize
    messages: [
      { role: 'system', content: buildRecipeImportSystemPrompt() },
      { role: 'user', content: buildRecipeImportUserPrompt(raw) },
    ],
    response_format: zodResponseFormat(ImportedRecipeSchema, 'imported_recipe'),
  })
  const parsed = completion.choices[0]?.message.parsed
  if (!parsed) throw new Error('AI returned no parsed content')
  // Rule #4: Zod validates every LLM output before it touches the database.
  // allergens are constrained to the canonical enum — invalid values throw here.
  const recipe = ImportedRecipeSchema.parse(parsed)
  return {
    recipe,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    },
  }
}

export interface UpsertImportedRecipeInput {
  contentHash: string
  sourceUrl: string
  recipe: ImportedRecipe
}

/**
 * Upsert a rewritten recipe into the global pool by contentHash.
 * Pool recipes have householdId NULL, source 'imported' and are stored
 * pre-validated ('valid') — the Zod gate already ran in rewriteRawRecipe.
 */
export async function upsertImportedRecipe(
  input: UpsertImportedRecipeInput,
): Promise<'inserted' | 'updated'> {
  const { contentHash, sourceUrl, recipe } = input
  const values: NewRecipe = {
    householdId: null,
    title: recipe.title,
    source: 'imported',
    servings: recipe.servings,
    timeMinutes: recipe.timeMinutes,
    difficulty: recipe.difficulty,
    ingredientsJson: recipe.ingredients,
    stepsJson: recipe.steps,
    substitutionsJson: [],
    leftoversNotes: recipe.leftoversNotes,
    storageNotes: recipe.storageNotes,
    childFriendlyNotes: recipe.childFriendlyNotes,
    allergenNotes: recipe.allergenNotes,
    costLevel: recipe.costLevel,
    validationStatus: 'valid',
    sourceUrl,
    contentHash,
    cuisine: recipe.cuisine,
    tags: recipe.tags,
    mealTypes: recipe.mealTypes,
    allergens: recipe.allergens,
    isGoodForLeftovers: recipe.isGoodForLeftovers,
  }

  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.contentHash, contentHash))
    .limit(1)

  if (existing) {
    const { contentHash: _hash, ...update } = values
    await db.update(recipes).set(update).where(eq(recipes.id, existing.id))
    return 'updated'
  }
  await db.insert(recipes).values(values)
  return 'inserted'
}
