# Coding Agent Prompt — Scaffold Monorepo

## Context

You are setting up a production-ready monorepo for a family AI meal-planning app called **Weekly Meal Planner**.

**Product summary:** A Telegram bot + web mini app/PWA for families in Poland. The bot handles onboarding and reminders; the web mini app (opened from Telegram) shows the weekly dinner plan, recipes, and shared shopping list. AI generates the plan; the family approves and uses it during the week.

**The repo at `E:/weekly-meal-plan` already contains root-level config files:**
- `package.json` (pnpm workspaces, Turborepo scripts)
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.gitignore`
- `.env.example`

Your task is to scaffold everything that is missing so a developer can run `pnpm install` and immediately start writing product code.

---

## Tech Stack (locked, do not change)

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Web / mini app | **Next.js 16** (App Router, React Compiler, Turbopack default) |
| Bot | **grammY** (long-polling in dev, webhook in prod) |
| ORM | **Drizzle ORM** |
| Database | **PostgreSQL** |
| LLM | **OpenAI SDK** with Zod structured outputs |
| Validation | **Zod** everywhere |
| Auth | Telegram `initData` verification → JWT (`jose`) |
| Background jobs | **Inngest** |
| UI | **Tailwind CSS v4 + shadcn/ui** |
| Package manager | **pnpm** |
| Node | 20 LTS |

---

## Architecture Rule (critical)

**Domain logic lives in `packages/domain`, never in Next.js API routes or grammY handlers.**

- Next.js API routes = thin controllers: parse request → call domain → return response.
- grammY handlers = thin: parse message → call domain → send reply.
- `packages/domain` has zero dependency on Next.js, grammY, or any framework.
- Adding a mobile app later = new `apps/mobile` that imports `packages/domain` directly.

**The bot does NOT make HTTP calls to the Next.js server.** It imports from `packages/domain` directly (monorepo shared package).

---

## Directory Structure to Create

```
apps/
  web/                          ← Next.js 16 mini app + API routes
  bot/                          ← grammY bot (separate Node.js process)
packages/
  db/                           ← Drizzle schema, client, migrations
  domain/                       ← All business logic (plan, shopping, feedback)
  ai/                           ← OpenAI prompts, Zod schemas, LLM calls
  shared/                       ← Common types, enums, constants
```

---

## Package Details

### `packages/shared`

`package.json` name: `@meal-planner/shared`

Export common types and enums:

```typescript
// src/index.ts

export type MemberRole = 'planning_parent' | 'adult' | 'child'
export type AgeGroup = 'adult' | 'child_0_3' | 'child_4_7' | 'child_8_12' | 'teen'
export type PlanStatus = 'draft' | 'approved' | 'archived'
export type MealType = 'dinner' | 'lunch_leftover' | 'breakfast_template'
export type RecipeSource = 'ai_generated' | 'user_favorite' | 'imported'
export type ShoppingListStatus = 'active' | 'completed' | 'archived'
export type BuyTiming = 'main_shop' | 'later' | 'optional_if_near_store'
export type ItemStatus = 'pending' | 'bought' | 'not_found' | 'replaced'
export type FeedbackReaction = 'liked' | 'dont_repeat' | 'kids_didnt_eat' | 'too_long' | 'too_expensive' | 'favorite' | 'good_leftovers'
export type BudgetMode = 'economical' | 'normal' | 'flexible'
export type VarietyMode = 'safe' | 'balanced' | 'adventurous'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type CostLevel = 'cheap' | 'moderate' | 'expensive'
export type ValidationStatus = 'pending' | 'valid' | 'invalid'

export interface MealsAtHome {
  breakfast: boolean
  lunch: boolean
  dinner: boolean
}

export interface Ingredient {
  name: string
  quantity: number
  unit: string
}

