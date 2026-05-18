import { and, eq } from 'drizzle-orm'
import {
  db,
  weeklyPlans,
  plannedMeals,
  type WeeklyPlan,
  type PlannedMeal,
} from '@meal-planner/db'

export interface GeneratePlanInput {
  householdId: string
  weekStartDate: string // ISO date (YYYY-MM-DD)
}

export interface PlanWithMeals {
  plan: WeeklyPlan
  meals: PlannedMeal[]
}

export async function generateWeeklyPlan(input: GeneratePlanInput): Promise<PlanWithMeals> {
  // TODO: call @meal-planner/ai with household profile + family memory,
  //       validate output via Zod, persist plan + meals (recipes upsert), return.
  //       Allergies and hardRestrictions are HARD CONSTRAINTS — reject any plan
  //       that violates them and retry the AI call.
  throw new Error('Not implemented: generateWeeklyPlan')
}

export async function approvePlan(planId: string): Promise<WeeklyPlan> {
  // TODO: set status='approved', approvedAt=now(). Trigger shopping list build downstream.
  const [row] = await db
    .update(weeklyPlans)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(weeklyPlans.id, planId))
    .returning()
  if (!row) throw new Error(`Plan ${planId} not found`)
  return row
}

export interface ReplaceMealInput {
  plannedMealId: string
  reason?: string
}

export async function replaceMeal(_input: ReplaceMealInput): Promise<PlannedMeal> {
  // TODO: call AI for a single replacement recipe; respect same constraints.
  throw new Error('Not implemented: replaceMeal')
}

export async function getPlanWithMeals(planId: string): Promise<PlanWithMeals | null> {
  // TODO
  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, planId))
    .limit(1)
  if (!plan) return null
  const meals = await db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.weeklyPlanId, planId))
  return { plan, meals }
}

export async function getCurrentApprovedPlan(
  householdId: string,
): Promise<WeeklyPlan | null> {
  // TODO: return the most recent approved plan for this household
  const [row] = await db
    .select()
    .from(weeklyPlans)
    .where(
      and(eq(weeklyPlans.householdId, householdId), eq(weeklyPlans.status, 'approved')),
    )
    .limit(1)
  return row ?? null
}
