import { inngest } from '@/lib/inngest'
import {
  planService,
  householdService,
  notificationService,
} from '@meal-planner/domain'

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

// Body text for the "plan ready" push: the AI summary (if any) followed by the
// list of planned meals. The tap routes to the plan tab via the data payload.
function buildPlanBody(
  summary: string | null,
  meals: {
    meal: { date: unknown; mealType: string }
    recipe: { title: string }
  }[],
): string {
  const lines: string[] = []
  if (summary) lines.push(summary)
  if (meals.length > 0) {
    if (lines.length > 0) lines.push('')
    for (const { meal, recipe } of meals) {
      lines.push(formatMealLine(String(meal.date), meal.mealType, recipe.title))
    }
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

    // Notify the household via push so they can review and approve the draft.
    // (Replaces the dormant Telegram bot notification.)
    const household = await householdService.getHouseholdById(data.householdId)
    if (household) {
      const full = await planService.getPlanWithMealsAndRecipes(result.plan.id)
      const body = buildPlanBody(
        result.plan.aiReasoningSummary,
        full?.meals ?? [],
      )
      const { sent } = await notificationService.notifyHousehold(
        data.householdId,
        {
          title: '🍽️ Twój plan na ten tydzień jest gotowy!',
          body,
          data: { screen: 'plan', planId: result.plan.id },
        },
      )
      logger.info(
        `Sent plan notification for household ${data.householdId} to ${sent} device(s)`,
      )
    }

    return { planId: result.plan.id, mealCount: result.meals.length }
  },
)
