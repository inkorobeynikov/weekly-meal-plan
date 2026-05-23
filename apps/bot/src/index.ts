import { getBot } from './bot.js'

// A persistent "Open app" button next to the message field, opening the Mini
// App. Telegram requires HTTPS, so this is only set when the app URL is public
// (e.g. behind a cloudflared tunnel in dev, or the deployed URL in prod).
async function configureMenuButton(bot: ReturnType<typeof getBot>): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (!/^https:\/\//i.test(appUrl)) {
    console.log('[bot] NEXT_PUBLIC_APP_URL is not HTTPS; skipping Mini App menu button')
    return
  }
  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Otwórz plan',
        web_app: { url: `${appUrl}/plan` },
      },
    })
    console.log(`[bot] Mini App menu button set → ${appUrl}/plan`)
  } catch (err) {
    console.error('[bot] failed to set menu button:', err)
  }
}

async function main(): Promise<void> {
  const bot = getBot()
  await configureMenuButton(bot)
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
