import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import type {
  MealsAtHome,
  Ingredient,
  RecipeSubstitution,
} from '@meal-planner/shared'

export const memberRoleEnum = pgEnum('member_role', ['planning_parent', 'adult', 'child'])
export const ageGroupEnum = pgEnum('age_group', [
  'adult',
  'child_0_3',
  'child_4_7',
  'child_8_12',
  'teen',
])
export const planStatusEnum = pgEnum('plan_status', ['draft', 'approved', 'archived'])
export const mealTypeEnum = pgEnum('meal_type', [
  'dinner',
  'lunch',
  'lunch_leftover',
  'breakfast_template',
])
export const recipeSourceEnum = pgEnum('recipe_source', [
  'ai_generated',
  'user_favorite',
  'imported',
])
export const shoppingListStatusEnum = pgEnum('shopping_list_status', [
  'active',
  'completed',
  'archived',
])
export const buyTimingEnum = pgEnum('buy_timing', [
  'main_shop',
  'later',
  'optional_if_near_store',
])
export const itemStatusEnum = pgEnum('item_status', [
  'pending',
  'bought',
  'not_found',
  'replaced',
])
export const feedbackReactionEnum = pgEnum('feedback_reaction', [
  'liked',
  'dont_repeat',
  'kids_didnt_eat',
  'too_long',
  'too_expensive',
  'favorite',
  'good_leftovers',
])
export const budgetModeEnum = pgEnum('budget_mode', ['economical', 'normal', 'flexible'])
export const varietyModeEnum = pgEnum('variety_mode', ['safe', 'balanced', 'adventurous'])
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard'])
export const costLevelEnum = pgEnum('cost_level', ['cheap', 'moderate', 'expensive'])
export const validationStatusEnum = pgEnum('validation_status', ['pending', 'valid', 'invalid'])

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  locale: text('locale').notNull().default('pl'),
  country: text('country').notNull().default('PL'),
  timezone: text('timezone').notNull().default('Europe/Warsaw'),
  telegramChatId: text('telegram_chat_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Expo push tokens — the notification channel that replaces the (now dormant)
// Telegram bot. One household can have many tokens (multiple devices/members).
// telegramChatId on households is kept as-is for the dormant bot.
export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  // The authenticated principal that registered this token. Nullable because the
  // token belongs to the household; we don't always have a stable per-user id.
  userId: text('user_id'),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const householdMembers = pgTable('household_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  role: memberRoleEnum('role').notNull().default('adult'),
  approximateAgeGroup: ageGroupEnum('approximate_age_group').notNull().default('adult'),
  mealsAtHome: jsonb('meals_at_home')
    .$type<MealsAtHome>()
    .notNull()
    .default(sql`'{"breakfast":false,"lunch":false,"dinner":true}'::jsonb`),
  telegramUserId: text('telegram_user_id').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyPreferences = pgTable('family_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .unique()
    .references(() => households.id, { onDelete: 'cascade' }),
  likes: jsonb('likes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  dislikes: jsonb('dislikes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // hard_restrictions and allergies are HARD CONSTRAINTS — never violate.
  hardRestrictions: jsonb('hard_restrictions')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  allergies: jsonb('allergies').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  preferredCuisines: jsonb('preferred_cuisines')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  typicalBreakfasts: jsonb('typical_breakfasts')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  cookingTimeWeekdayMinutes: integer('cooking_time_weekday_minutes').notNull().default(45),
  budgetMode: budgetModeEnum('budget_mode').notNull().default('normal'),
  varietyMode: varietyModeEnum('variety_mode').notNull().default('balanced'),
  stores: jsonb('stores').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').references(() => households.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  source: recipeSourceEnum('source').notNull().default('ai_generated'),
  servings: integer('servings').notNull(),
  timeMinutes: integer('time_minutes').notNull(),
  difficulty: difficultyEnum('difficulty').notNull().default('medium'),
  ingredientsJson: jsonb('ingredients_json').$type<Ingredient[]>().notNull(),
  stepsJson: jsonb('steps_json').$type<string[]>().notNull(),
  substitutionsJson: jsonb('substitutions_json')
    .$type<RecipeSubstitution[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  leftoversNotes: text('leftovers_notes'),
  storageNotes: text('storage_notes'),
  childFriendlyNotes: text('child_friendly_notes'),
  allergenNotes: text('allergen_notes'),
  costLevel: costLevelEnum('cost_level').notNull().default('moderate'),
  validationStatus: validationStatusEnum('validation_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const weeklyPlans = pgTable('weekly_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  weekStartDate: date('week_start_date').notNull(),
  status: planStatusEnum('status').notNull().default('draft'),
  aiReasoningSummary: text('ai_reasoning_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
})

export const plannedMeals = pgTable('planned_meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  weeklyPlanId: uuid('weekly_plan_id')
    .notNull()
    .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  mealType: mealTypeEnum('meal_type').notNull().default('dinner'),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id),
  leftoversPlanned: boolean('leftovers_planned').notNull().default(false),
  servings: integer('servings').notNull(),
})

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  weeklyPlanId: uuid('weekly_plan_id')
    .notNull()
    .unique()
    .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
  status: shoppingListStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListId: uuid('shopping_list_id')
    .notNull()
    .references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  category: text('category').notNull(),
  quantity: text('quantity').notNull(),
  unit: text('unit'),
  neededByDate: date('needed_by_date'),
  buyTiming: buyTimingEnum('buy_timing').notNull().default('main_shop'),
  relatedRecipeIds: jsonb('related_recipe_ids')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  status: itemStatusEnum('status').notNull().default('pending'),
  replacementText: text('replacement_text'),
  promoHintId: uuid('promo_hint_id'),
})

export const dishFeedback = pgTable('dish_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id),
  weeklyPlanId: uuid('weekly_plan_id').references(() => weeklyPlans.id),
  memberId: uuid('member_id').references(() => householdMembers.id),
  reaction: feedbackReactionEnum('reaction').notNull(),
  freeText: text('free_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promotionFacts = pgTable('promotion_facts', {
  id: uuid('id').primaryKey().defaultRandom(),
  retailer: text('retailer').notNull(),
  productName: text('product_name').notNull(),
  normalizedProductName: text('normalized_product_name').notNull(),
  priceText: text('price_text'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  conditionsText: text('conditions_text'),
  requiresLoyaltyApp: boolean('requires_loyalty_app').notNull().default(false),
  availabilityScope: text('availability_scope').notNull().default('nationwide'),
  sourceUrl: text('source_url'),
  confidenceScore: integer('confidence_score').notNull().default(80),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').references(() => households.id, {
    onDelete: 'set null',
  }),
  memberId: uuid('member_id').references(() => householdMembers.id, {
    onDelete: 'set null',
  }),
  eventName: text('event_name').notNull(),
  propertiesJson: jsonb('properties_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const householdsRelations = relations(households, ({ many, one }) => ({
  members: many(householdMembers),
  preferences: one(familyPreferences, {
    fields: [households.id],
    references: [familyPreferences.householdId],
  }),
  plans: many(weeklyPlans),
  recipes: many(recipes),
  feedback: many(dishFeedback),
  pushTokens: many(pushTokens),
}))

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  household: one(households, {
    fields: [pushTokens.householdId],
    references: [households.id],
  }),
}))

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
}))

