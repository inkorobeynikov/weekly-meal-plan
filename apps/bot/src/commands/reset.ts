import { InlineKeyboard } from 'grammy'
import { householdService, planService } from '@meal-planner/domain'
import type { BotContext } from '../session.js'

// /reset asks the user to confirm wiping the active plan + shopping list so
// they can regenerate from scratch (e.g. from today through the Sunday after
// the upcoming one). The actual delete happens in the callback handler.
export async function handleReset(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
  if (!household) {
    await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
    return
  }

  const current = await planService.getCurrentPlanForHousehold(household.id)
  if (!current) {
    const keyboard = new InlineKeyboard().text('Tak, generuj', 'generate_plan_yes')
    await ctx.reply(
      'Nie masz aktywnego planu do usunięcia. Wygenerować nowy plan?',
      { reply_markup: keyboard },
    )
    return
  }

  const keyboard = new InlineKeyboard()
    .text('Tak, usuń', 'reset_plan_yes')
    .text('Anuluj', 'reset_plan_no')
  await ctx.reply(
    'Na pewno usunąć obecny plan i listę zakupów? Tej operacji nie można cofnąć.',
    { reply_markup: keyboard },
  )
}
