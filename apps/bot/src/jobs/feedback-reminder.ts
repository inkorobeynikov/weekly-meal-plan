import { InlineKeyboard } from 'grammy'
import { feedbackService } from '@meal-planner/domain'
import { inngest } from '../lib/inngest.js'
import { getBot } from '../bot.js'

// Yesterday's date (YYYY-MM-DD) in the Europe/Warsaw timezone.
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

export const feedbackReminder = inngest.createFunction(
  { id: 'feedback-reminder' },
  { cron: 'TZ=Europe/Warsaw 0 18 * * *' },
  async ({ logger }) => {
    const date = yesterdayInWarsaw()
    const meals = await feedbackService.getMealsForReminder(date)

    const bot = getBot()
    let sent = 0

    for (const row of meals) {
      if (!row.telegramChatId) continue

      const already = await feedbackService.hasFeedbackForRecipe(
        row.householdId,
        row.recipe.id,
      )
      if (already) continue

      const keyboard = new InlineKeyboard()
        .text('👍 Pyszne', `fb:l:${row.recipe.id}`)
        .text('🔄 Nie powtarzaj', `fb:r:${row.recipe.id}`)
        .text('👶 Dzieci nie jadły', `fb:k:${row.recipe.id}`)

      await bot.api.sendMessage(
        row.telegramChatId,
        `Jak Wam smakowało wczorajsze danie: ${row.recipe.title}?`,
        { reply_markup: keyboard },
      )
      sent += 1
    }

    logger.info(`feedback-reminder: sent ${sent} reminder(s) for meals on ${date}`)
    return { date, sent }
  },
)
