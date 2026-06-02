CREATE TYPE "public"."age_group" AS ENUM('adult', 'child_0_3', 'child_4_7', 'child_8_12', 'teen');--> statement-breakpoint
CREATE TYPE "public"."budget_mode" AS ENUM('economical', 'normal', 'flexible');--> statement-breakpoint
CREATE TYPE "public"."buy_timing" AS ENUM('main_shop', 'later', 'optional_if_near_store');--> statement-breakpoint
CREATE TYPE "public"."cost_level" AS ENUM('cheap', 'moderate', 'expensive');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."feedback_reaction" AS ENUM('liked', 'dont_repeat', 'kids_didnt_eat', 'too_long', 'too_expensive', 'favorite', 'good_leftovers');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'bought', 'not_found', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('dinner', 'lunch_leftover', 'breakfast_template');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('planning_parent', 'adult', 'child');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('ai_generated', 'user_favorite', 'imported');--> statement-breakpoint
CREATE TYPE "public"."shopping_list_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('pending', 'valid', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."variety_mode" AS ENUM('safe', 'balanced', 'adventurous');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"member_id" uuid,
	"event_name" text NOT NULL,
	"properties_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"weekly_plan_id" uuid,
	"member_id" uuid,
	"reaction" "feedback_reaction" NOT NULL,
	"free_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"likes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dislikes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hard_restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_cuisines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"typical_breakfasts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cooking_time_weekday_minutes" integer DEFAULT 45 NOT NULL,
	"budget_mode" "budget_mode" DEFAULT 'normal' NOT NULL,
	"variety_mode" "variety_mode" DEFAULT 'balanced' NOT NULL,
	"stores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_preferences_household_id_unique" UNIQUE("household_id")
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"role" "member_role" DEFAULT 'adult' NOT NULL,
	"approximate_age_group" "age_group" DEFAULT 'adult' NOT NULL,
	"meals_at_home" jsonb DEFAULT '{"breakfast":false,"lunch":false,"dinner":true}'::jsonb NOT NULL,
	"telegram_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"country" text DEFAULT 'PL' NOT NULL,
	"timezone" text DEFAULT 'Europe/Warsaw' NOT NULL,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "planned_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_type" "meal_type" DEFAULT 'dinner' NOT NULL,
	"recipe_id" uuid NOT NULL,
	"leftovers_planned" boolean DEFAULT false NOT NULL,
	"servings" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer" text NOT NULL,
	"product_name" text NOT NULL,
	"normalized_product_name" text NOT NULL,
	"price_text" text,
	"start_date" date,
	"end_date" date,
	"conditions_text" text,
	"requires_loyalty_app" boolean DEFAULT false NOT NULL,
	"availability_scope" text DEFAULT 'nationwide' NOT NULL,
	"source_url" text,
	"confidence_score" integer DEFAULT 80 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"title" text NOT NULL,
	"source" "recipe_source" DEFAULT 'ai_generated' NOT NULL,
	"servings" integer NOT NULL,
	"time_minutes" integer NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"ingredients_json" jsonb NOT NULL,
	"steps_json" jsonb NOT NULL,
	"substitutions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leftovers_notes" text,
	"storage_notes" text,
	"child_friendly_notes" text,
	"allergen_notes" text,
	"cost_level" "cost_level" DEFAULT 'moderate' NOT NULL,
	"validation_status" "validation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopping_list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" text NOT NULL,
	"quantity" text NOT NULL,
	"unit" text,
	"needed_by_date" date,
	"buy_timing" "buy_timing" DEFAULT 'main_shop' NOT NULL,
	"related_recipe_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"replacement_text" text,
	"promo_hint_id" uuid
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_plan_id" uuid NOT NULL,
	"status" "shopping_list_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_lists_weekly_plan_id_unique" UNIQUE("weekly_plan_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"week_start_date" date NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"ai_reasoning_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_feedback" ADD CONSTRAINT "dish_feedback_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_feedback" ADD CONSTRAINT "dish_feedback_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_feedback" ADD CONSTRAINT "dish_feedback_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_feedback" ADD CONSTRAINT "dish_feedback_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_preferences" ADD CONSTRAINT "family_preferences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;