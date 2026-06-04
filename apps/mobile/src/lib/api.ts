import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth';
import type {
  AgeGroup,
  BudgetMode,
  BuyTiming,
  CostLevel,
  Difficulty,
  FeedbackReaction,
  Ingredient,
  ItemStatus,
  MealsAtHome,
  MealType,
  MemberRole,
  PlanStatus,
  RecipeSource,
  RecipeSubstitution,
  ShoppingListStatus,
  ValidationStatus,
  VarietyMode,
} from '@meal-planner/shared';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'mp_token';

// ---------------------------------------------------------------------------
// Token storage (expo-secure-store)
// ---------------------------------------------------------------------------

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Unauthorized handler — lets the UI register a logout/redirect callback that
// fires when the API rejects our token (401).
// ---------------------------------------------------------------------------

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper (mirrors apps/web/lib/api-client.ts request())
// ---------------------------------------------------------------------------

type JsonBody = Record<string, unknown> | unknown[] | null;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: JsonBody;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  };

  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // BetterAuth (expo) persists the session as a cookie under its own SecureStore
  // key. Attach it so the web's withAuth() BetterAuth fallback
  // (auth.api.getSession({ headers })) can authenticate domain API calls — the
  // generic `mp_token` Bearer above only covers the legacy Telegram-JWT path.
  const cookie = (authClient as { getCookie?: () => string }).getCookie?.();
  if (cookie) headers['Cookie'] = cookie;

  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text();

  if (res.status === 401) {
    // Token is no longer valid: drop it and let the UI redirect to login.
    await clearToken();
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Domain response types — mirror packages/db schema $inferSelect rows and the
// domain service return shapes. Dates/timestamps arrive as ISO strings over
// HTTP (JSON has no Date type), so they are typed as `string`.
// ---------------------------------------------------------------------------

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
  mealsAtHome: MealsAtHome;
  telegramUserId: string | null;
  createdAt: string;
}

