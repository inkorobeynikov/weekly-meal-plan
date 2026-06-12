import { recipeService } from '@meal-planner/domain'
import { withAuth } from '../../../../../lib/auth-middleware.js'

// Phase 13 PR-4 — "Dodaj do następnego planu". Queues a pool recipe so the next
// generated plan force-offers it (subject to the allergen HARD CONSTRAINT, which
// is never bypassed). Idempotent: one active request per household+recipe.
interface RouteContext {
  params: Promise<{ recipeId: string }>
}

export const POST = withAuth<RouteContext>(async (_req, { params, user }) => {
  const { recipeId } = await params
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const recipe = await recipeService.getRecipeById(recipeId)
  if (!recipe) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (recipe.householdId && recipe.householdId !== householdId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const request = await recipeService.requestRecipeForNextPlan(householdId, recipeId)
  return Response.json({ request, requested: true })
})
