import { planService } from '@meal-planner/domain'
import { withAuth } from '../../../../lib/auth-middleware.js'

export const GET = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  const result = await planService.getCurrentPlanForHousehold(householdId)
  if (!result) {
    return Response.json({ error: 'No plan found' }, { status: 404 })
  }
  return Response.json(result)
})
