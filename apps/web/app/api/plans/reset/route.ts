import { planService } from '@meal-planner/domain'
import { withAuth } from '../../../../lib/auth-middleware.js'

// Deletes the household's active plan(s) — draft and approved — plus their
// planned meals and shopping lists (DB cascade). Lets a user start over; handy
// for testing. Mirrors the bot's /reset command.
export const POST = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  const result = await planService.clearActivePlan(householdId)
  return Response.json(result)
})
