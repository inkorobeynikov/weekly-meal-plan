import { z } from 'zod'
import { recipeService } from '@meal-planner/domain'
import { withAuth } from '../../../../../lib/auth-middleware.js'

// Phase 13 PR-4 — heart toggle. Reuses the dishFeedback 'favorite' reaction;
// idempotent (one favorite row per household+recipe, toggling off removes it).
const BodySchema = z
  .object({
    favorite: z.boolean(),
  })
  .strict()

interface RouteContext {
  params: Promise<{ recipeId: string }>
}

export const POST = withAuth<RouteContext>(async (req, { params, user }) => {
  const { recipeId } = await params
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const recipe = await recipeService.getRecipeById(recipeId)
  if (!recipe) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  // A household may only favorite global pool recipes or its own recipes.
  if (recipe.householdId && recipe.householdId !== householdId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await recipeService.setFavorite(householdId, recipeId, parsed.data.favorite)
  return Response.json(result)
})