export interface RecipeSubstitution {
  original: string
  substitute: string
  note?: string
}
```

---

### `packages/db`

`package.json` name: `@meal-planner/db`

Dependencies: `drizzle-orm`, `postgres` (the `postgres` npm package, not `pg`)
Dev dependencies: `drizzle-kit`

**`drizzle.config.ts`:** Points to `src/schema.ts`, outputs migrations to `./drizzle`.

**`src/schema.ts`:** Full Drizzle schema for PostgreSQL. Create these tables with proper relations:

#### households
```
id: uuid PK
name: text NOT NULL
locale: text NOT NULL DEFAULT 'pl'
country: text NOT NULL DEFAULT 'PL'
timezone: text NOT NULL DEFAULT 'Europe/Warsaw'
telegram_chat_id: text UNIQUE
created_at: timestamp DEFAULT now()
```

#### household_members
```
id: uuid PK
household_id: uuid FK → households.id CASCADE
display_name: text NOT NULL
role: enum('planning_parent','adult','child') DEFAULT 'adult'
approximate_age_group: enum('adult','child_0_3','child_4_7','child_8_12','teen') DEFAULT 'adult'
meals_at_home: jsonb DEFAULT '{"breakfast":false,"lunch":false,"dinner":true}'
telegram_user_id: text UNIQUE
created_at: timestamp DEFAULT now()
```

#### family_preferences
```
id: uuid PK
household_id: uuid FK → households.id CASCADE UNIQUE
likes: jsonb DEFAULT '[]'
dislikes: jsonb DEFAULT '[]'
hard_restrictions: jsonb DEFAULT '[]'
allergies: jsonb DEFAULT '[]'
preferred_cuisines: jsonb DEFAULT '[]'
typical_breakfasts: jsonb DEFAULT '[]'
cooking_time_weekday_minutes: integer DEFAULT 45
budget_mode: enum('economical','normal','flexible') DEFAULT 'normal'
variety_mode: enum('safe','balanced','adventurous') DEFAULT 'balanced'
stores: jsonb DEFAULT '[]'
updated_at: timestamp DEFAULT now()
```

#### recipes
```
id: uuid PK
household_id: uuid FK → households.id SET NULL (nullable)
title: text NOT NULL
source: enum('ai_generated','user_favorite','imported') DEFAULT 'ai_generated'
servings: integer NOT NULL
time_minutes: integer NOT NULL
difficulty: enum('easy','medium','hard') DEFAULT 'medium'
ingredients_json: jsonb NOT NULL
steps_json: jsonb NOT NULL
substitutions_json: jsonb DEFAULT '[]'
leftovers_notes: text
storage_notes: text
child_friendly_notes: text
allergen_notes: text
cost_level: enum('cheap','moderate','expensive') DEFAULT 'moderate'
validation_status: enum('pending','valid','invalid') DEFAULT 'pending'
created_at: timestamp DEFAULT now()
```

#### weekly_plans
```
id: uuid PK
household_id: uuid FK → households.id CASCADE
week_start_date: date NOT NULL
status: enum('draft','approved','archived') DEFAULT 'draft'
ai_reasoning_summary: text
created_at: timestamp DEFAULT now()
approved_at: timestamp
```

#### planned_meals
```
id: uuid PK
weekly_plan_id: uuid FK → weekly_plans.id CASCADE
date: date NOT NULL
meal_type: enum('dinner','lunch_leftover','breakfast_template') DEFAULT 'dinner'
recipe_id: uuid FK → recipes.id
leftovers_planned: boolean DEFAULT false
servings: integer NOT NULL
```

#### shopping_lists
```
id: uuid PK
weekly_plan_id: uuid FK → weekly_plans.id CASCADE UNIQUE
status: enum('active','completed','archived') DEFAULT 'active'
created_at: timestamp DEFAULT now()
```

#### shopping_list_items
```
id: uuid PK
shopping_list_id: uuid FK → shopping_lists.id CASCADE
name: text NOT NULL
normalized_name: text NOT NULL
category: text NOT NULL
quantity: text NOT NULL
unit: text
needed_by_date: date
buy_timing: enum('main_shop','later','optional_if_near_store') DEFAULT 'main_shop'
related_recipe_ids: jsonb DEFAULT '[]'
status: enum('pending','bought','not_found','replaced') DEFAULT 'pending'
replacement_text: text
promo_hint_id: uuid (nullable, no FK yet)
```

#### dish_feedback
```
id: uuid PK
household_id: uuid FK → households.id CASCADE
recipe_id: uuid FK → recipes.id
weekly_plan_id: uuid FK → weekly_plans.id (nullable)
member_id: uuid FK → household_members.id (nullable)
reaction: enum('liked','dont_repeat','kids_didnt_eat','too_long','too_expensive','favorite','good_leftovers')
free_text: text
created_at: timestamp DEFAULT now()
```

#### promotion_facts
```
id: uuid PK
retailer: text NOT NULL
product_name: text NOT NULL
normalized_product_name: text NOT NULL
price_text: text
start_date: date
end_date: date
conditions_text: text
requires_loyalty_app: boolean DEFAULT false
availability_scope: text DEFAULT 'nationwide'
source_url: text
confidence_score: integer DEFAULT 80
created_at: timestamp DEFAULT now()
```

#### analytics_events
```
id: uuid PK
household_id: uuid FK → households.id SET NULL (nullable)
member_id: uuid FK → household_members.id SET NULL (nullable)
event_name: text NOT NULL
properties_json: jsonb DEFAULT '{}'
created_at: timestamp DEFAULT now()
```

**`src/client.ts`:** Create and export the Drizzle client:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const queryClient = postgres(process.env.DATABASE_URL!)
export const db = drizzle(queryClient, { schema })
export type DB = typeof db
```

