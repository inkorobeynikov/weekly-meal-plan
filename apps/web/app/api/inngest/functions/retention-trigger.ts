import { inngest } from '@/lib/inngest'
import {
  planService,
  analyticsService,
  notificationService,
} from '@meal-planner/domain'

const RETENTION_TITLE = 'Czas na nowy plan? 🍽️'
const RETENTION_BODY =
  'Cześć! Minął tydzień od Waszego pierwszego planu. Zaplanujmy nowy tydzień!'

export const retentionTrigger = inngest.createFunction(
  { id: 'retention-trigger' },
  { cron: 'TZ=Europe/Warsaw 0 9 * * *' },
  async ({ logger }) => {
    const candidates = await planService.getWeekTwoRetentionCandidates()
    let sent = 0

    for (const candidate of candidates) {
      const result = await notificationService.notifyHousehold(
        candidate.householdId,
        {
          title: RETENTION_TITLE,
          body: RETENTION_BODY,
          data: { screen: 'plan' },
        },
      )
      await analyticsService.trackEvent(
        candidate.householdId,
        null,
        'retention_nudge_sent',
        { householdId: candidate.householdId, devices: result.sent },
      )
      sent += 1
    }

    logger.info(`retention-trigger: sent ${sent} week-2 nudge(s)`)
    return { sent }
  },
)