export interface FamilyPreferences {
  id: string;
  householdId: string;
  likes: string[];
  dislikes: string[];
  // hardRestrictions and allergies are HARD CONSTRAINTS — never violated downstream.
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

// Shape returned by GET /api/plans/current
// (planService.getPlanWithMealsAndRecipes).
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

// PromotionFact rows attached to an item by promoService.matchPromos.
export interface PromotionFact {
  id: string;
  retailer: string;
  productName: string;
  normalizedProductName: string;
  priceText: string | null;
  startDate: string | null;
  endDate: string | null;
  conditionsText: string | null;
  requiresLoyaltyApp: boolean;
  availabilityScope: string;
  sourceUrl: string | null;
  confidenceScore: number;
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
  // Present only when matchPromos found active promotions for this item.
  promoHints?: PromotionFact[];
}

// Shape returned by GET /api/shopping/current ({ list, items }) or `null`.
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

// ---------------------------------------------------------------------------
// Request payload types
// ---------------------------------------------------------------------------

// Matches the PATCH /api/family PrefsPatchSchema (all optional).
export interface UpdatePreferencesInput {
  likes?: string[];
  dislikes?: string[];
  // HARD CONSTRAINTS — affect downstream plan generation.
  hardRestrictions?: string[];
  allergies?: string[];
  preferredCuisines?: string[];
  typicalBreakfasts?: string[];
  cookingTimeWeekdayMinutes?: number;
  budgetMode?: BudgetMode;
  varietyMode?: VarietyMode;
  stores?: string[];
}

// Matches the POST /api/feedback BodySchema (recipeId + reaction required).
export interface SubmitFeedbackInput {
  recipeId: string;
  reaction: FeedbackReaction;
  freeText?: string;
}

export interface GeneratePlanResult {
  status: 'generating';
  weekStartDate: string;
  dayCount: number;
}

export interface FamilyResponse {
  household: Household;
  members: HouseholdMember[];
  preferences: FamilyPreferences | null;
}

export interface AddShoppingItemInput {
  name: string;
  category?: string;
  quantity?: string;
  unit?: string | null;
  buyTiming?: BuyTiming;
}

// ---------------------------------------------------------------------------
// Typed domain wrappers
// ---------------------------------------------------------------------------

// GET /api/plans/current -> current approved (or latest draft) plan with meals.
export function getWeeklyPlan(): Promise<PlanWithMealsAndRecipes> {
  return apiFetch<PlanWithMealsAndRecipes>('/api/plans/current');
}

// POST /api/plans/generate -> enqueues async generation (Inngest).
export function generatePlan(): Promise<GeneratePlanResult> {
  return apiFetch<GeneratePlanResult>('/api/plans/generate', {
    method: 'POST',
    body: null,
  });
}

// POST /api/plans/:id/approve -> { plan }. Also enqueues shopping-list generation.
export function approvePlan(planId: string): Promise<WeeklyPlan> {
  return apiFetch<{ plan: WeeklyPlan }>(`/api/plans/${planId}/approve`, {
    method: 'POST',
    body: null,
  }).then((res) => res.plan);
}

// POST /api/plans/reset -> deletes the household's active plan(s). Dev/testing.
export function resetPlan(): Promise<{ deletedPlans: number }> {
  return apiFetch<{ deletedPlans: number }>('/api/plans/reset', {
    method: 'POST',
    body: null,
  });
}

// POST /api/plans/:planId/meals/:mealId/replace -> { meal }. AI-replaces the meal.
export function replaceMeal(planId: string, mealId: string, reason?: string): Promise<PlannedMeal> {
  return apiFetch<{ meal: PlannedMeal }>(`/api/plans/${planId}/meals/${mealId}/replace`, {
    method: 'POST',
    body: reason !== undefined ? { reason } : null,
  }).then((res) => res.meal);
}

// GET /api/shopping/current -> { list, items } or null (only after approval).
export function getShoppingList(): Promise<ShoppingListWithItems | null> {
  return apiFetch<ShoppingListWithItems | null>('/api/shopping/current');
}

// PATCH /api/shopping/items/:itemId -> { item }. Updates status / replacement text.
export function updateShoppingItem(
  itemId: string,
  status: ItemStatus,
  replacementText?: string,
): Promise<ShoppingListItem> {
  return apiFetch<{ item: ShoppingListItem }>(`/api/shopping/items/${itemId}`, {
    method: 'PATCH',
    body: replacementText !== undefined ? { status, replacementText } : { status },
  }).then((res) => res.item);
}

// DELETE /api/shopping/items/:itemId -> { deleted }. Removes a shopping item.
export function deleteShoppingItem(itemId: string): Promise<{ id: string }> {
  return apiFetch<{ deleted: { id: string } }>(`/api/shopping/items/${itemId}`, {
    method: 'DELETE',
  }).then((res) => res.deleted);
}

// POST /api/shopping/lists/:listId/items -> { item }. Adds a manual item.
export function addShoppingItem(
  listId: string,
  input: AddShoppingItemInput,
): Promise<ShoppingListItem> {
  return apiFetch<{ item: ShoppingListItem }>(`/api/shopping/lists/${listId}/items`, {
    method: 'POST',
    body: { ...input },
  }).then((res) => res.item);
}

// GET /api/family -> household + members + preferences.
export function getHousehold(): Promise<FamilyResponse> {
  return apiFetch<FamilyResponse>('/api/family');
}

// PATCH /api/family -> { preferences }.
export function updatePreferences(data: UpdatePreferencesInput): Promise<FamilyPreferences> {
  return apiFetch<{ preferences: FamilyPreferences }>('/api/family', {
    method: 'PATCH',
    body: { ...data },
  }).then((res) => res.preferences);
}

// POST /api/push/register -> registers this device's Expo push token for the
// authenticated household. Replaces the dormant Telegram notification channel.
export function registerPushToken(
  token: string,
  platform: 'ios' | 'android' | 'web',
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/push/register', {
    method: 'POST',
    body: { token, platform },
  });
}

// GET /api/recipes/:recipeId -> { recipe }.
export function getRecipe(recipeId: string): Promise<Recipe> {
  return apiFetch<{ recipe: Recipe }>(`/api/recipes/${recipeId}`).then((res) => res.recipe);
}

// POST /api/feedback -> { feedback }. weeklyPlanId carried as planId argument.
export function submitFeedback(
  planId: string | null,
  payload: SubmitFeedbackInput,
): Promise<DishFeedback> {
  const body = {
    ...payload,
    ...(planId ? { weeklyPlanId: planId } : {}),
  };
  return apiFetch<{ feedback: DishFeedback }>('/api/feedback', {
    method: 'POST',
    body,
  }).then((res) => res.feedback);
}
