CREATE TABLE "recipe_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"consumed_by_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_requests" ADD CONSTRAINT "recipe_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_requests" ADD CONSTRAINT "recipe_requests_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_requests" ADD CONSTRAINT "recipe_requests_consumed_by_plan_id_weekly_plans_id_fk" FOREIGN KEY ("consumed_by_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE set null ON UPDATE no action;