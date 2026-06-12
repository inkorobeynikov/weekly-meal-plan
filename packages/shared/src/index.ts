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
// Canonical allergen vocabulary for the imported recipe pool (Phase 13).
// allergies/hardRestrictions are HARD CONSTRAINTS — this fixed list enables
// SQL-level pre-filtering of pool recipes before anything reaches the prompt.
export type CanonicalAllergen =
  | 'gluten'
  | 'laktoza'
  | 'jaja'
  | 'orzechy'
  | 'ryby'
  | 'skorupiaki'
  | 'soja'
  | 'seler'
  | 'gorczyca'
  | 'sezam'

// F4 "intelligent surface": per-dish badges surfaced on the day cards (W01/W04)
// and recipe detail (W02). Derived from recipe flags in the domain layer and
// persisted on each planned meal so the UI can render them without re-deriving.
export type MealBadge = 'kid_ok' | 'leftovers' | 'try_new'

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
export const MEAL_BADGES: readonly MealBadge[] = ['kid_ok', 'leftovers', 'try_new'] as const

// ---------------------------------------------------------------------------
// F4 "intelligent surface" — pure helpers for per-dish badges and price/cost
// formatting. Kept in `shared` so both the domain layer (badge persistence) and
// the mobile UI (rendering) use exactly the same derivation/formatting rules.
// All money is in GROSZE (integer minor units) — never floats.
// ---------------------------------------------------------------------------

export interface MealBadgeSource {
  isKidFriendly: boolean
  isGoodForLeftovers: boolean
  isTryNew: boolean | null
  // True only for an actual leftover meal (mealType === 'lunch_leftover').
  isLeftoverMeal: boolean
}

// Derive the ordered, de-duplicated badge set for one planned meal from its
// recipe flags. Order is stable: kid_ok → leftovers → try_new.
export function deriveMealBadges(source: MealBadgeSource): MealBadge[] {
  const badges: MealBadge[] = []
  if (source.isKidFriendly) badges.push('kid_ok')
  // "Leftovers" applies both to a dish explicitly cooked-for-leftovers and to a
  // meal that IS a leftover serving of a previous dinner.
  if (source.isGoodForLeftovers || source.isLeftoverMeal) badges.push('leftovers')
  if (source.isTryNew === true) badges.push('try_new')
  return badges
}

const MEAL_BADGE_LABELS: Record<MealBadge, string> = {
  kid_ok: 'Dla dzieci',
  leftovers: 'Na zapas',
  try_new: 'Coś nowego',
}

export function mealBadgeLabel(badge: MealBadge): string {
  return MEAL_BADGE_LABELS[badge]
}

// Format an integer grosze amount as a Polish złoty string, e.g. 1299 → "12,99 zł".
// Returns null for null/negative/non-finite input so callers can omit the price.
export function formatGroszeAsZl(grosze: number | null | undefined): string | null {
  if (grosze === null || grosze === undefined) return null
  if (!Number.isFinite(grosze) || grosze < 0) return null
  const zl = Math.round(grosze) / 100
  return `${zl.toFixed(2).replace('.', ',')} zł`
}

const COST_LEVEL_LABELS: Record<CostLevel, string> = {
  cheap: 'Tanio',
  moderate: 'Średnio',
  expensive: 'Drożej',
}

export function costLevelLabel(level: CostLevel): string {
  return COST_LEVEL_LABELS[level]
}

export const CANONICAL_ALLERGENS: readonly CanonicalAllergen[] = [
  'gluten',
  'laktoza',
  'jaja',
  'orzechy',
  'ryby',
  'skorupiaki',
  'soja',
  'seler',
  'gorczyca',
  'sezam',
] as const
