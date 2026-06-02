export type MemberRole = 'planning_parent' | 'adult' | 'child'
export type AgeGroup = 'adult' | 'child_0_3' | 'child_4_7' | 'child_8_12' | 'teen'
export type PlanStatus = 'draft' | 'approved' | 'archived'
export type MealType = 'breakfast_template' | 'lunch' | 'lunch_leftover' | 'dinner'
export type RecipeSource = 'ai_generated' | 'user_favorite' | 'imported'
export type ShoppingListStatus = 'active' | 'completed' | 'archived'
export type BuyTiming = 'main_shop' | 'later' | 'optional_if_near_store'
export type ItemStatus = 'pending' | 'bought' | 'not_found' | 'replaced'
export type FeedbackReaction =
  | 'liked'
  | 'dont_repeat'
  | 'kids_didnt_eat'
  | 'too_long'
  | 'too_expensive'
  | 'favorite'
  | 'good_leftovers'
export type BudgetMode = 'economical' | 'normal' | 'flexible'
export type VarietyMode = 'safe' | 'balanced' | 'adventurous'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type CostLevel = 'cheap' | 'moderate' | 'expensive'
export type ValidationStatus = 'pending' | 'valid' | 'invalid'

export interface MealsAtHome {
  breakfast: boolean
  lunch: boolean
  dinner: boolean
}

export interface Ingredient {
  name: string
  quantity: number
  unit: string
}

export interface RecipeSubstitution {
  original: string
  substitute: string
  note?: string
}

export const MEMBER_ROLES: readonly MemberRole[] = ['planning_parent', 'adult', 'child'] as const
export const AGE_GROUPS: readonly AgeGroup[] = [
  'adult',
  'child_0_3',
  'child_4_7',
  'child_8_12',
  'teen',
] as const
export const PLAN_STATUSES: readonly PlanStatus[] = ['draft', 'approved', 'archived'] as const
export const MEAL_TYPES: readonly MealType[] = [
  'breakfast_template',
  'lunch',
  'lunch_leftover',
  'dinner',
] as const
export const RECIPE_SOURCES: readonly RecipeSource[] = [
  'ai_generated',
  'user_favorite',
  'imported',
] as const
export const SHOPPING_LIST_STATUSES: readonly ShoppingListStatus[] = [
  'active',
  'completed',
  'archived',
] as const
export const BUY_TIMINGS: readonly BuyTiming[] = [
  'main_shop',
  'later',
  'optional_if_near_store',
] as const
export const ITEM_STATUSES: readonly ItemStatus[] = [
  'pending',
  'bought',
  'not_found',
  'replaced',
] as const
export const FEEDBACK_REACTIONS: readonly FeedbackReaction[] = [
  'liked',
  'dont_repeat',
  'kids_didnt_eat',
  'too_long',
  'too_expensive',
  'favorite',
  'good_leftovers',
] as const
export const BUDGET_MODES: readonly BudgetMode[] = ['economical', 'normal', 'flexible'] as const
export const VARIETY_MODES: readonly VarietyMode[] = ['safe', 'balanced', 'adventurous'] as const
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const
export const COST_LEVELS: readonly CostLevel[] = ['cheap', 'moderate', 'expensive'] as const
export const VALIDATION_STATUSES: readonly ValidationStatus[] = [
  'pending',
  'valid',
  'invalid',
] as const
