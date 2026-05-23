import { InlineKeyboard } from 'grammy'
import { householdService, planService } from '@meal-planner/domain'
import type { BotContext } from '../session.js'

// Telegram only accepts HTTPS URLs in web_app buttons. In local dev without a
// tunnel the app URL is http://localhost, so we fall back to a plain link.
function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url)
}

export async function handlePlan(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
  if (!household) {
    await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const planUrl = `${appUrl}/plan`
  const current = await planService.getCurrentPlanForHousehold(household.id)

  if (!current) {
    const keyboard = new InlineKeyboard().text('Tak, generuj', 'generate_plan_yes')
    await ctx.reply(
      'Nie masz jeszcze planu. Wygenerować plan na najbliższy tydzień?',
      { reply_markup: keyboard },
    )
    return
  }

  if (current.plan.status === 'approved') {
    if (isHttpsUrl(appUrl)) {
      const keyboard = new InlineKeyboard().webApp('📋 Otwórz plan', planUrl)
      await ctx.reply('Twój plan na ten tydzień:', { reply_markup: keyboard })
    } else {
      await ctx.reply(`Twój plan na ten tydzień: ${planUrl}`)
    }
    return
  }

  // Draft awaiting approval — let the user open it or approve straight away.
  const keyboard = new InlineKeyboard()
  if (isHttpsUrl(appUrl)) keyboard.webApp('📋 Zobacz plan', planUrl).row()
  keyboard.text('Zatwierdź plan ✅', `ap:${current.plan.id}`)
  const text = isHttpsUrl(appUrl)
    ? 'Masz przygotowany plan do zatwierdzenia:'
    : `Masz przygotowany plan (do zatwierdzenia): ${planUrl}`
  await ctx.reply(text, { reply_markup: keyboard })
}
