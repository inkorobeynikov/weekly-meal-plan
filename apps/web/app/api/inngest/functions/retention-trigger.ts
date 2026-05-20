import { inngest } from '@/lib/inngest'
import { planService, analyticsService } from '@meal-planner/domain'
import { getBot } from '@meal-planner/bot/bot'

const RETENTION_MESSAGE =
  'Cześć! Minął tydzień od Waszego pierwszego planu 🍽️ Czas zaplanować nowy tydzień? Użyj /plan'

export const retentionTrigger = inngest.createFunction(
  { id: 'retention-trigger' },
  { cron: 'TZ=Europe/Warsaw 0 9 * * *' },
  async ({ logger }) => {
    const candidates = await planService.getWeekTwoRetentionCandidates()
    const bot = getBot()
    let sent = 0

    for (const candidate of candidates) {
      await bot.api.sendMessage(candidate.telegramChatId, RETENTION_MESSAGE)
      await analyticsService.trackEvent(
        candidate.householdId,
        null,
        'retention_nudge_sent',
        { householdId: candidate.householdId },
      )
      sent += 1
    }

    logger.info(`retention-trigger: sent ${sent} week-2 nudge(s)`)
    return { sent }
  },
)