**`src/index.ts`:** Re-export everything from `schema.ts` and `client.ts`.

---

### `packages/ai`

`package.json` name: `@meal-planner/ai`

Dependencies: `openai`, `zod`

Create these files with proper Zod schemas and stub implementations:

**`src/schemas/recipe.schema.ts`:**
```typescript
import { z } from 'zod'

export const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
})

export const RecipeSchema = z.object({
  title: z.string(),
  servings: z.number().int().positive(),
  timeMinutes: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  costLevel: z.enum(['cheap', 'moderate', 'expensive']),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(z.string()).min(1),
  substitutions: z.array(z.object({
    original: z.string(),
    substitute: z.string(),
    note: z.string().optional(),
  })).default([]),
  leftoversNotes: z.string().optional(),
  storageNotes: z.string().optional(),
  childFriendlyNotes: z.string().optional(),
  allergenNotes: z.string().optional(),
  isKidFriendly: z.boolean(),
  isGoodForLeftovers: z.boolean(),
  whyThisMeal: z.string(), // short explanation for the UI
})

export type Recipe = z.infer<typeof RecipeSchema>
```

**`src/schemas/plan.schema.ts`:**
```typescript
import { z } from 'zod'
import { RecipeSchema } from './recipe.schema'

export const PlannedMealSchema = z.object({
  dayOffset: z.number().int().min(0).max(6), // 0 = Monday
  mealType: z.enum(['dinner', 'lunch_leftover', 'breakfast_template']),
  leftoversPlanned: z.boolean(),
  recipe: RecipeSchema,
})

export const WeeklyPlanSchema = z.object({
  reasoningSummary: z.string(),
  meals: z.array(PlannedMealSchema).min(5).max(7),
})

export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>
```

**`src/schemas/onboarding.schema.ts`:**
```typescript
import { z } from 'zod'

export const HouseholdProfileSchema = z.object({
  householdName: z.string().optional(),
  adults: z.number().int().min(1),
  children: z.array(z.object({
    ageGroup: z.enum(['child_0_3', 'child_4_7', 'child_8_12', 'teen']),
  })).default([]),
  dinnersPerWeek: z.number().int().min(5).max(7).default(6),
  leftoversForLunch: z.boolean().default(false),
  likes: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  hardRestrictions: z.array(z.string()).default([]),
  preferredCuisines: z.array(z.string()).default([]),
  cookingTimeWeekdayMinutes: z.number().int().min(15).max(120).default(45),
  budgetMode: z.enum(['economical', 'normal', 'flexible']).default('normal'),
  stores: z.array(z.string()).default([]),
  clarificationNeeded: z.array(z.string()).default([]), // questions to ask user
})

export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>
```

**`src/client.ts`:** Create OpenAI client singleton:
```typescript
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
  smart: process.env.OPENAI_MODEL_SMART ?? 'gpt-4o',
} as const
```

**`src/index.ts`:** Re-export all schemas and the client.

---

### `packages/domain`

`package.json` name: `@meal-planner/domain`

Dependencies: `@meal-planner/db`, `@meal-planner/ai`, `@meal-planner/shared`, `zod`

Create stub service files. Each service is a plain TypeScript module (no classes, just exported async functions):

