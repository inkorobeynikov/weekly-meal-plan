// Typed contracts for the E2E mock API server.
//
// These mirror the response shapes the mobile app consumes in
// `apps/mobile/src/lib/api.ts` (and the BetterAuth expo client in
// `apps/mobile/src/lib/auth.ts`). They are intentionally self-contained so the
// Node server has zero runtime dependency on the React Native app or the
// workspace packages — only the string-literal enums are copied verbatim from
// `@meal-planner/shared`. Strict, no `any`.

// --- enums (copied from @meal-planner/shared) --------------------------------

export type MemberRole = 'planning_parent' | 'adult' | 'child';
export type AgeGroup = 'adult' | 'child_0_3' | 'child_4_7' | 'child_8_12' | 'teen';
export type PlanStatus = 'draft' | 'approved' | 'archived';
export type MealType = 'breakfast_template' | 'lunch' | 'lunch_leftover' | 'dinner';
export type RecipeSource = 'ai_generated' | 'user_favorite' | 'imported';
export type ShoppingListStatus = 'active' | 'completed' | 'archived';
export type BuyTiming = 'main_shop' | 'later' | 'optional_if_near_store';
export type ItemStatus = 'pending' | 'bought' | 'not_found' | 'replaced';
export type FeedbackReaction =
  | 'liked'
  | 'dont_repeat'
  | 'kids_didnt_eat'
  | 'too_difficult'
  | 'favorite';
export type BudgetMode = 'economical' | 'normal' | 'flexible';
export type VarietyMode = 'safe' | 'balanced' | 'adventurous';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type CostLevel = 'cheap' | 'moderate' | 'expensive';
export type ValidationStatus = 'pending' | 'valid' | 'invalid';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface RecipeSubstitution {
  original: string;
  substitute: string;
  note?: string;
}

// --- domain response shapes (mirror api.ts) ----------------------------------

export interface Household {
  id: string;
  name: string;
  locale: string;
  country: string;
  timezone: string;
  telegramChatId: string | null;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  displayName: string;
  role: MemberRole;
  approximateAgeGroup: AgeGroup;
  mealsAtHome: { breakfast: boolean; lunch: boolean; dinner: boolean };
  telegramUserId: string | null;
  createdAt: string;
}

export interface FamilyPreferences {
  id: string;
  householdId: string;
  likes: string[];
  dislikes: string[];
  // HARD CONSTRAINTS — never violated downstream.
  hardRestrictions: string[];
  allergies: string[];
  preferredCuisines: string[];
  typicalBreakfasts: string[];
  cookingTimeWeekdayMinutes: number;
  budgetMode: BudgetMode;
  varietyMode: VarietyMode;
  stores: string[];
  updatedAt: string;
}

export interface Recipe {
  id: string;
  householdId: string | null;
  title: string;
  source: RecipeSource;
  servings: number;
  timeMinutes: number;
  difficulty: Difficulty;
  ingredientsJson: Ingredient[];
  stepsJson: string[];
  substitutionsJson: RecipeSubstitution[];
  leftoversNotes: string | null;
  storageNotes: string | null;
  childFriendlyNotes: string | null;
  allergenNotes: string | null;
  costLevel: CostLevel;
  validationStatus: ValidationStatus;
  createdAt: string;
}

export interface WeeklyPlan {
  id: string;
  householdId: string;
  weekStartDate: string;
  status: PlanStatus;
  aiReasoningSummary: string | null;
  createdAt: string;
  approvedAt: string | null;
}

export interface PlannedMeal {
  id: string;
  weeklyPlanId: string;
  date: string;
  mealType: MealType;
  recipeId: string;
  leftoversPlanned: boolean;
  servings: number;
}

export interface MealWithRecipe {
  meal: PlannedMeal;
  recipe: Recipe;
}

export interface PlanWithMealsAndRecipes {
  plan: WeeklyPlan;
  meals: MealWithRecipe[];
}

export interface ShoppingList {
  id: string;
  weeklyPlanId: string;
  status: ShoppingListStatus;
  createdAt: string;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  name: string;
  normalizedName: string;
  category: string;
  quantity: string;
  unit: string | null;
  neededByDate: string | null;
  buyTiming: BuyTiming;
  relatedRecipeIds: string[];
  status: ItemStatus;
  replacementText: string | null;
  promoHintId: string | null;
}

export interface ShoppingListWithItems {
  list: ShoppingList;
  items: ShoppingListItem[];
}

export interface DishFeedback {
  id: string;
  householdId: string;
  recipeId: string;
  weeklyPlanId: string | null;
  memberId: string | null;
  reaction: FeedbackReaction;
  freeText: string | null;
  createdAt: string;
}

export interface FamilyResponse {
  household: Household;
  members: HouseholdMember[];
  preferences: FamilyPreferences | null;
}

export interface GeneratePlanResult {
  status: 'generating';
  weekStartDate: string;
  dayCount: number;
}

export interface RecipeAlternative {
  recipeId: string;
  name: string;
  imageUri?: string;
  cookTimeMinutes?: number;
  portions?: number;
  matchScore?: number;
}

// --- auth (BetterAuth expo) --------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SignInResponse {
  token: string;
  user: AuthUser;
  redirect: boolean;
}

export interface GetSessionResponse {
  session: AuthSession;
  user: AuthUser;
}

// --- scenarios ---------------------------------------------------------------

// One deterministic fixture set, switchable per Maestro flow via the control
// endpoint `POST /__e2e/scenario`.
export type Scenario =
  | 'no-plan'
  | 'draft-plan'
  | 'approved-plan'
  | 'plan-with-allergen'
  | 'shopping-active'
  | 'shopping-all-bought';

export const SCENARIOS: readonly Scenario[] = [
  'no-plan',
  'draft-plan',
  'approved-plan',
  'plan-with-allergen',
  'shopping-active',
  'shopping-all-bought',
];

export function isScenario(value: string): value is Scenario {
  return (SCENARIOS as readonly string[]).includes(value);
}
