ALTER TABLE "recipes" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cuisine" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "meal_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "allergens" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "is_good_for_leftovers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_content_hash_unique" UNIQUE("content_hash");