// Deterministic fixture set for the E2E mock API server.
//
// One canonical household / plan / shopping list, projected into the different
// `Scenario` states the Maestro flows exercise. Everything is static and
// timestamp-free (dates are hard-coded ISO strings) so flows are reproducible
// across machines and runs. Strict, no `any`.

import type {
  DishFeedback,
  FamilyPreferences,
  FamilyResponse,
  Household,
  HouseholdMember,
  MealType,
  MealWithRecipe,
  PlanStatus,
  PlanWithMealsAndRecipes,
  Recipe,
  RecipeAlternative,
  Scenario,
  ShoppingListItem,
  ShoppingListWithItems,
  WeeklyPlan,
} from './types';

export const HOUSEHOLD_ID = 'hh-1';
export const PLAN_ID = 'plan-1';
export const SHOPPING_LIST_ID = 'sl-1';

// A 7-day window (Mon 8th → Sun 14th June 2026). The app derives the day strip
// from these dates, so exactly seven distinct day cells render.
export const WEEK_START_DATE = '2026-06-08';
export const PLAN_DATES: readonly string[] = [
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
  '2026-06-11',
  '2026-06-12',
  '2026-06-13',
  '2026-06-14',
];

// --- recipe builder ----------------------------------------------------------

interface RecipeOpts {
  ingredients: readonly string[];
  allergenNotes?: string;
}

function makeRecipe(id: string, title: string, opts: RecipeOpts): Recipe {
  return {
    id,
    householdId: HOUSEHOLD_ID,
    title,
    source: 'ai_generated',
    servings: 4,
    timeMinutes: 30,
    difficulty: 'easy',
    ingredientsJson: opts.ingredients.map((name, i) => ({
      name,
      quantity: i + 1,
      unit: 'szt',
    })),
    stepsJson: [
      'Przygotuj wszystkie składniki.',
      'Gotuj na średnim ogniu przez 20 minut.',
      'Podawaj na ciepło.',
    ],
    substitutionsJson: [
      { original: 'Ryż', substitute: 'Kasza gryczana', note: 'Bez zmiany czasu gotowania.' },
    ],
    leftoversNotes: null,
    storageNotes: null,
    childFriendlyNotes: 'Dzieci lubią tę potrawę.',
    allergenNotes: opts.allergenNotes ?? null,
    costLevel: 'moderate',
    validationStatus: 'valid',
    createdAt: '2026-06-01T08:00:00.000Z',
  };
}

// Allergen-free ingredient names — none match the KNOWN_ALLERGENS aliases in
// `apps/mobile/src/lib/allergies.ts`, so these recipes always read as safe.
const SAFE: readonly string[][] = [
  ['Pierś z kurczaka', 'Ryż', 'Marchew'],
  ['Ziemniaki', 'Pomidory', 'Cebula'],
  ['Indyk', 'Kasza gryczana', 'Brokuł'],
  ['Papryka', 'Cukinia', 'Bataty'],
  ['Pierś z kurczaka', 'Szpinak', 'Ryż'],
  ['Ziemniaki', 'Marchew', 'Cebula'],
  ['Indyk', 'Papryka', 'Pomidory'],
];

interface DayRecipes {
  lunch: Recipe;
  dinner: Recipe;
}

const LUNCH_TITLES: readonly string[] = [
  'Pieczony kurczak z ryżem',
  'Zapiekane ziemniaki z warzywami',
  'Gulasz z indykiem i kaszą',
  'Warzywa pieczone z batatami',
  'Kurczak ze szpinakiem',
  'Duszone ziemniaki z marchewką',
  'Indyk po prowansalsku',
];

const DINNER_TITLES: readonly string[] = [
  'Zupa pomidorowa',
  'Krem z marchewki',
  'Sałatka z brokułów',
  'Leczo warzywne',
  'Risotto ze szpinakiem',
  'Zupa jarzynowa',
  'Sałatka z papryką',
];

// Two clean recipes per day → 14 base recipes with distinct ids + titles.
const RECIPES_BY_DAY: readonly DayRecipes[] = PLAN_DATES.map((_, d) => ({
  lunch: makeRecipe(`r-lunch-${d}`, LUNCH_TITLES[d] ?? `Obiad ${d + 1}`, {
    ingredients: SAFE[d] ?? SAFE[0]!,
  }),
  dinner: makeRecipe(`r-dinner-${d}`, DINNER_TITLES[d] ?? `Kolacja ${d + 1}`, {
    ingredients: SAFE[(d + 3) % SAFE.length] ?? SAFE[0]!,
  }),
}));

