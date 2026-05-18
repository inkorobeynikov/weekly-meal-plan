import { eq } from 'drizzle-orm'
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
