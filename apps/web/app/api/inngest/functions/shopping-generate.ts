import { inngest } from '@/lib/inngest'
import { shoppingService } from '@meal-planner/domain'

export const shoppingGenerate = inngest.createFunction(
  { id: 'shopping-generate' },
  { event: 'meal-planner/shopping.generate' },
  async ({ event, logger }) => {
    const data = event.data as { planId?: string }
    if (!data.planId) {
      throw new Error('shopping.generate event requires planId')
    }

    const result = await shoppingService.generateShoppingList(data.planId)
    logger.info(
      `Generated shopping list ${result.list.id} for plan ${data.planId} (${result.items.length} items)`,
    )
    return { listId: result.list.id, itemCount: result.items.length }
  },
)
