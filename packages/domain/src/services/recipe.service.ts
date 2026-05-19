import { eq } from 'drizzle-orm'
import { db, recipes, type Recipe } from '@meal-planner/db'

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1)
  return row ?? null
}
