ALTER TABLE "planned_meals" ADD COLUMN "badges_json" jsonb;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD COLUMN "cooked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "is_try_new" boolean;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "price_estimate_grosze" integer;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "estimated_price_grosze" integer;