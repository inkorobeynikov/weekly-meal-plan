import { and, desc, eq, gte, gt, inArray, lt, ne } from "drizzle-orm";
import {
  db,
  households,
  pushTokens,
  weeklyPlans,
  plannedMeals,
  recipes,
  type WeeklyPlan,
  type PlannedMeal,
  type Recipe,
  type NewRecipe,
} from "@meal-planner/db";
import { deriveMealBadges, type MealBadge } from "@meal-planner/shared";
import {
  getOpenAI,
  MODELS,
  WeeklyPlanSchema,
  RecipeSchema,
  WeeklyPlanFromPoolSchema,
  PoolReplacementSchema,
  zodResponseFormat,
  buildSystemPrompt,
  buildUserPrompt,
  buildPoolSystemPrompt,
  buildPoolSelectionPrompt,
  buildPoolReplacementPrompt,
  type Recipe as AIRecipe,
  type PlannedMeal as AIPlannedMeal,
  type WeeklyPlan as AIWeeklyPlan,
  type WeeklyPlanFromPool,
  type PlanGenerationContext,
} from "@meal-planner/ai";
import * as householdService from "./household.service.js";
import * as feedbackService from "./feedback.service.js";
import * as analyticsService from "./analytics.service.js";
import * as recipeService from "./recipe.service.js";
import type { RecipeCandidate } from "./recipe.service.js";

export interface GeneratePlanInput {
  householdId: string;
  weekStartDate: string; // ISO date (YYYY-MM-DD)
  // Number of consecutive days the plan should cover starting at weekStartDate.
  // Range 1..14; the bot/web pass "today through the Sunday after next".
  dayCount: number;
}

export interface PlanWithMeals {
  plan: WeeklyPlan;
  meals: PlannedMeal[];
}

const MAX_AI_ATTEMPTS = 2;

// HARD CONSTRAINT: allergies and hardRestrictions must never appear in generated recipes.
function findConstraintViolation(
  recipe: AIRecipe,
  forbidden: string[],
): string | null {
  const needles = forbidden
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (needles.length === 0) return null;
  const hay = [
    recipe.title,
    ...recipe.ingredients.map((i) => i.name),
    ...recipe.steps,
    ...recipe.substitutions.flatMap((s) => [
      s.original,
      s.substitute,
      s.note ?? "",
    ]),
    recipe.allergenNotes ?? "",
  ]
    .join(" \n ")
    .toLowerCase();
  for (const needle of needles) {
    if (hay.includes(needle)) return needle;
  }
  return null;
}

function assertNoForbidden(
  meals: AIPlannedMeal[],
  preferences: { allergies: string[]; hardRestrictions: string[] },
): void {
  const forbidden = [...preferences.allergies, ...preferences.hardRestrictions];
  for (const meal of meals) {
    const hit = findConstraintViolation(meal.recipe, forbidden);
    if (hit !== null) {
      throw new Error(
        `HARD CONSTRAINT violated: recipe "${meal.recipe.title}" contains forbidden item "${hit}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 13d — pool-based generation behind PLAN_FROM_POOL=1. The pool path
// SELECTS existing global recipes (source 'imported', householdId NULL); on
// any failure (pool too small, invalid AI selection) it falls back to the
// unchanged ad-hoc generation below.
// ---------------------------------------------------------------------------

function planFromPoolEnabled(): boolean {
  return process.env.PLAN_FROM_POOL === "1";
}

// Thrown by the pool path to trigger the ad-hoc fallback.
class PoolGenerationError extends Error {}

// HARD CONSTRAINT second line of defense for pool picks: even though
// findCandidates already excluded forbidden allergens at the SQL level, run
// the same textual check the ad-hoc path uses over the stored recipe rows.
function findRowConstraintViolation(
  recipe: Recipe,
  forbidden: string[],
): string | null {
  const needles = forbidden
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (needles.length === 0) return null;
  const hay = [
    recipe.title,
    ...recipe.ingredientsJson.map((i) => i.name),
    ...recipe.stepsJson,
    recipe.allergenNotes ?? "",
  ]
    .join(" \n ")
    .toLowerCase();
  for (const needle of needles) {
    if (hay.includes(needle)) return needle;
  }
  return null;
}

// Badge source for a stored pool recipe. The pool has no isKidFriendly column;
// the presence of child-friendly notes is the honest proxy until PR-4 adds one.
function poolBadgeSource(recipe: Recipe): {
  isKidFriendly: boolean;
  isGoodForLeftovers: boolean;
  isTryNew: boolean | null;
} {
  return {
    isKidFriendly: recipe.childFriendlyNotes !== null,
    isGoodForLeftovers: recipe.isGoodForLeftovers,
    isTryNew: recipe.isTryNew,
  };
}

// Validate the model's selections against what was actually offered: every
// recipeId must come from the candidate list, a candidate may be used once
// (except leftovers), and a lunch_leftover must reuse an earlier day's dinner
// that is actually good for leftovers.
function validatePoolSelections(
  plan: WeeklyPlanFromPool,
  candidatesById: Map<string, RecipeCandidate>,
): void {
  const dinnersByOffset = new Map<number, string>();
  for (const meal of plan.meals) {
    if (!candidatesById.has(meal.recipeId)) {
      throw new PoolGenerationError(
        `AI selected recipeId ${meal.recipeId} that was not offered`,
      );
    }
    if (meal.mealType === "dinner") dinnersByOffset.set(meal.dayOffset, meal.recipeId);
  }
  const usedFresh = new Set<string>();
  for (const meal of plan.meals) {
    if (meal.mealType === "lunch_leftover") {
      const parentDinner = dinnersByOffset.get(meal.dayOffset - 1);
      if (parentDinner !== meal.recipeId) {
        throw new PoolGenerationError(
          `lunch_leftover on dayOffset ${meal.dayOffset} does not reuse the previous day's dinner`,
        );
      }
      const candidate = candidatesById.get(meal.recipeId);
      if (!candidate?.isGoodForLeftovers) {
        throw new PoolGenerationError(
          `lunch_leftover reuses "${candidate?.title}" which is not good for leftovers`,
        );
      }
      continue;
    }
    if (usedFresh.has(meal.recipeId)) {
      throw new PoolGenerationError(
        `candidate ${meal.recipeId} selected more than once for fresh meals`,
      );
    }
    usedFresh.add(meal.recipeId);
  }
}

