import { inngest } from '../../../../lib/inngest.js'
import { withAuth } from '../../../../lib/auth-middleware.js'

// The plan window now starts TODAY (Europe/Warsaw) and runs through the
// Sunday AFTER the upcoming one — i.e. the rest of this week plus the next
// full week. Length is 8..14 days depending on what weekday today is.
function planWindow(): { weekStartDate: string; dayCount: number } {
  const todayWarsaw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date())
  const start = new Date(`${todayWarsaw}T00:00:00Z`)
  const dow = start.getUTCDay() // 0 = Sunday
  const daysToUpcomingSunday = (7 - dow) % 7
  const dayCount = daysToUpcomingSunday + 8
  return { weekStartDate: todayWarsaw, dayCount }
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