**`src/services/household.service.ts`** — create/get/update household, add member, get preferences, update preferences. Stubs with `// TODO` and correct signatures.

**`src/services/plan.service.ts`** — generateWeeklyPlan, approvePlan, replaceMeal, getPlanWithMeals. Stubs.

**`src/services/shopping.service.ts`** — generateShoppingList, getShoppingList, updateItemStatus, addManualItem. Stubs.

**`src/services/feedback.service.ts`** — submitDishFeedback, getWeekFeedback, buildFamilyMemorySummary. Stubs.

**`src/services/analytics.service.ts`** — trackEvent(householdId, memberId, eventName, properties). Stub.

**`src/index.ts`:** Re-export all services.

---

### `apps/bot`

`package.json` name: `@meal-planner/bot`

Dependencies: `grammy`, `@grammyjs/session`, `@meal-planner/domain`, `@meal-planner/shared`, `zod`

**`src/index.ts`:** Bot entry point:
- Create `Bot` from grammY with `BOT_TOKEN` env var.
- Use long-polling in development (`bot.start()`).
- Register commands: `/start`, `/plan`, `/shopping`, `/help`.
- Each command handler lives in its own file under `src/commands/`.
- Handle errors gracefully with a user-friendly message.

**`src/commands/start.ts`:**
- Send welcome message explaining the product.
- Check if user already has a household.
- If not → trigger onboarding flow.

**`src/commands/plan.ts`:**
- Check for existing household.
- If approved plan exists → send mini app link.
- If no plan → tell user to use Sunday planning.

**`src/session.ts`:**
- Define session type for grammY.
- Store: `step` (onboarding step), `householdId`.

All handlers call `@meal-planner/domain` services. Zero business logic in the bot itself.

---

### `apps/web`

`package.json` name: `@meal-planner/web`

Dependencies: `next`, `react`, `react-dom`, `@meal-planner/domain`, `@meal-planner/shared`, `@meal-planner/db`, `inngest`, `jose`, `zod`, `tailwindcss`, `@tailwindcss/vite`

**`next.config.ts`:**
```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  // React Compiler is enabled by default in Next.js 16
  experimental: {
    reactCompiler: true,
  },
}

export default config
```

**`app/layout.tsx`:** Root layout with Tailwind, viewport meta, `<html lang="pl">`.

**`app/page.tsx`:** Minimal homepage — redirects to `/plan` if authenticated, else shows loading.

**`app/api/health/route.ts`:**
```typescript
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

**`app/api/telegram/webhook/route.ts`:** POST handler for grammY webhook in production. For now just returns 200 with a `// TODO: wire grammY webhook` comment.

**`lib/auth.ts`:** JWT verification using `jose`. Export:
- `verifyTelegramInitData(initData: string): Promise<TelegramUser>`
- `signJwt(payload: object): Promise<string>`
- `verifyJwt(token: string): Promise<object>`

**`lib/inngest.ts`:** Create and export the Inngest client:
```typescript
import { Inngest } from 'inngest'
export const inngest = new Inngest({ id: 'meal-planner' })
```

**`app/api/inngest/route.ts`:** Inngest handler endpoint (serve function).

**Bottom navigation structure (4 tabs):**
Create placeholder page files for the main tabs:
- `app/(app)/plan/page.tsx` — Weekly plan screen
- `app/(app)/shopping/page.tsx` — Shopping list
- `app/(app)/recipes/page.tsx` — Recipes
- `app/(app)/family/page.tsx` — Family & preferences
- `app/(app)/layout.tsx` — Layout with bottom nav

Each page just renders `<h1>Coming soon</h1>` for now.

---

## Non-negotiable invariants

1. `strict: true` in all tsconfigs — no exceptions.
2. No `any` types.
3. Zod validates every LLM output before touching the database.
4. Every API route that writes data checks auth first.
5. `packages/domain` has no imports from `next` or `grammy`.
6. Shopping list is only generated after plan is approved (enforce in domain service).
7. Allergies and hard restrictions are hard constraints — comment this wherever relevant.

---

## After scaffolding

Run:
```bash
pnpm install
pnpm typecheck
```

Both must pass with zero errors. The app does not need to run end-to-end, but all TypeScript must compile cleanly.
