import { and, desc, eq } from 'drizzle-orm'
import {
  db,
  dishFeedback,
  households,
  plannedMeals,
  recipes,
  weeklyPlans,
  type DishFeedback,
  type NewDishFeedback,
  type PlannedMeal,
  type Recipe,
} from '@meal-planner/db'
import type { FeedbackReaction } from '@meal-planner/shared'

export async function submitDishFeedback(input: NewDishFeedback): Promise<DishFeedback> {
  const [row] = await db.insert(dishFeedback).values(input).returning()
  if (!row) throw new Error('Failed to submit feedback')
  return row
}

export async function getWeekFeedback(planId: string): Promise<DishFeedback[]> {
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

const MEMORY_LIMIT_PER_CATEGORY = 20

const REACTION_TO_CATEGORY: Record<FeedbackReaction, keyof FamilyMemorySummary> = {
  liked: 'liked',
  favorite: 'favorites',
  dont_repeat: 'disliked',
  kids_didnt_eat: 'kidsRejected',
  too_long: 'tooLong',
  too_expensive: 'tooExpensive',
  good_leftovers: 'goodForLeftovers',
}

export async function buildFamilyMemorySummary(
  householdId: string,
): Promise<FamilyMemorySummary> {
  const rows = await db
    .select({ reaction: dishFeedback.reaction, title: recipes.title })
    .from(dishFeedback)
    .innerJoin(recipes, eq(dishFeedback.recipeId, recipes.id))
    .where(eq(dishFeedback.householdId, householdId))
    .orderBy(desc(dishFeedback.createdAt))

  const summary: FamilyMemorySummary = {
    liked: [],
    disliked: [],
    kidsRejected: [],
    tooLong: [],
    tooExpensive: [],
    favorites: [],
    goodForLeftovers: [],
  }
  const seen: Record<keyof FamilyMemorySummary, Set<string>> = {
    liked: new Set(),
    disliked: new Set(),
    kidsRejected: new Set(),
    tooLong: new Set(),
    tooExpensive: new Set(),
    favorites: new Set(),
    goodForLeftovers: new Set(),
  }

  for (const row of rows) {
    const category = REACTION_TO_CATEGORY[row.reaction]
    if (!category) continue
    if (seen[category].has(row.title)) continue
    if (summary[category].length >= MEMORY_LIMIT_PER_CATEGORY) continue
    seen[category].add(row.title)
    summary[category].push(row.title)
  }

  return summary
}

export interface MealForReminder {
  meal: PlannedMeal
  recipe: Recipe
  householdId: string
  telegramChatId: string | null
}

// Meals from approved plans cooked on a given date — used by the daily feedback reminder.
export async function getMealsForReminder(date: string): Promise<MealForReminder[]> {
  const rows = await db
    .select({
      meal: plannedMeals,
      recipe: recipes,
      householdId: households.id,
      telegramChatId: households.telegramChatId,
    })
    .from(plannedMeals)
    .innerJoin(weeklyPlans, eq(plannedMeals.weeklyPlanId, weeklyPlans.id))
    .innerJoin(recipes, eq(plannedMeals.recipeId, recipes.id))
    .innerJoin(households, eq(weeklyPlans.householdId, households.id))
    .where(and(eq(plannedMeals.date, date), eq(weeklyPlans.status, 'approved')))
  return rows
}

export async function hasFeedbackForRecipe(
  householdId: string,
  recipeId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dishFeedback.id })
    .from(dishFeedback)
    .where(
      and(eq(dishFeedback.householdId, householdId), eq(dishFeedback.recipeId, recipeId)),
    )
    .limit(1)
  return row !== undefined
}
