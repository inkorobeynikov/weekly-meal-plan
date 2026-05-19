import { householdService, planService } from '@meal-planner/domain'
import type { BotContext } from '../session.js'

export async function handleShopping(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
  if (!household) {
    await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
    return
  }

  const plan = await planService.getCurrentApprovedPlan(household.id)
  if (!plan) {
    await ctx.reply('Brak listy zakupów — najpierw zatwierdź tygodniowy plan.')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  await ctx.reply(`Twoja lista zakupów: ${appUrl}/shopping`)
}
