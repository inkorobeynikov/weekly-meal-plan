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

  return Response.json({ recipe })
})
