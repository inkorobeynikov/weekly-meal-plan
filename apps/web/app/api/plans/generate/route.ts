import { inngest } from '../../../../lib/inngest.js'
import { withAuth } from '../../../../lib/auth-middleware.js'

function nextMondayIso(): string {
  const now = new Date()
  const utcNow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const dow = utcNow.getUTCDay() // 0..6 with Sunday=0
  const daysUntilMonday = ((1 - dow + 7) % 7) || 7
  utcNow.setUTCDate(utcNow.getUTCDate() + daysUntilMonday)
  return utcNow.toISOString().slice(0, 10)
}

export const POST = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  const weekStartDate = nextMondayIso()
  await inngest.send({
    name: 'meal-planner/plan.generate',
    data: { householdId, weekStartDate },
  })

  return Response.json({ status: 'generating', weekStartDate })
})
