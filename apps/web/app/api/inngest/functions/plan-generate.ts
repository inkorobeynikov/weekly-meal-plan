import { InlineKeyboard } from 'grammy'
import { inngest } from '@/lib/inngest'
import { planService, householdService } from '@meal-planner/domain'
import { getBot } from '@meal-planner/bot/bot'

const DAY_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'] as const

// Polish labels for the meal types we actually generate. lunch_leftover is
// explicitly marked "(resztki)" so the user understands why a Monday dinner
// title also appears on Tuesday as an obiad — it's not a duplicate.
function mealTypeLabel(mealType: string): string {
  if (mealType === 'lunch') return 'obiad'
  if (mealType === 'lunch_leftover') return 'obiad (resztki)'
  if (mealType === 'breakfast_template') return 'śniadanie'
  return 'kolacja'
}

function formatMealLine(
  dateIso: string,
  mealType: string,
  title: string,
): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  const day = DAY_PL[d.getUTCDay()] ?? '??'
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day} ${dd}.${mm} — ${mealTypeLabel(mealType)}: ${title}`
}

// Telegram only accepts HTTPS URLs in web_app buttons. Outside a tunnel (dev),
// the app URL is http://localhost, which is unreachable from the user's phone.
function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url)
}

function buildPlanMessage(
  summary: string | null,
  meals: {
    meal: { date: unknown; mealType: string }
    recipe: { title: string }
  }[],
  appUrl: string,
): string {
  const lines: string[] = ['🍽️ Twój plan na ten tydzień jest gotowy!']
  if (summary) lines.push('', summary)
  if (meals.length > 0) {
    lines.push('')
    for (const { meal, recipe } of meals) {
      lines.push(
        formatMealLine(String(meal.date), meal.mealType, recipe.title),
      )
    }
  }
  // With an HTTPS app URL the user opens the plan via the web_app button below;
  // otherwise (local dev without a tunnel) fall back to a plain link.
  if (appUrl && !isHttpsUrl(appUrl)) {
    lines.push('', `Szczegóły i zamiana dań: ${appUrl}/plan`)
  }
  return lines.join('\n')
}

export const planGenerate = inngest.createFunction(
  { id: 'plan-generate' },
  { event: 'meal-planner/plan.generate' },
  async ({ event, logger }) => {
    const data = event.data as {
      householdId?: string
      weekStartDate?: string
      dayCount?: number
    }
    if (!data.householdId || !data.weekStartDate) {
      throw new Error(
        'plan.generate event requires both householdId and weekStartDate',
      )
    }

    // Fall back to a full week for older events that predate variable-length plans.
    const dayCount = typeof data.dayCount === 'number' ? data.dayCount : 7

    const result = await planService.generateWeeklyPlan({
      householdId: data.householdId,
      weekStartDate: data.weekStartDate,
      dayCount,
    })

    logger.info(
      `Generated weekly plan ${result.plan.id} for household ${data.householdId}`,
    )

    // Notify the household over Telegram so they can review and approve the draft.
    const household = await householdService.getHouseholdById(data.householdId)
    if (household?.telegramChatId) {
      const full = await planService.getPlanWithMealsAndRecipes(result.plan.id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const text = buildPlanMessage(
        result.plan.aiReasoningSummary,
        full?.meals ?? [],
        appUrl,
      )
      const keyboard = new InlineKeyboard()
      if (isHttpsUrl(appUrl)) {
        keyboard.webApp('📋 Zobacz plan', `${appUrl}/plan`).row()
      }
      keyboard.text('Zatwierdź plan ✅', `ap:${result.plan.id}`)
      await getBot().api.sendMessage(household.telegramChatId, text, {
        reply_markup: keyboard,
      })
      logger.info(`Sent plan notification to chat ${household.telegramChatId}`)
    } else {
      logger.info(
        `Household ${data.householdId} has no telegramChatId; skipping notification`,
      )
    }

    return { planId: result.plan.id, mealCount: result.meals.length }
  },
)
