import { inngest } from '@/lib/inngest'
import { planService } from '@meal-planner/domain'

export const planGenerate = inngest.createFunction(
  { id: 'plan-generate' },
  { event: 'meal-planner/plan.generate' },
  async ({ event, logger }) => {
    const data = event.data as { householdId?: string; weekStartDate?: string }
    if (!data.householdId || !data.weekStartDate) {
      throw new Error(
        'plan.generate event requires both householdId and weekStartDate',
      )
    }

    const result = await planService.generateWeeklyPlan({
      householdId: data.householdId,
      weekStartDate: data.weekStartDate,
    })

    logger.info(
      `Generated weekly plan ${result.plan.id} for household ${data.householdId}`,
    )
    return { planId: result.plan.id, mealCount: result.meals.length }
  },
)
