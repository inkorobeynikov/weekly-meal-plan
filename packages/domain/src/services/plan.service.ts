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
import {
  getOpenAI,
  MODELS,
  WeeklyPlanSchema,
  RecipeSchema,
  zodResponseFormat,
  buildSystemPrompt,
  buildUserPrompt,
  type Recipe as AIRecipe,
  type PlannedMeal as AIPlannedMeal,
  type WeeklyPlan as AIWeeklyPlan,
  type PlanGenerationContext,
} from "@meal-planner/ai";
import * as householdService from "./household.service.js";
import * as feedbackService from "./feedback.service.js";
import * as analyticsService from "./analytics.service.js";

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
    validationStatus: "valid",
  };
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

  const oldRecipeId = existingMeal.recipeId;

  const [updatedMeal] = await db
    .update(plannedMeals)
    .set({ recipeId: recipeRow.id, servings: newRecipe.servings })
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
      if (newRecipe.isGoodForLeftovers) {
        await db
          .update(plannedMeals)
          .set({ recipeId: recipeRow.id, servings: newRecipe.servings })
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
