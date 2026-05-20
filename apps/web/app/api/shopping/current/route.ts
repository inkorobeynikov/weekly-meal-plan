import { planService, shoppingService, promoService } from '@meal-planner/domain'
import { withAuth } from '../../../../lib/auth-middleware.js'

export const GET = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const plan = await planService.getCurrentApprovedPlan(householdId)
  if (!plan) return Response.json(null)

  const list = await shoppingService.getShoppingList(plan.id)
  if (!list) return Response.json(null)

  const promosByItem = await promoService.matchPromos(list.items)
  const items = list.items.map((item) => {
    const promoHints = promosByItem.get(item.id)
    return promoHints ? { ...item, promoHints } : item
  })

  return Response.json({ list: list.list, items })
})
