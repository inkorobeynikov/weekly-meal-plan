import { householdService } from '@meal-planner/domain'
import type { BotContext } from '../session.js'

const WELCOME = `👋 Witaj w *Weekly Meal Planner*!

Pomogę Twojej rodzinie zaplanować obiady na cały tydzień:
• Plan posiłków dopasowany do upodobań rodziny
• Wspólna lista zakupów
• Przypomnienia w odpowiednich momentach

Aby zacząć, opowiedz mi trochę o swojej rodzinie.`

export async function handleStart(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) {
    await ctx.reply('Could not determine chat.')
    return
  }

  const existing = await householdService.getHouseholdByTelegramChatId(String(chatId))
  if (existing) {
    ctx.session.householdId = existing.id
    ctx.session.step = 'complete'
    await ctx.reply(`Witaj ponownie, ${existing.name}! Użyj /plan, aby zobaczyć tygodniowy plan.`)
    return
  }

  ctx.session.step = 'awaiting_household_name'
  await ctx.reply(WELCOME, { parse_mode: 'Markdown' })
  await ctx.reply('Jak nazwiemy Twoją rodzinę?')
}
