import { InlineKeyboard } from 'grammy'
import { householdService, feedbackService, planService } from '@meal-planner/domain'
import type { FeedbackReaction } from '@meal-planner/shared'
import type { BotContext } from '../session.js'
import { inngest } from '../lib/inngest.js'

// Short codes keep callback_data under Telegram's 64-byte limit (reaction + recipe UUID).
const FEEDBACK_REACTION_CODES: Record<string, FeedbackReaction> = {
  l: 'liked',
  r: 'dont_repeat',
  k: 'kids_didnt_eat',
}

// The plan window now starts TODAY (Europe/Warsaw) and runs through the Sunday
// AFTER the upcoming one — i.e. covers the rest of the current week plus the
// next full week. Length is 8..14 days depending on what weekday today is.
function planWindow(): { weekStartDate: string; dayCount: number } {
  const todayWarsaw = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
  }).format(new Date())
  const start = new Date(`${todayWarsaw}T00:00:00Z`)
  const dow = start.getUTCDay() // 0 = Sunday
  // Days from today to the upcoming Sunday (0 if today is Sunday).
  const daysToUpcomingSunday = (7 - dow) % 7
  // Plan ends on the Sunday after the upcoming one → +7 more days.
  const dayCount = daysToUpcomingSunday + 8
  return { weekStartDate: todayWarsaw, dayCount }
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

    const { weekStartDate, dayCount } = planWindow()
    await inngest.send({
      name: 'meal-planner/plan.generate',
      data: { householdId, weekStartDate, dayCount },
    })

    await ctx.reply('Generuję plan... ⏳ Dostaniesz powiadomienie gdy będzie gotowy.')
    return
  }

  if (data === 'generate_plan_no') {
    await ctx.reply('Ok! Użyj /plan w dowolnym momencie.')
    return
  }

  if (data === 'reset_plan_yes') {
    const chatId = ctx.chat?.id
    if (!chatId) return

    const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
    if (!household) {
      await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
      return
    }

    const { deletedPlans } = await planService.clearActivePlan(household.id)
    if (deletedPlans === 0) {
      await ctx.reply('Nie miałeś aktywnego planu. Możesz wygenerować nowy przez /plan.')
      return
    }

    const keyboard = new InlineKeyboard().text('Tak, generuj', 'generate_plan_yes')
    await ctx.reply(
      `Plan i lista zakupów usunięte. Wygenerować nowy plan (do niedzieli za tydzień)?`,
      { reply_markup: keyboard },
    )
    return
  }

  if (data === 'reset_plan_no') {
    await ctx.reply('Ok, nic nie zmieniam.')
    return
  }

  if (data.startsWith('ap:')) {
    const planId = data.slice(3)
    if (!planId) return

    const chatId = ctx.chat?.id
    if (!chatId) return

    const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
    if (!household) {
      await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
      return
    }

    // Verify the plan belongs to this household before approving.
    const existing = await planService.getPlanWithMeals(planId)
    if (!existing || existing.plan.householdId !== household.id) {
      await ctx.reply('Nie znalazłem tego planu.')
      return
    }

    await planService.approvePlan(planId)
    await inngest.send({
      name: 'meal-planner/shopping.generate',
      data: { planId, householdId: household.id },
    })

    await ctx.reply('Plan zatwierdzony! ✅ Przygotowuję listę zakupów.')
    return
  }
}
