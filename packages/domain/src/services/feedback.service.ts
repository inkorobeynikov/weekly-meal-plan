import { eq } from 'drizzle-orm'
import {
  db,
  dishFeedback,
  type DishFeedback,
  type NewDishFeedback,
} from '@meal-planner/db'

export async function submitDishFeedback(input: NewDishFeedback): Promise<DishFeedback> {
  // TODO
  const [row] = await db.insert(dishFeedback).values(input).returning()
  if (!row) throw new Error('Failed to submit feedback')
  return row
}

export async function getWeekFeedback(planId: string): Promise<DishFeedback[]> {
  // TODO
  return db.select().from(dishFeedback).where(eq(dishFeedback.weeklyPlanId, planId))
}

export interface FamilyMemorySummary {
  liked: string[]
  disliked: string[]
  kidsRejected: string[]
  tooLong: string[]
  tooExpensive: string[]
  favorites: string[]
  goodForLeftovers: string[]
}

export async function buildFamilyMemorySummary(
  householdId: string,
): Promise<FamilyMemorySummary> {
  // TODO: aggregate reactions per recipe, return distilled signal for AI prompt context.
  const _rows = await db
    .select()
    .from(dishFeedback)
    .where(eq(dishFeedback.householdId, householdId))
  return {
    liked: [],
    disliked: [],
    kidsRejected: [],
    tooLong: [],
    tooExpensive: [],
    favorites: [],
    goodForLeftovers: [],
  }
}
