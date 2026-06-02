import { inngest } from '../../../../lib/inngest.js'
import { withAuth } from '../../../../lib/auth-middleware.js'

// Plan window starts TOMORROW (Europe/Warsaw) and runs for exactly one week
// (7 days). Shopping happens today, so today's dinner is not planned.
const PLAN_DAYS = 7
function planWindow(): { weekStartDate: string; dayCount: number } {
  const todayWarsaw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date())
  const start = new Date(`${todayWarsaw}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() + 1) // tomorrow
  const startIso = start.toISOString().slice(0, 10)
  return { weekStartDate: startIso, dayCount: PLAN_DAYS }
}

export const POST = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  const { weekStartDate, dayCount } = planWindow()
  await inngest.send({
    name: 'meal-planner/plan.generate',
    data: { householdId, weekStartDate, dayCount },
  })

  return Response.json({ status: 'generating', weekStartDate, dayCount })
})
