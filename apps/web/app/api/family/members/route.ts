import { z } from 'zod'
import { householdService } from '@meal-planner/domain'
import type { NewHouseholdMember } from '@meal-planner/db'
import { AGE_GROUPS, MEMBER_ROLES } from '@meal-planner/shared'

import { withAuth } from '../../../../lib/auth-middleware.js'

const ageGroupSchema = z.enum(AGE_GROUPS as readonly [string, ...string[]])
const roleSchema = z.enum(MEMBER_ROLES as readonly [string, ...string[]])
const mealsAtHomeSchema = z.object({
  breakfast: z.boolean(),
  lunch: z.boolean(),
  dinner: z.boolean(),
})

const CreateMemberSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    approximateAgeGroup: ageGroupSchema.optional(),
    role: roleSchema.optional(),
    mealsAtHome: mealsAtHomeSchema.optional(),
  })
  .strict()

// Derive a sensible role from the age group when the client doesn't send one:
// the youngest groups are children, everyone else is an adult.
function roleFromAge(ageGroup: string): 'adult' | 'child' {
  return ageGroup === 'adult' || ageGroup === 'teen' ? 'adult' : 'child'
}

// POST /api/family/members — create a household member. Auth is checked FIRST
// via withAuth; the member is always scoped to the authenticated household.
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

  const parsed = CreateMemberSchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const ageGroup = parsed.data.approximateAgeGroup ?? 'adult'
  const role = parsed.data.role ?? roleFromAge(ageGroup)

  const member = await householdService.addMember({
    householdId,
    displayName: parsed.data.displayName,
    approximateAgeGroup: ageGroup as NewHouseholdMember['approximateAgeGroup'],
    role: role as NewHouseholdMember['role'],
    ...(parsed.data.mealsAtHome ? { mealsAtHome: parsed.data.mealsAtHome } : {}),
  })

  return Response.json(member, { status: 201 })
})
