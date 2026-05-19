import { z } from 'zod'
import { householdService } from '@meal-planner/domain'
import { BUDGET_MODES, VARIETY_MODES } from '@meal-planner/shared'
import { withAuth } from '../../../lib/auth-middleware.js'

export const GET = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const household = await householdService.getHouseholdById(householdId)
  if (!household) {
    return Response.json({ error: 'Household not found' }, { status: 404 })
  }

  const [members, preferences] = await Promise.all([
    householdService.listMembers(householdId),
    householdService.getPreferences(householdId),
  ])

  return Response.json({ household, members, preferences })
})

const PrefsPatchSchema = z
  .object({
    likes: z.array(z.string()).optional(),
    dislikes: z.array(z.string()).optional(),
    // hardRestrictions and allergies are HARD CONSTRAINTS — they affect downstream plan generation.
    hardRestrictions: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    preferredCuisines: z.array(z.string()).optional(),
    typicalBreakfasts: z.array(z.string()).optional(),
    cookingTimeWeekdayMinutes: z.number().int().positive().optional(),
    budgetMode: z.enum(BUDGET_MODES as readonly [string, ...string[]]).optional(),
    varietyMode: z.enum(VARIETY_MODES as readonly [string, ...string[]]).optional(),
    stores: z.array(z.string()).optional(),
  })
  .strict()

export const PATCH = withAuth(async (req, { user }) => {
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

  const parsed = PrefsPatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const existing = await householdService.getPreferences(householdId)
  const merged = {
    householdId,
    ...(existing ?? {}),
    ...parsed.data,
  } as Parameters<typeof householdService.upsertPreferences>[0]

  const preferences = await householdService.upsertPreferences(merged)
  return Response.json({ preferences })
})