export const familyPreferencesRelations = relations(familyPreferences, ({ one }) => ({
  household: one(households, {
    fields: [familyPreferences.householdId],
    references: [households.id],
  }),
}))

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  household: one(households, {
    fields: [recipes.householdId],
    references: [households.id],
  }),
  plannedMeals: many(plannedMeals),
  feedback: many(dishFeedback),
}))

export const weeklyPlansRelations = relations(weeklyPlans, ({ one, many }) => ({
  household: one(households, {
    fields: [weeklyPlans.householdId],
    references: [households.id],
  }),
  meals: many(plannedMeals),
  shoppingList: one(shoppingLists, {
    fields: [weeklyPlans.id],
    references: [shoppingLists.weeklyPlanId],
  }),
}))

export const plannedMealsRelations = relations(plannedMeals, ({ one }) => ({
  plan: one(weeklyPlans, {
    fields: [plannedMeals.weeklyPlanId],
    references: [weeklyPlans.id],
  }),
  recipe: one(recipes, {
    fields: [plannedMeals.recipeId],
    references: [recipes.id],
  }),
}))

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  plan: one(weeklyPlans, {
    fields: [shoppingLists.weeklyPlanId],
    references: [weeklyPlans.id],
  }),
  items: many(shoppingListItems),
}))

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingListItems.shoppingListId],
    references: [shoppingLists.id],
  }),
}))

export const dishFeedbackRelations = relations(dishFeedback, ({ one }) => ({
  household: one(households, {
    fields: [dishFeedback.householdId],
    references: [households.id],
  }),
  recipe: one(recipes, {
    fields: [dishFeedback.recipeId],
    references: [recipes.id],
  }),
  plan: one(weeklyPlans, {
    fields: [dishFeedback.weeklyPlanId],
    references: [weeklyPlans.id],
  }),
  member: one(householdMembers, {
    fields: [dishFeedback.memberId],
    references: [householdMembers.id],
  }),
}))

export type Household = typeof households.$inferSelect
export type NewHousehold = typeof households.$inferInsert
export type HouseholdMember = typeof householdMembers.$inferSelect
export type NewHouseholdMember = typeof householdMembers.$inferInsert
export type FamilyPreferences = typeof familyPreferences.$inferSelect
export type NewFamilyPreferences = typeof familyPreferences.$inferInsert
export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert
export type WeeklyPlan = typeof weeklyPlans.$inferSelect
export type NewWeeklyPlan = typeof weeklyPlans.$inferInsert
export type PlannedMeal = typeof plannedMeals.$inferSelect
export type NewPlannedMeal = typeof plannedMeals.$inferInsert
export type ShoppingList = typeof shoppingLists.$inferSelect
export type NewShoppingList = typeof shoppingLists.$inferInsert
export type ShoppingListItem = typeof shoppingListItems.$inferSelect
export type NewShoppingListItem = typeof shoppingListItems.$inferInsert
export type DishFeedback = typeof dishFeedback.$inferSelect
export type NewDishFeedback = typeof dishFeedback.$inferInsert
export type PromotionFact = typeof promotionFacts.$inferSelect
export type NewPromotionFact = typeof promotionFacts.$inferInsert
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
export type PushToken = typeof pushTokens.$inferSelect
export type NewPushToken = typeof pushTokens.$inferInsert