async function callAIForPoolPlan(
  context: PlanGenerationContext,
  candidates: RecipeCandidate[],
): Promise<WeeklyPlanFromPool> {
  const openai = getOpenAI();
  const candidatesById = new Map(candidates.map((c) => [c.id, c]));
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.beta.chat.completions.parse({
        // Selection over ~50 short candidate lines is a much easier task than
        // inventing recipes — the fast tier is enough and keeps it cheap.
        model: MODELS.fast,
        messages: [
          { role: "system", content: buildPoolSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
          { role: "user", content: buildPoolSelectionPrompt(candidates) },
        ],
        response_format: zodResponseFormat(WeeklyPlanFromPoolSchema, "weekly_plan_from_pool"),
      });
      const raw = completion.choices[0]?.message.parsed;
      if (!raw) throw new PoolGenerationError("AI returned no parsed content");
      const plan = WeeklyPlanFromPoolSchema.parse(raw);
      validatePoolSelections(plan, candidatesById);
      return plan;
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_AI_ATTEMPTS) break;
    }
  }
  throw new PoolGenerationError(
    `Pool plan selection failed after ${MAX_AI_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function generatePlanFromPool(
  input: GeneratePlanInput,
  context: PlanGenerationContext,
  dayCount: number,
): Promise<PlanWithMeals> {
  // Phase 13 PR-4: dishes the family queued via "Dodaj do następnego planu".
  // They are force-offered (must-offer) but still subject to the allergen
  // HARD-CONSTRAINT filter inside findCandidates — never bypassed.
  const requestedRecipeIds = await recipeService.getActiveRequestRecipeIds(
    input.householdId,
  );
  const candidates = await recipeService.findCandidates(input.householdId, {
    limit: 50,
    mustOfferRecipeIds: requestedRecipeIds,
  });
  // Need a real choice for every slot; otherwise let the ad-hoc path handle it.
  const minCandidates = Math.max(20, dayCount * 2);
  if (candidates.length < minCandidates) {
    throw new PoolGenerationError(
      `pool too small: ${candidates.length} candidates (< ${minCandidates})`,
    );
  }

  const aiPlan = await callAIForPoolPlan(context, candidates);

  const selectedIds = [...new Set(aiPlan.meals.map((m) => m.recipeId))];
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, selectedIds));
  const rowsById = new Map(recipeRows.map((r) => [r.id, r]));

  // HARD CONSTRAINT: second-line textual guard over the stored recipes.
  const forbidden = [
    ...context.preferences.allergies,
    ...context.preferences.hardRestrictions,
  ];
  for (const id of selectedIds) {
    const row = rowsById.get(id);
    if (!row) throw new PoolGenerationError(`selected recipe ${id} not found`);
    const hit = findRowConstraintViolation(row, forbidden);
    if (hit !== null) {
      throw new PoolGenerationError(
        `HARD CONSTRAINT violated: pool recipe "${row.title}" contains forbidden item "${hit}"`,
      );
    }
  }

  const [planRow] = await db
    .insert(weeklyPlans)
    .values({
      householdId: input.householdId,
      weekStartDate: input.weekStartDate,
      status: "draft",
      aiReasoningSummary: aiPlan.reasoningSummary,
    })
    .returning();
  if (!planRow) throw new Error("Failed to insert weekly_plans row");

  const insertedMeals: PlannedMeal[] = [];
  for (const meal of aiPlan.meals) {
    const recipeRow = rowsById.get(meal.recipeId);
    if (!recipeRow) throw new PoolGenerationError(`selected recipe ${meal.recipeId} not found`);
    const [mealRow] = await db
      .insert(plannedMeals)
      .values({
        weeklyPlanId: planRow.id,
        date: addDays(input.weekStartDate, meal.dayOffset),
        mealType: meal.mealType,
        // Pool mode references the shared global recipe directly — recipe
        // identities stay stable so dishFeedback compounds across weeks.
        recipeId: recipeRow.id,
        leftoversPlanned: meal.leftoversPlanned,
        servings: recipeRow.servings,
        badgesJson: deriveMealBadges({
          ...poolBadgeSource(recipeRow),
          isLeftoverMeal: meal.mealType === "lunch_leftover",
        }),
      })
      .returning();
    if (!mealRow) throw new Error("Failed to insert planned_meal row");
    insertedMeals.push(mealRow);
  }

  // Phase 13 PR-4: mark the family's requests fulfilled for any requested dish
  // that actually landed in the plan. Requests that the AI could not place
  // (e.g. dropped by the allergen filter) stay active for the next plan.
  const fulfilledRequests = requestedRecipeIds.filter((id) =>
    selectedIds.includes(id),
  );
  if (fulfilledRequests.length > 0) {
    await recipeService.markRequestsConsumed(
      input.householdId,
      fulfilledRequests,
      planRow.id,
    );
  }

  await analyticsService.trackEvent(input.householdId, null, "plan_generated", {
    householdId: input.householdId,
    weekStartDate: input.weekStartDate,
    mealCount: insertedMeals.length,
    fromPool: true,
  });

  return { plan: planRow, meals: insertedMeals };
}

// The plan window can run 1..14 days (today through the Sunday after next).
function clampDayCount(value: number): number {
  if (!Number.isFinite(value)) return 7;
  const n = Math.floor(value);
  if (n < 1) return 1;
  if (n > 14) return 14;
  return n;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function recipeToNewRecipe(recipe: AIRecipe, householdId: string): NewRecipe {
  return {
    householdId,
    title: recipe.title,
    source: "ai_generated",
    servings: recipe.servings,
    timeMinutes: recipe.timeMinutes,
    difficulty: recipe.difficulty,
    ingredientsJson: recipe.ingredients,
    stepsJson: recipe.steps,
    substitutionsJson: recipe.substitutions,
    leftoversNotes: recipe.leftoversNotes ?? null,
    storageNotes: recipe.storageNotes ?? null,
    childFriendlyNotes: recipe.childFriendlyNotes ?? null,
    allergenNotes: recipe.allergenNotes ?? null,
    costLevel: recipe.costLevel,
    // F4 "intelligent surface" — LLM-produced fields, already Zod-validated by
    // RecipeSchema before reaching here.
    isTryNew: recipe.isTryNew,
    priceEstimateGrosze: recipe.priceEstimateGrosze ?? null,
    validationStatus: "valid",
  };
}

// F4: derive the per-meal badge set from the recipe flags + meal type. Pure
// logic lives in @meal-planner/shared so the mobile UI uses identical rules.
function deriveBadgesForMeal(
  recipe: AIRecipe,
  mealType: AIPlannedMeal["mealType"],
): MealBadge[] {
  return deriveMealBadges({
    isKidFriendly: recipe.isKidFriendly,
    isGoodForLeftovers: recipe.isGoodForLeftovers,
    isTryNew: recipe.isTryNew,
    isLeftoverMeal: mealType === "lunch_leftover",
  });
}

// F4: scale a recipe's whole-dish grosze estimate to the meal's actual servings
// so the shopping-list cost reflects how much is really cooked. Returns null
// when the recipe has no estimate. Integer grosze in/out — never floats.
function scalePriceGrosze(
  priceEstimateGrosze: number | null | undefined,
  recipeServings: number,
  mealServings: number,
): number | null {
  if (priceEstimateGrosze === null || priceEstimateGrosze === undefined) return null;
  const base = recipeServings > 0 ? recipeServings : 1;
  return Math.round((priceEstimateGrosze * mealServings) / base);
}

async function callAIForWeeklyPlan(
  context: PlanGenerationContext,
): Promise<AIWeeklyPlan> {
  const openai = getOpenAI();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: MODELS.smart,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
        ],
        response_format: zodResponseFormat(WeeklyPlanSchema, "weekly_plan"),
      });
      const raw = completion.choices[0]?.message.parsed;
      if (!raw) throw new Error("AI returned no parsed content");
      const plan = WeeklyPlanSchema.parse(raw);
      // HARD CONSTRAINT: allergies and hardRestrictions must never appear in generated recipes.
      assertNoForbidden(plan.meals, context.preferences);
      return plan;
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_AI_ATTEMPTS) break;
    }
  }
  throw new Error(
    `Failed to generate weekly plan after ${MAX_AI_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function generateWeeklyPlan(
  input: GeneratePlanInput,
): Promise<PlanWithMeals> {
  const household = await householdService.getHouseholdById(input.householdId);
  if (!household) throw new Error(`Household ${input.householdId} not found`);

  const [members, preferences, familyMemory] = await Promise.all([
    householdService.listMembers(input.householdId),
    householdService.getPreferences(input.householdId),
    feedbackService.buildFamilyMemorySummary(input.householdId),
  ]);
  if (!preferences) {
    throw new Error(`Preferences not found for household ${input.householdId}`);
  }

  const dayCount = clampDayCount(input.dayCount);
  const context: PlanGenerationContext = {
    householdName: household.name,
    members: members.map((m) => ({
      displayName: m.displayName,
      ageGroup: m.approximateAgeGroup,
      mealsAtHome: { dinner: m.mealsAtHome.dinner },
    })),
    preferences: {
      likes: preferences.likes,
      dislikes: preferences.dislikes,
      hardRestrictions: preferences.hardRestrictions,
      allergies: preferences.allergies,
      preferredCuisines: preferences.preferredCuisines,
      cookingTimeWeekdayMinutes: preferences.cookingTimeWeekdayMinutes,
      budgetMode: preferences.budgetMode,
      varietyMode: preferences.varietyMode,
      stores: preferences.stores,
    },
    familyMemory: {
      liked: familyMemory.liked,
      disliked: familyMemory.disliked,
      kidsRejected: familyMemory.kidsRejected,
      favorites: familyMemory.favorites,
      goodForLeftovers: familyMemory.goodForLeftovers,
    },
    weekStartDate: input.weekStartDate,
    dayCount,
  };

  // Phase 13d: pool-based selection behind PLAN_FROM_POOL=1. Any pool failure
  // (too few candidates after the allergen hard-filter, invalid selection)
  // falls back to the unchanged ad-hoc generation below.
  if (planFromPoolEnabled()) {
    try {
      return await generatePlanFromPool(input, context, dayCount);
    } catch (err) {
      console.warn(
        `[plan] pool generation failed, falling back to ad-hoc: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const aiPlan = await callAIForWeeklyPlan(context);

  const [planRow] = await db
    .insert(weeklyPlans)
    .values({
      householdId: input.householdId,
      weekStartDate: input.weekStartDate,
      status: "draft",
      aiReasoningSummary: aiPlan.reasoningSummary,
    })
    .returning();
  if (!planRow) throw new Error("Failed to insert weekly_plans row");

  const insertedMeals: PlannedMeal[] = [];
  for (const meal of aiPlan.meals) {
    const [recipeRow] = await db
      .insert(recipes)
      .values(recipeToNewRecipe(meal.recipe, input.householdId))
      .returning();
    if (!recipeRow) throw new Error("Failed to insert recipe row");

    const [mealRow] = await db
      .insert(plannedMeals)
      .values({
        weeklyPlanId: planRow.id,
        date: addDays(input.weekStartDate, meal.dayOffset),
        mealType: meal.mealType,
        recipeId: recipeRow.id,
        leftoversPlanned: meal.leftoversPlanned,
        servings: meal.recipe.servings,
        // F4: persist the derived per-dish badge set so the UI renders it
        // without re-deriving on every read.
        badgesJson: deriveBadgesForMeal(meal.recipe, meal.mealType),
      })
      .returning();
    if (!mealRow) throw new Error("Failed to insert planned_meal row");
    insertedMeals.push(mealRow);
  }

  await analyticsService.trackEvent(input.householdId, null, "plan_generated", {
    householdId: input.householdId,
    weekStartDate: input.weekStartDate,
    mealCount: insertedMeals.length,
  });

  return { plan: planRow, meals: insertedMeals };
}

export async function approvePlan(planId: string): Promise<WeeklyPlan> {
  const [row] = await db
    .update(weeklyPlans)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(weeklyPlans.id, planId))
    .returning();
  if (!row) throw new Error(`Plan ${planId} not found`);
  await analyticsService.trackEvent(row.householdId, null, "plan_approved", {
    planId,
    householdId: row.householdId,
  });
  return row;
}

// F4 "mark cooked" (W02). Marks every planned meal for this recipe within a
// given plan as cooked (idempotent — toggles a timestamp on). A recipe can be
// served as both a dinner and a next-day leftover, so all matching rows flip.
export interface MarkMealCookedInput {
  recipeId: string;
  planId: string;
  cooked: boolean;
}

export async function markMealCooked(
  input: MarkMealCookedInput,
): Promise<{ updated: number }> {
  const rows = await db
    .update(plannedMeals)
    .set({ cookedAt: input.cooked ? new Date() : null })
    .where(
      and(
        eq(plannedMeals.weeklyPlanId, input.planId),
        eq(plannedMeals.recipeId, input.recipeId),
      ),
    )
    .returning({ id: plannedMeals.id });
  return { updated: rows.length };
}

export interface ReplaceMealInput {
  plannedMealId: string;
  reason?: string;
}

interface OtherMealRef {
  date: string;
  mealType: string;
  title: string;
}

async function callAIForSingleRecipe(
  context: PlanGenerationContext,
  reason: string | undefined,
  previousTitle: string,
  mealType: string,
  dayOffset: number,
  otherMeals: OtherMealRef[],
): Promise<AIRecipe> {
  const openai = getOpenAI();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      // Give the model the full picture of what's already on the plate so it
      // doesn't echo an adjacent day's dish (e.g. user regenerates Tuesday
      // lunch and gets salmon again because Monday lunch was also salmon).
      const otherMealsBlock =
        otherMeals.length > 0
          ? [
              "Other meals already in this plan (do NOT repeat or closely resemble any of these — vary the main protein and cuisine across the week, and especially avoid clustering similar dishes on adjacent days):",
              ...otherMeals.map(
                (m) => `- ${m.date} ${m.mealType}: ${m.title}`,
              ),
            ].join("\n")
          : "";

      const replaceInstructions = [
        `Replace a single meal in an existing weekly plan.`,
        `Previous recipe title (do NOT repeat or closely resemble): ${previousTitle}`,
        `Meal type: ${mealType}; dayOffset in the week: ${dayOffset}`,
        reason
          ? `Reason for replacement: ${reason}`
          : "Reason for replacement: (none specified)",
        otherMealsBlock ? "" : null,
        otherMealsBlock || null,
        "",
        "Return exactly one Recipe matching the Recipe JSON schema.",
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      const completion = await openai.beta.chat.completions.parse({
        model: MODELS.smart,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
          { role: "user", content: replaceInstructions },
        ],
        response_format: zodResponseFormat(RecipeSchema, "recipe"),
      });
      const raw = completion.choices[0]?.message.parsed;
      if (!raw) throw new Error("AI returned no parsed content");
      const recipe = RecipeSchema.parse(raw);
      // HARD CONSTRAINT: allergies and hardRestrictions must never appear in generated recipes.
      const forbidden = [
        ...context.preferences.allergies,
        ...context.preferences.hardRestrictions,
      ];
      const hit = findConstraintViolation(recipe, forbidden);
      if (hit !== null) {
        throw new Error(
          `HARD CONSTRAINT violated: replacement recipe contains forbidden item "${hit}"`,
        );
      }
      return recipe;
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_AI_ATTEMPTS) break;
    }
  }
  throw new Error(
    `Failed to generate replacement recipe after ${MAX_AI_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

// What the persistence + leftover-repointing logic needs to know about the
// replacement dish, regardless of whether it came from the pool or ad-hoc.
interface ReplacementPick {
  recipeId: string;
  servings: number;
  isGoodForLeftovers: boolean;
  badgeSource: {
    isKidFriendly: boolean;
    isGoodForLeftovers: boolean;
    isTryNew: boolean | null;
  };
}

// Phase 13d: pool-mode single-slot replacement. Candidates are already
// hard-filtered for allergens at the SQL level; the textual guard runs again
// on the picked row. Throws PoolGenerationError → caller falls back to ad-hoc.
async function pickReplacementFromPool(
  householdId: string,
  context: PlanGenerationContext,
  reason: string | undefined,
  previousTitle: string,
  mealType: string,
  excludeRecipeIds: string[],
  otherMeals: OtherMealRef[],
): Promise<ReplacementPick> {
  const slot = mealType === "dinner" ? "dinner" : "lunch";
  const candidates = await recipeService.findCandidates(householdId, {
    limit: 30,
    mealType: slot,
    excludeRecipeIds,
  });
  if (candidates.length < 3) {
    throw new PoolGenerationError(
      `pool too small for replacement: ${candidates.length} candidates`,
    );
  }
  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  const openai = getOpenAI();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: MODELS.fast,
        messages: [
          { role: "system", content: buildPoolSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
          {
            role: "user",
            content: buildPoolReplacementPrompt(
              candidates,
              previousTitle,
              mealType,
              reason,
              otherMeals,
            ),
          },
        ],
        response_format: zodResponseFormat(PoolReplacementSchema, "pool_replacement"),
      });
      const raw = completion.choices[0]?.message.parsed;
      if (!raw) throw new PoolGenerationError("AI returned no parsed content");
      const pick = PoolReplacementSchema.parse(raw);
      if (!candidatesById.has(pick.recipeId)) {
        throw new PoolGenerationError(
          `AI selected recipeId ${pick.recipeId} that was not offered`,
        );
      }
      const [row] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, pick.recipeId))
        .limit(1);
      if (!row) throw new PoolGenerationError(`selected recipe ${pick.recipeId} not found`);
      // HARD CONSTRAINT: second-line textual guard on the stored recipe.
      const forbidden = [
        ...context.preferences.allergies,
        ...context.preferences.hardRestrictions,
      ];
      const hit = findRowConstraintViolation(row, forbidden);
      if (hit !== null) {
        throw new PoolGenerationError(
          `HARD CONSTRAINT violated: pool recipe "${row.title}" contains forbidden item "${hit}"`,
        );
      }
      return {
        recipeId: row.id,
        servings: row.servings,
        isGoodForLeftovers: row.isGoodForLeftovers,
        badgeSource: poolBadgeSource(row),
      };
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_AI_ATTEMPTS) break;
    }
  }
  throw new PoolGenerationError(
    `Pool replacement failed after ${MAX_AI_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function replaceMeal(
  input: ReplaceMealInput,
): Promise<PlannedMeal> {
  const [existingMeal] = await db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.id, input.plannedMealId))
    .limit(1);
  if (!existingMeal)
    throw new Error(`Planned meal ${input.plannedMealId} not found`);

  const [previousRecipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, existingMeal.recipeId))
    .limit(1);
  if (!previousRecipe)
    throw new Error(`Recipe ${existingMeal.recipeId} not found`);

  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, existingMeal.weeklyPlanId))
    .limit(1);
  if (!plan) throw new Error(`Plan ${existingMeal.weeklyPlanId} not found`);

  const household = await householdService.getHouseholdById(plan.householdId);
  if (!household) throw new Error(`Household ${plan.householdId} not found`);

  const [members, preferences, familyMemory] = await Promise.all([
    householdService.listMembers(plan.householdId),
    householdService.getPreferences(plan.householdId),
    feedbackService.buildFamilyMemorySummary(plan.householdId),
  ]);
  if (!preferences) {
    throw new Error(`Preferences not found for household ${plan.householdId}`);
  }

  const weekStart = String(plan.weekStartDate);
  const mealDate = String(existingMeal.date);
  const dayOffset = Math.round(
    (Date.parse(`${mealDate}T00:00:00Z`) -
      Date.parse(`${weekStart}T00:00:00Z`)) /
      (1000 * 60 * 60 * 24),
  );

  // Pull all the other meals in this plan with their recipe titles so the AI
  // can avoid repeating an adjacent day's dish, AND so we can derive dayCount
  // from the offsets (the Day map in the prompt must match the dates the
  // household actually sees).
  const planMealsWithRecipes = await db
    .select({
      id: plannedMeals.id,
      date: plannedMeals.date,
      mealType: plannedMeals.mealType,
      recipeId: plannedMeals.recipeId,
      recipeTitle: recipes.title,
    })
    .from(plannedMeals)
    .innerJoin(recipes, eq(recipes.id, plannedMeals.recipeId))
    .where(eq(plannedMeals.weeklyPlanId, plan.id));

  const offsets = planMealsWithRecipes.map((m) =>
    Math.round(
      (Date.parse(`${String(m.date)}T00:00:00Z`) -
        Date.parse(`${weekStart}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const dayCount = clampDayCount(
    offsets.length === 0 ? 7 : Math.max(...offsets) + 1,
  );

  const otherMeals: OtherMealRef[] = planMealsWithRecipes
    .filter((m) => m.id !== existingMeal.id)
    .map((m) => ({
      date: String(m.date),
      mealType: String(m.mealType),
      title: m.recipeTitle,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const context: PlanGenerationContext = {
    householdName: household.name,
    members: members.map((m) => ({
      displayName: m.displayName,
      ageGroup: m.approximateAgeGroup,
      mealsAtHome: { dinner: m.mealsAtHome.dinner },
    })),
    preferences: {
      likes: preferences.likes,
      dislikes: preferences.dislikes,
      hardRestrictions: preferences.hardRestrictions,
      allergies: preferences.allergies,
      preferredCuisines: preferences.preferredCuisines,
      cookingTimeWeekdayMinutes: preferences.cookingTimeWeekdayMinutes,
      budgetMode: preferences.budgetMode,
      varietyMode: preferences.varietyMode,
      stores: preferences.stores,
    },
    familyMemory: {
      liked: familyMemory.liked,
      disliked: familyMemory.disliked,
      kidsRejected: familyMemory.kidsRejected,
      favorites: familyMemory.favorites,
      goodForLeftovers: familyMemory.goodForLeftovers,
    },
    weekStartDate: weekStart,
    dayCount,
  };

  // Phase 13d: try a pool pick first (behind PLAN_FROM_POOL=1); fall back to
  // ad-hoc generation on any pool failure. Both paths produce a ReplacementPick.
  let pick: ReplacementPick | null = null;
  if (planFromPoolEnabled()) {
    try {
      pick = await pickReplacementFromPool(
        plan.householdId,
        context,
        input.reason,
        previousRecipe.title,
        existingMeal.mealType,
        planMealsWithRecipes.map((m) => m.recipeId),
        otherMeals,
      );
    } catch (err) {
      console.warn(
        `[plan] pool replacement failed, falling back to ad-hoc: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (!pick) {
    const newRecipe = await callAIForSingleRecipe(
      context,
      input.reason,
      previousRecipe.title,
      existingMeal.mealType,
      dayOffset,
      otherMeals,
    );

    const [recipeRow] = await db
      .insert(recipes)
      .values(recipeToNewRecipe(newRecipe, plan.householdId))
      .returning();
    if (!recipeRow) throw new Error("Failed to insert replacement recipe row");

    pick = {
      recipeId: recipeRow.id,
      servings: newRecipe.servings,
      isGoodForLeftovers: newRecipe.isGoodForLeftovers,
      badgeSource: {
        isKidFriendly: newRecipe.isKidFriendly,
        isGoodForLeftovers: newRecipe.isGoodForLeftovers,
        isTryNew: newRecipe.isTryNew,
      },
    };
  }

  const oldRecipeId = existingMeal.recipeId;

  const [updatedMeal] = await db
    .update(plannedMeals)
    .set({
      recipeId: pick.recipeId,
      servings: pick.servings,
      // F4: re-derive badges for the swapped dish so they stay accurate.
      badgesJson: deriveMealBadges({
        ...pick.badgeSource,
        isLeftoverMeal: existingMeal.mealType === "lunch_leftover",
      }),
    })
    .where(eq(plannedMeals.id, existingMeal.id))
    .returning();
  if (!updatedMeal) throw new Error("Failed to update planned_meal row");

  // Keep adjacent lunch_leftover rows consistent with the parent dinner. The
  // model has no explicit FK from a leftover to its dinner — they're linked
  // implicitly via the shared recipeId. So after swapping a dinner we need to
  // either re-point its leftovers at the new recipe (if the new dish is also
  // good for leftovers) or drop them (otherwise next-day lunch would still
  // show "X — resztki" pointing at a recipe that's no longer cooked).
  let leftoversRepointed = 0;
  let leftoversDeleted = 0;
  if (existingMeal.mealType === "dinner") {
    const linkedLeftovers = await db
      .select({ id: plannedMeals.id })
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.weeklyPlanId, plan.id),
          eq(plannedMeals.recipeId, oldRecipeId),
          eq(plannedMeals.mealType, "lunch_leftover"),
          eq(plannedMeals.leftoversPlanned, true),
          ne(plannedMeals.id, existingMeal.id),
          gt(plannedMeals.date, existingMeal.date),
        ),
      );
    if (linkedLeftovers.length > 0) {
      const ids = linkedLeftovers.map((m) => m.id);
      if (pick.isGoodForLeftovers) {
        await db
          .update(plannedMeals)
          .set({
            recipeId: pick.recipeId,
            servings: pick.servings,
            // These rows are lunch_leftover servings of the new dinner.
            badgesJson: deriveMealBadges({ ...pick.badgeSource, isLeftoverMeal: true }),
          })
          .where(inArray(plannedMeals.id, ids));
        leftoversRepointed = ids.length;
      } else {
        await db
          .delete(plannedMeals)
          .where(inArray(plannedMeals.id, ids));
        leftoversDeleted = ids.length;
      }
    }
  } else if (
    existingMeal.mealType === "lunch_leftover" &&
    updatedMeal.leftoversPlanned
  ) {
    // The user explicitly swapped a leftover lunch — it's now a separately
    // chosen dish, not literal leftovers of the previous dinner.
    await db
      .update(plannedMeals)
      .set({ leftoversPlanned: false })
      .where(eq(plannedMeals.id, updatedMeal.id));
  }

  await analyticsService.trackEvent(plan.householdId, null, "meal_replaced", {
    plannedMealId: input.plannedMealId,
    householdId: plan.householdId,
    leftoversRepointed,
    leftoversDeleted,
  });

  return updatedMeal;
}

// Removes the household's active plan(s) — both draft and approved — along
// with their planned_meals and shopping_lists via DB cascade. Used by /reset
// so the user can regenerate from scratch.
export async function clearActivePlan(
  householdId: string,
): Promise<{ deletedPlans: number }> {
  const deleted = await db
    .delete(weeklyPlans)
    .where(
      and(
        eq(weeklyPlans.householdId, householdId),
        inArray(weeklyPlans.status, ["draft", "approved"]),
      ),
    )
    .returning({ id: weeklyPlans.id });
  await analyticsService.trackEvent(householdId, null, "plan_cleared", {
    householdId,
    deletedPlans: deleted.length,
  });
  return { deletedPlans: deleted.length };
}

export async function getPlanWithMeals(
  planId: string,
): Promise<PlanWithMeals | null> {
  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, planId))
    .limit(1);
  if (!plan) return null;
  const meals = await db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.weeklyPlanId, planId));
  return { plan, meals };
}

export async function getCurrentApprovedPlan(
  householdId: string,
): Promise<WeeklyPlan | null> {
  const [row] = await db
    .select()
    .from(weeklyPlans)
    .where(
      and(
        eq(weeklyPlans.householdId, householdId),
        eq(weeklyPlans.status, "approved"),
      ),
    )
    .orderBy(desc(weeklyPlans.weekStartDate))
    .limit(1);
  return row ?? null;
}

export async function getLatestDraftPlan(
  householdId: string,
): Promise<WeeklyPlan | null> {
  const [row] = await db
    .select()
    .from(weeklyPlans)
    .where(
      and(
        eq(weeklyPlans.householdId, householdId),
        eq(weeklyPlans.status, "draft"),
      ),
    )
    .orderBy(desc(weeklyPlans.createdAt))
    .limit(1);
  return row ?? null;
}

export interface MealWithRecipe {
  meal: PlannedMeal;
  recipe: Recipe;
}

export interface PlanWithMealsAndRecipes {
  plan: WeeklyPlan;
  meals: MealWithRecipe[];
}

export async function getPlanWithMealsAndRecipes(
  planId: string,
): Promise<PlanWithMealsAndRecipes | null> {
  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, planId))
    .limit(1);
  if (!plan) return null;

  const meals = await db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.weeklyPlanId, planId));
  if (meals.length === 0) return { plan, meals: [] };

  const recipeIds = meals.map((m) => m.recipeId);
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, recipeIds));
  const recipeMap = new Map(recipeRows.map((r) => [r.id, r]));

  const joined: MealWithRecipe[] = [];
  for (const meal of meals) {
    const recipe = recipeMap.get(meal.recipeId);
    if (!recipe)
      throw new Error(`Recipe ${meal.recipeId} not found for meal ${meal.id}`);
    joined.push({ meal, recipe });
  }
  joined.sort((a, b) => String(a.meal.date).localeCompare(String(b.meal.date)));
  return { plan, meals: joined };
}

export async function getCurrentPlanForHousehold(
  householdId: string,
): Promise<PlanWithMealsAndRecipes | null> {
  const approved = await getCurrentApprovedPlan(householdId);
  if (approved) return getPlanWithMealsAndRecipes(approved.id);
  const draft = await getLatestDraftPlan(householdId);
  if (draft) return getPlanWithMealsAndRecipes(draft.id);
  return null;
}

export interface RetentionCandidate {
  householdId: string;
}

// Week-2 retention: households created exactly 7 days ago that approved their
// first plan but haven't started a new one (no plan created in the last 3 days).
// Recipients are now reached via push, so we require at least one push token
// instead of a Telegram chat id (the bot is dormant).
export async function getWeekTwoRetentionCandidates(
  referenceDate: Date = new Date(),
): Promise<RetentionCandidate[]> {
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgoStart = new Date(referenceDate.getTime() - 7 * dayMs);
  sevenDaysAgoStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgoEnd = new Date(sevenDaysAgoStart.getTime() + dayMs);
  const threeDaysAgo = new Date(referenceDate.getTime() - 3 * dayMs);

  // Households created in the window that have at least one registered push
  // token. The inner join + distinct collapses multiple tokens to one row.
  const newHouseholds = await db
    .selectDistinct({ id: households.id })
    .from(households)
    .innerJoin(pushTokens, eq(pushTokens.householdId, households.id))
    .where(
      and(
        gte(households.createdAt, sevenDaysAgoStart),
        lt(households.createdAt, sevenDaysAgoEnd),
      ),
    );

  const candidates: RetentionCandidate[] = [];
  for (const h of newHouseholds) {
    const plans = await db
      .select({ status: weeklyPlans.status, createdAt: weeklyPlans.createdAt })
      .from(weeklyPlans)
      .where(eq(weeklyPlans.householdId, h.id));

    const approvedCount = plans.filter((p) => p.status === "approved").length;
    const hasRecentPlan = plans.some((p) => p.createdAt >= threeDaysAgo);
    if (approvedCount === 1 && !hasRecentPlan) {
      candidates.push({ householdId: h.id });
    }
  }
  return candidates;
}
