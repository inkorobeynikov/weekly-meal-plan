import { householdService, feedbackService } from '@meal-planner/domain'
import type { FeedbackReaction } from '@meal-planner/shared'
import type { BotContext } from '../session.js'
import { inngest } from '../lib/inngest.js'

// Short codes keep callback_data under Telegram's 64-byte limit (reaction + recipe UUID).
const FEEDBACK_REACTION_CODES: Record<string, FeedbackReaction> = {
  l: 'liked',
  r: 'dont_repeat',
  k: 'kids_didnt_eat',
}

function currentWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

export async function callbackHandler(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) return

  await ctx.answerCallbackQuery().catch(() => {})

  if (data.startsWith('fb:')) {
    const [, code, recipeId] = data.split(':')
    const reaction = code ? FEEDBACK_REACTION_CODES[code] : undefined
    if (!reaction || !recipeId) return

    const chatId = ctx.chat?.id
    if (!chatId) return

    const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
    if (!household) {
      await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
      return
    }

    await feedbackService.submitDishFeedback({
      householdId: household.id,
      recipeId,
      reaction,
    })
    await ctx.reply('Dzięki za opinię! 🙏')
    return
  }

  if (data === 'generate_plan_yes') {
    const chatId = ctx.chat?.id
    if (!chatId) return

    let householdId = ctx.session.householdId
    if (!householdId) {
      const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
      if (!household) {
        await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
        return
      }
      householdId = household.id
      ctx.session.householdId = household.id
    }

    await inngest.send({
      name: 'meal-planner/plan.generate',
      data: { householdId, weekStartDate: currentWeekStartDate() },
    })

    await ctx.reply('Generuję plan... ⏳ Dostaniesz powiadomienie gdy będzie gotowy.')
    return
  }

  if (data === 'generate_plan_no') {
    await ctx.reply('Ok! Użyj /plan w dowolnym momencie.')
    return
  }
}
