import { z } from 'zod'
import { shoppingService } from '@meal-planner/domain'
import type { NewShoppingListItem } from '@meal-planner/db'
import { BUY_TIMINGS } from '@meal-planner/shared'
import { withAuth } from '../../../../../../lib/auth-middleware.js'

const BodySchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  quantity: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).nullish(),
  buyTiming: z.enum(BUY_TIMINGS as readonly [string, ...string[]]).optional(),
})

interface RouteContext {
  params: Promise<{ listId: string }>
}

export const POST = withAuth<RouteContext>(async (req, { params }) => {
  const { listId } = await params

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  // Thin controller: derive normalization/categorization via the domain so the
  // business logic stays in packages/domain, then hand a NewShoppingListItem to
  // the service. listId comes from the route params, never from the body.
  const { name, category, quantity, unit, buyTiming } = parsed.data
  const item: NewShoppingListItem = {
    shoppingListId: listId,
    name,
    normalizedName: shoppingService.normalizeName(name),
    category: category ?? shoppingService.categorize(name),
    quantity: quantity ?? '1',
    unit: unit ?? null,
    ...(buyTiming
      ? { buyTiming: buyTiming as NewShoppingListItem['buyTiming'] }
      : {}),
  }

  try {
    const created = await shoppingService.addManualItem(item)
    return Response.json({ item: created })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Add item failed'
    return Response.json({ error: message }, { status: 400 })
  }
})
