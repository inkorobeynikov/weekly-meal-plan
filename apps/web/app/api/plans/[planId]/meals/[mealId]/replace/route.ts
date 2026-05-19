import { planService } from '@meal-planner/domain'
import { withAuth } from '../../../../../../../lib/auth-middleware.js'

interface RouteContext {
  params: Promise<{ planId: string; mealId: string }>
}

export const POST = withAuth<RouteContext>(async (req, { params, user }) => {
  const { mealId } = await params
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  let reason: string | undefined
  try {
    const body = (await req.json()) as { reason?: unknown } | null
    if (body && typeof body.reason === 'string') reason = body.reason
  } catch {
    /* body is optional */
  }

  const updatedMeal = await planService.replaceMeal({ plannedMealId: mealId, reason })
  return Response.json({ meal: updatedMeal })
})