// HARD CONSTRAINT fixture: a recipe that contains gluten ("Mąka pszenna" →
// matches the Gluten alias). Used only in the `plan-with-allergen` scenario,
// where the household declares a Gluten allergy, so approval must be blocked.
const ALLERGEN_RECIPE: Recipe = makeRecipe('r-allergen', 'Spaghetti bolognese', {
  ingredients: ['Makaron pszenny', 'Mąka pszenna', 'Pomidory'],
  allergenNotes: 'Zawiera gluten (mąka pszenna).',
});

// Registry for GET /api/recipes/:id — every recipe referenced by any plan.
const RECIPE_REGISTRY: ReadonlyMap<string, Recipe> = new Map<string, Recipe>([
  ...RECIPES_BY_DAY.flatMap((day): [string, Recipe][] => [
    [day.lunch.id, day.lunch],
    [day.dinner.id, day.dinner],
  ]),
  [ALLERGEN_RECIPE.id, ALLERGEN_RECIPE],
]);

export function getRecipeById(id: string): Recipe | null {
  return RECIPE_REGISTRY.get(id) ?? null;
}

// --- plan --------------------------------------------------------------------

function makePlan(status: PlanStatus): WeeklyPlan {
  return {
    id: PLAN_ID,
    householdId: HOUSEHOLD_ID,
    weekStartDate: WEEK_START_DATE,
    status,
    aiReasoningSummary: 'Zbilansowany plan dopasowany do preferencji rodziny.',
    createdAt: '2026-06-07T18:00:00.000Z',
    approvedAt: status === 'approved' ? '2026-06-07T19:00:00.000Z' : null,
  };
}

function makeMeal(
  id: string,
  date: string,
  mealType: MealType,
  recipe: Recipe,
): MealWithRecipe {
  return {
    meal: {
      id,
      weeklyPlanId: PLAN_ID,
      date,
      mealType,
      recipeId: recipe.id,
      leftoversPlanned: false,
      servings: 4,
    },
    recipe,
  };
}

// One obiad (lunch) + one kolacja (dinner) per day. In `plan-with-allergen`
// the first day's lunch is swapped for the gluten recipe.
function buildMeals(scenario: Scenario): MealWithRecipe[] {
  const meals: MealWithRecipe[] = [];
  PLAN_DATES.forEach((date, d) => {
    const day = RECIPES_BY_DAY[d]!;
    const lunchRecipe = scenario === 'plan-with-allergen' && d === 0 ? ALLERGEN_RECIPE : day.lunch;
    meals.push(makeMeal(`m-lunch-${d}`, date, 'lunch', lunchRecipe));
    meals.push(makeMeal(`m-dinner-${d}`, date, 'dinner', day.dinner));
  });
  return meals;
}

export function buildPlanResponse(
  scenario: Scenario,
  statusOverride?: PlanStatus,
): PlanWithMealsAndRecipes {
  const status: PlanStatus =
    statusOverride ?? (scenario === 'approved-plan' ? 'approved' : 'draft');
  return { plan: makePlan(status), meals: buildMeals(scenario) };
}

// --- family ------------------------------------------------------------------

const HOUSEHOLD: Household = {
  id: HOUSEHOLD_ID,
  name: 'Rodzina Testowa',
  locale: 'pl-PL',
  country: 'PL',
  timezone: 'Europe/Warsaw',
  telegramChatId: null,
  createdAt: '2026-05-01T10:00:00.000Z',
};

const MEMBERS: readonly HouseholdMember[] = [
  {
    id: 'mem-1',
    householdId: HOUSEHOLD_ID,
    displayName: 'Anna',
    role: 'planning_parent',
    approximateAgeGroup: 'adult',
    mealsAtHome: { breakfast: true, lunch: true, dinner: true },
    telegramUserId: null,
    createdAt: '2026-05-01T10:00:00.000Z',
  },
  {
    id: 'mem-2',
    householdId: HOUSEHOLD_ID,
    displayName: 'Tomek',
    role: 'child',
    approximateAgeGroup: 'child_4_7',
    mealsAtHome: { breakfast: true, lunch: false, dinner: true },
    telegramUserId: null,
    createdAt: '2026-05-01T10:00:00.000Z',
  },
];

