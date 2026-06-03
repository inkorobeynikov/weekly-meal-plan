import { inngest } from '@/lib/inngest'
import { feedbackService, notificationService } from '@meal-planner/domain'

// Yesterday's date (YYYY-MM-DD) in the Europe/Warsaw timezone. The cron itself
// fires at 18:00 Warsaw time; this picks the day we're asking feedback about.
function yesterdayInWarsaw(): string {
  const now = new Date()
  const warsawNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }),
  )
  warsawNow.setDate(warsawNow.getDate() - 1)
  const year = warsawNow.getFullYear()
  const month = String(warsawNow.getMonth() + 1).padStart(2, '0')
  const day = String(warsawNow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Daily feedback reminder. Migrated from the (dormant) Telegram bot cron job at
// apps/bot/src/jobs/feedback-reminder.ts — same 18:00 Europe/Warsaw schedule,
// now delivered via push. The tap routes to the feedback screen for the recipe.
export const feedbackReminder = inngest.createFunction(
  { id: 'feedback-reminder' },
  { cron: 'TZ=Europe/Warsaw 0 18 * * *' },
  async ({ logger }) => {
    const date = yesterdayInWarsaw()
    const meals = await feedbackService.getMealsForReminder(date)

    let sent = 0

    for (const row of meals) {
      const already = await feedbackService.hasFeedbackForRecipe(
        row.householdId,
        row.recipe.id,
      )
      if (already) continue

      const result = await notificationService.notifyHousehold(
        row.householdId,
        {
          title: 'Jak smakowało? 🍽️',
          body: `Jak Wam smakowało wczorajsze danie: ${row.recipe.title}?`,
          data: {
            screen: 'feedback',
            planId: row.meal.weeklyPlanId,
            recipeId: row.recipe.id,
          },
        },
      )
      if (result.sent > 0) sent += 1
    }

    logger.info(`feedback-reminder: sent ${sent} reminder(s) for meals on ${date}`)
    return { date, sent }
  },
)
