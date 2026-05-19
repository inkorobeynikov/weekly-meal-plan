import { planService } from '@meal-planner/domain'
import { inngest } from '../../../../../lib/inngest.js'
import { withAuth } from '../../../../../lib/auth-middleware.js'

interface RouteContext {
  params: Promise<{ planId: string }>
}

export const POST = withAuth<RouteContext>(async (_req, { params, user }) => {
  const { planId } = await params
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  const updated = await planService.approvePlan(planId)
  if (updated.householdId !== householdId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  await inngest.send({
    name: 'meal-planner/shopping.generate',
    data: { planId, householdId },
  })

  return Response.json({ plan: updated })
})
