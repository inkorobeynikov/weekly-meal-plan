import { z } from 'zod'
import { db, pushTokens } from '@meal-planner/db'
import { withAuth } from '../../../../lib/auth-middleware.js'

// Body for POST /api/push/register. The Expo push token uniquely identifies a
// device; platform is the reporting OS so we can tune channel behavior later.
const RegisterBodySchema = z
  .object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
  })
  .strict()

// Register (or re-register) the caller's Expo push token for their household.
// Auth is checked first (writes require auth). Upsert on the unique token so a
// device that re-registers — or moves to another household — is reassigned
// rather than duplicated.
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

  const parsed = RegisterBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const userId = typeof user.sub === 'string' ? user.sub : null
  const { token, platform } = parsed.data

  await db
    .insert(pushTokens)
    .values({ householdId, userId, token, platform })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { householdId, userId, platform, updatedAt: new Date() },
    })

  return Response.json({ ok: true })
})
