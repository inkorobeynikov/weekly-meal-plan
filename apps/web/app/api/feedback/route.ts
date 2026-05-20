import { z } from 'zod'
import { feedbackService } from '@meal-planner/domain'
import { FEEDBACK_REACTIONS, type FeedbackReaction } from '@meal-planner/shared'
import { withAuth } from '../../../lib/auth-middleware.js'

const BodySchema = z
  .object({
    recipeId: z.string().uuid(),
    weeklyPlanId: z.string().uuid().optional(),
    reaction: z.enum(FEEDBACK_REACTIONS as readonly [string, ...string[]]),
    freeText: z.string().max(1000).optional(),
  })
  .strict()

export const POST = withAuth(async (req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

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

  const feedback = await feedbackService.submitDishFeedback({
    householdId,
    recipeId: parsed.data.recipeId,
    weeklyPlanId: parsed.data.weeklyPlanId ?? null,
    reaction: parsed.data.reaction as FeedbackReaction,
    freeText: parsed.data.freeText ?? null,
  })

  return Response.json({ feedback })
})