export function buildPreferences(allergies: string[]): FamilyPreferences {
  return {
    id: 'prefs-1',
    householdId: HOUSEHOLD_ID,
    likes: ['Makaron', 'Kurczak'],
    dislikes: [],
    // HARD CONSTRAINTS.
    hardRestrictions: [],
    allergies,
    preferredCuisines: ['Polska'],
    typicalBreakfasts: ['Owsianka'],
    cookingTimeWeekdayMinutes: 30,
    budgetMode: 'normal',
    varietyMode: 'balanced',
    stores: ['Biedronka'],
    updatedAt: '2026-06-01T12:00:00.000Z',
  };
}

// The household declares a Gluten allergy only in the allergen scenario, so the
// allergen recipe collides and approval is blocked. Other scenarios are clean.
export function familyAllergiesFor(scenario: Scenario): string[] {
  return scenario === 'plan-with-allergen' ? ['Gluten'] : [];
}

export function buildFamilyResponse(scenario: Scenario): FamilyResponse {
  return {
    household: HOUSEHOLD,
    members: [...MEMBERS],
    preferences: buildPreferences(familyAllergiesFor(scenario)),
  };
}

// --- shopping ----------------------------------------------------------------

interface SeedItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string | null;
}

const SHOPPING_SEED: readonly SeedItem[] = [
  { id: 'it-1', name: 'Pomidory', category: 'Warzywa', quantity: '6', unit: 'szt' },
  { id: 'it-2', name: 'Marchew', category: 'Warzywa', quantity: '1', unit: 'kg' },
  { id: 'it-3', name: 'Jogurt naturalny', category: 'Nabiał', quantity: '2', unit: 'szt' },
  { id: 'it-4', name: 'Pierś z kurczaka', category: 'Mięso', quantity: '1', unit: 'kg' },
  { id: 'it-5', name: 'Chleb', category: 'Pieczywo', quantity: '1', unit: 'szt' },
  { id: 'it-6', name: 'Ryż', category: 'Inne', quantity: '500', unit: 'g' },
];

export function buildShoppingItems(allBought: boolean): ShoppingListItem[] {
  return SHOPPING_SEED.map((seed) => ({
    id: seed.id,
    shoppingListId: SHOPPING_LIST_ID,
    name: seed.name,
    normalizedName: seed.name.toLowerCase(),
    category: seed.category,
    quantity: seed.quantity,
    unit: seed.unit,
    neededByDate: null,
    buyTiming: 'main_shop',
    relatedRecipeIds: [],
    status: allBought ? 'bought' : 'pending',
    replacementText: null,
    promoHintId: null,
  }));
}

export function buildShoppingResponse(allBought: boolean): ShoppingListWithItems {
  return {
    list: {
      id: SHOPPING_LIST_ID,
      weeklyPlanId: PLAN_ID,
      status: allBought ? 'completed' : 'active',
      createdAt: '2026-06-07T19:05:00.000Z',
    },
    items: buildShoppingItems(allBought),
  };
}

// --- alternatives (swap sheet) ----------------------------------------------

export const ALTERNATIVES: readonly RecipeAlternative[] = [
  { recipeId: 'r-alt-1', name: 'Naleśniki z warzywami', cookTimeMinutes: 25, portions: 4, matchScore: 0.94 },
  { recipeId: 'r-alt-2', name: 'Pieczone bataty z kurczakiem', cookTimeMinutes: 40, portions: 4, matchScore: 0.88 },
  { recipeId: 'r-alt-3', name: 'Risotto z cukinią', cookTimeMinutes: 35, portions: 4, matchScore: 0.81 },
];

// --- feedback ----------------------------------------------------------------

export function buildFeedback(
  recipeId: string,
  reaction: DishFeedback['reaction'],
  weeklyPlanId: string | null,
  freeText: string | null,
): DishFeedback {
  return {
    id: `fb-${recipeId}`,
    householdId: HOUSEHOLD_ID,
    recipeId,
    weeklyPlanId,
    memberId: null,
    reaction,
    freeText,
    createdAt: '2026-06-15T09:00:00.000Z',
  };
}
