import type { BotContext } from '../session.js'

const HELP_TEXT = `*Weekly Meal Planner*

Dostępne komendy:
/start — rozpocznij konfigurację rodziny
/plan — zobacz tygodniowy plan posiłków
/shopping — otwórz listę zakupów
/help — ta wiadomość`

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' })
}
