import { recipeService } from '@meal-planner/domain'
import { withAuth } from '../../../../lib/auth-middleware.js'

interface RouteContext {
  params: Promise<{ recipeId: string }>
}

export const GET = withAuth<RouteContext>(async (_req, { params, user }) => {
  const { recipeId } = await params
  const recipe = await recipeService.getRecipeById(recipeId)
  if (!recipe) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (recipe.householdId && recipe.householdId !== householdId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Phase 13 PR-4: per-household context for the heart toggle + "add to next
  // plan" button on W02. Additive — existing callers read `recipe` only.
  const [isFavorite, isRequested] = householdId
    ? await Promise.all([
        recipeService.isFavorite(householdId, recipeId),
        recipeService.isRecipeRequested(householdId, recipeId),
      ])
    : [false, false]

  return Response.json({ recipe, isFavorite, isRequested })
})
