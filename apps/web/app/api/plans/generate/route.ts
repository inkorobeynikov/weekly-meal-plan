import { inngest } from '../../../../lib/inngest.js'
import { withAuth } from '../../../../lib/auth-middleware.js'

// Plan window starts TOMORROW (Europe/Warsaw) and runs through the Sunday
// AFTER the upcoming one. Shopping happens today, so today's dinner is not
// planned. Length is 7..14 days.
function planWindow(): { weekStartDate: string; dayCount: number } {
  const todayWarsaw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date())
  const start = new Date(`${todayWarsaw}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() + 1) // tomorrow
  const startIso = start.toISOString().slice(0, 10)
  const dow = start.getUTCDay()
  const daysToUpcomingSunday = (7 - dow) % 7
  const dayCount = daysToUpcomingSunday + 8
  return { weekStartDate: startIso, dayCount }
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
