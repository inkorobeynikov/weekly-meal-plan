import { z } from 'zod'
import { householdService } from '@meal-planner/domain'
import { AGE_GROUPS, MEMBER_ROLES } from '@meal-planner/shared'

import { withAuth } from '../../../../../lib/auth-middleware.js'

const ageGroupSchema = z.enum(AGE_GROUPS as readonly [string, ...string[]])
const roleSchema = z.enum(MEMBER_ROLES as readonly [string, ...string[]])
const mealsAtHomeSchema = z.object({
  breakfast: z.boolean(),
  lunch: z.boolean(),
  dinner: z.boolean(),
})

// At least one editable field must be present. `.strict()` rejects unknown keys.
const UpdateMemberSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    approximateAgeGroup: ageGroupSchema.optional(),
    role: roleSchema.optional(),
    // "Eats at home" toggles live here.
    mealsAtHome: mealsAtHomeSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Empty patch' })

interface RouteContext {
  params: Promise<{ memberId: string }>
}

// PATCH /api/family/members/:memberId — edit a member (name, age, role, or the
// "eats at home" mealsAtHome flags). Auth checked FIRST; the update is scoped to
// the authenticated household so cross-household edits are impossible.
export const PATCH = withAuth<RouteContext>(async (req, { user, params }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { memberId } = await params

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateMemberSchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const member = await householdService.updateMember(
    householdId,
    memberId,
    parsed.data as Parameters<typeof householdService.updateMember>[2],
  )
  if (!member) {
    return Response.json({ error: 'Member not found' }, { status: 404 })
  }

  return Response.json(member)
})

// DELETE /api/family/members/:memberId — remove a member. Auth checked FIRST and
// scoped to the authenticated household.
export const DELETE = withAuth<RouteContext>(async (_req, { user, params }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { memberId } = await params

  const removed = await householdService.removeMember(householdId, memberId)
  if (!removed) {
    return Response.json({ error: 'Member not found' }, { status: 404 })
  }

  return Response.json({ ok: true })
})
