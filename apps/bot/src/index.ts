import { Bot, session, GrammyError, HttpError } from 'grammy'
import { initialSession, type BotContext } from './session.js'
import { handleStart } from './commands/start.js'
import { handlePlan } from './commands/plan.js'
import { handleShopping } from './commands/shopping.js'
import { handleHelp } from './commands/help.js'

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error('BOT_TOKEN is not set')
}

const bot = new Bot<BotContext>(token)

bot.use(session({ initial: initialSession }))

bot.command('start', handleStart)
bot.command('plan', handlePlan)
bot.command('shopping', handleShopping)
bot.command('help', handleHelp)

bot.catch((err) => {
  const ctx = err.ctx
  console.error(`[bot] error for update ${ctx.update.update_id}:`, err.error)
  const e = err.error
  if (e instanceof GrammyError) {
    console.error('Telegram API error:', e.description)
  } else if (e instanceof HttpError) {
    console.error('Network error:', e)
  }
  ctx.reply('Coś poszło nie tak. Spróbuj jeszcze raz za chwilę.').catch(() => {})
})

async function main(): Promise<void> {
  const webhookUrl = process.env.BOT_WEBHOOK_URL
  if (webhookUrl) {
    // Webhook is wired up by the Next.js route at /api/telegram/webhook.
    // In production, the Next.js app forwards updates to grammY.
    console.log(`[bot] webhook mode — Next.js will receive updates at ${webhookUrl}`)
    return
  }

  console.log('[bot] long-polling mode')
  await bot.start({
    onStart: (info) => {
      console.log(`[bot] running as @${info.username}`)
    },
  })
}

main().catch((err) => {
  console.error('[bot] fatal:', err)
  process.exit(1)
})

export { bot }
