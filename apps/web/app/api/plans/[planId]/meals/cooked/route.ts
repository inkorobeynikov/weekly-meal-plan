import { z } from 'zod'
import { planService } from '@meal-planner/domain'
import { withAuth } from '../../../../../../lib/auth-middleware.js'

// F4 "mark cooked" (W02). Marks every planned meal for a recipe within the plan
// as cooked / not-cooked. Auth is checked first; ownership is verified against
// the plan's household before any write.
const BodySchema = z
  .object({
    recipeId: z.string().uuid(),
    cooked: z.boolean().default(true),
  })
  .strict()

interface RouteContext {
  params: Promise<{ planId: string }>
}

export const POST = withAuth<RouteContext>(async (req, { params, user }) => {
  const { planId } = await params
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // Ownership check BEFORE writing: the plan must belong to the caller's household.
  const planWithMeals = await planService.getPlanWithMeals(planId)
  if (!planWithMeals) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (planWithMeals.plan.householdId !== householdId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await planService.markMealCooked({
    recipeId: parsed.data.recipeId,
    planId,
    cooked: parsed.data.cooked,
  })

  return Response.json({ updated: result.updated })
})
