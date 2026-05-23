import { z } from 'zod'
import { planService } from '@meal-planner/domain'
import { withAuth } from '../../../../../../lib/auth-middleware.js'

// Body: ids of planned_meals to replace + a single user-supplied context that
// is forwarded as the `reason` to every individual replacement. Each meal is
// regenerated sequentially because the underlying AI call is expensive and
// the schema validates one recipe at a time.
const BodySchema = z
  .object({
    mealIds: z.array(z.string().uuid()).min(1).max(14),
    context: z.string().max(1000).optional(),
  })
  .strict()

interface RouteContext {
  params: Promise<{ planId: string }>
}

export const POST = withAuth<RouteContext>(async (req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token payload' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const reason = parsed.data.context && parsed.data.context.trim().length > 0
    ? parsed.data.context.trim()
    : undefined

  const results: { mealId: string; ok: boolean; error?: string }[] = []
  for (const mealId of parsed.data.mealIds) {
    try {
      await planService.replaceMeal({ plannedMealId: mealId, reason })
      results.push({ mealId, ok: true })
    } catch (err) {
      results.push({
        mealId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const failed = results.filter((r) => !r.ok)
  return Response.json({ results, failedCount: failed.length })
})
