import { getBot } from './bot.js'

async function main(): Promise<void> {
  const bot = getBot()
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

export { getBot } from './bot.js'
