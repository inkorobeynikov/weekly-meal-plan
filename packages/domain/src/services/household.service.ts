import { and, eq } from 'drizzle-orm'
import {
  db,
  households,
  householdMembers,
  familyPreferences,
  type Household,
  type NewHousehold,
  type HouseholdMember,
  type NewHouseholdMember,
  type FamilyPreferences,
  type NewFamilyPreferences,
} from '@meal-planner/db'

export async function createHousehold(input: NewHousehold): Promise<Household> {
  // TODO: insert household + default preferences row in a transaction
  const [row] = await db.insert(households).values(input).returning()
  if (!row) throw new Error('Failed to create household')
  return row
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  // TODO
  const [row] = await db.select().from(households).where(eq(households.id, id)).limit(1)
  return row ?? null
}

export async function getHouseholdByTelegramChatId(
  chatId: string,
): Promise<Household | null> {
  // TODO
  const [row] = await db
    .select()
    .from(households)
    .where(eq(households.telegramChatId, chatId))
    .limit(1)
  return row ?? null
}

export async function updateHousehold(
  id: string,
  patch: Partial<NewHousehold>,
): Promise<Household> {
  // TODO
  const [row] = await db
    .update(households)
    .set(patch)
    .where(eq(households.id, id))
    .returning()
  if (!row) throw new Error(`Household ${id} not found`)
  return row
}

// Persist the household-level facts collected during W06 onboarding (name +
// stated family size) and stamp the server-side onboarding-complete marker so
// returning users (e.g. after a reinstall) can skip onboarding from server
// state, not just the on-device flag. Fields are optional so callers can save a
// partial step; `markComplete` controls whether the completion timestamp is set
// (only set once, never cleared back to null here).
export async function completeOnboarding(
  id: string,
  input: { name?: string; memberCount?: number; markComplete?: boolean },
): Promise<Household> {
  const patch: Partial<NewHousehold> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.memberCount !== undefined) patch.memberCount = input.memberCount
  if (input.markComplete) patch.onboardingCompletedAt = new Date()

  const [row] = await db
    .update(households)
    .set(patch)
    .where(eq(households.id, id))
    .returning()
  if (!row) throw new Error(`Household ${id} not found`)
  return row
}

export async function addMember(input: NewHouseholdMember): Promise<HouseholdMember> {
  // TODO
  const [row] = await db.insert(householdMembers).values(input).returning()
  if (!row) throw new Error('Failed to add member')
  return row
}

export async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  // TODO
  return db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId))
}

// Patchable fields for a member. We never accept `householdId` here — a member
// can't be moved between households via this path (ownership is enforced by the
// `householdId` filter in the WHERE clause below).
export type MemberPatch = Partial<
  Pick<NewHouseholdMember, 'displayName' | 'role' | 'approximateAgeGroup' | 'mealsAtHome'>
>

// Update a member, scoped to its household so a caller can only ever touch
// members of the household they are authenticated for. Returns null when no row
// matched (wrong household or unknown id), letting the route answer 404.
export async function updateMember(
  householdId: string,
  memberId: string,
  patch: MemberPatch,
): Promise<HouseholdMember | null> {
  const [row] = await db
    .update(householdMembers)
    .set(patch)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, householdId),
      ),
    )
    .returning()
  return row ?? null
}

// Remove a member, scoped to its household. Returns true when a row was deleted.
export async function removeMember(
  householdId: string,
  memberId: string,
): Promise<boolean> {
  const rows = await db
    .delete(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, householdId),
      ),
    )
    .returning({ id: householdMembers.id })
  return rows.length > 0
}

export async function getPreferences(
  householdId: string,
): Promise<FamilyPreferences | null> {
  // TODO
  const [row] = await db
    .select()
    .from(familyPreferences)
    .where(eq(familyPreferences.householdId, householdId))
    .limit(1)
  return row ?? null
}

export async function upsertPreferences(
  input: NewFamilyPreferences,
): Promise<FamilyPreferences> {
  // TODO: upsert on householdId
  const existing = await getPreferences(input.householdId)
  if (existing) {
    const [row] = await db
      .update(familyPreferences)
      .set(input)
      .where(eq(familyPreferences.householdId, input.householdId))
      .returning()
    if (!row) throw new Error('Failed to update preferences')
    return row
  }
  const [row] = await db.insert(familyPreferences).values(input).returning()
  if (!row) throw new Error('Failed to create preferences')
  return row
}
