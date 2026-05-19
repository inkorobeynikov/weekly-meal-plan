import { z } from 'zod'
import { shoppingService } from '@meal-planner/domain'
import { ITEM_STATUSES } from '@meal-planner/shared'
import { withAuth } from '../../../../../lib/auth-middleware.js'

const BodySchema = z.object({
  status: z.enum(ITEM_STATUSES as readonly [string, ...string[]]),
  replacementText: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ itemId: string }>
}

export const PATCH = withAuth<RouteContext>(async (req, { params }) => {
  const { itemId } = await params

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

  try {
    const item = await shoppingService.updateItemStatus(
      itemId,
      parsed.data.status as Parameters<typeof shoppingService.updateItemStatus>[1],
      parsed.data.replacementText,
    )
    return Response.json({ item })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return Response.json({ error: message }, { status: 404 })
  }
})
