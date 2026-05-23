# Roadmap

## Phase 1 — Monorepo scaffold ✅ done

- [x] Turborepo + pnpm workspaces
- [x] Drizzle schema + db client
- [x] Shared types/enums
- [x] Initial database bootstrap — generated the first Drizzle migration and applied the schema to the configured development database

## Phase 2 — Design system ✅ done

- [x] `packages/ui` tokens, primitives, shell
- [x] Mobile mockup `Meal Planner.html`

## Phase 3 — AI plan generation ✅ done

- [x] `packages/ai/src/prompts/plan.prompt.ts` (system + user prompts)
- [x] `planService.generateWeeklyPlan` — fetch profile/memory, call OpenAI with `zodResponseFormat(WeeklyPlanSchema)`, Zod-validate, HARD-CONSTRAINT check (allergies + hardRestrictions), retry up to 2 attempts, persist recipes + weekly_plan + planned_meals
- [x] `planService.replaceMeal` — AI replacement for a single meal with the same HARD-CONSTRAINT guard
- [x] Inngest job `meal-planner/plan.generate` wired in `apps/web/app/api/inngest`

## Phase 4 — Web + auth

- [x] Phase 4a: Telegram `initData` verification + JWT middleware (`withAuth`, `/api/auth/telegram`, `api-client`)
- [x] Phase 4b: W04 Plan Review + W01 Weekly Plan screens (plans API routes, draft review with swap/approve/regenerate, approved view)
- [x] Phase 4c: W02 Recipe Detail + W03 Shopping List + W05 Family Preferences screens
- [ ] Phase 4d: Web onboarding flow (W06)

## Phase 5 — Shopping list

- [x] `shoppingService.generateShoppingList` (only runs once plan is approved)
- [x] Promotion-fact lookups (Biedronka/Lidl/Kaufland) — see Phase 8
- [x] Web UI: W03 Shopping List
- [ ] Web UI: W08 Shopping Checked
- [x] Inngest job `meal-planner/shopping.generate` (triggered on plan approve)

## Phase 6 — Bot ✅ done

- [x] Bot onboarding (full conversation flow, Polish)
- [x] Plan delivery via Telegram (/plan + inline "generate plan" callback)
- [x] /shopping command — grouped list + deep link to web app
- [x] Webhook handler in Next.js (`/api/telegram/webhook`)

## Phase 7 — Feedback + memory ✅ done

- [x] Dish feedback capture
- [x] Family memory summary for plan prompts

## Phase 8 — Promotions ✅ done

- [x] `scripts/import-promos.ts` — manual CSV importer (normalizes product names, upserts `promotion_facts`)
- [x] `promoService.matchPromos` — match shopping list items to active promotions
- [x] Shopping list API attaches `promoHints` to each item
- [x] Web UI: promo badge + tap-to-open popover (price + conditions) on W03 Shopping List

## Phase 9 — Analytics + deployment ✅ done

- [x] `analyticsService.trackEvent` — fire-and-forget insert into `analytics_events` (never breaks main flow)
- [x] Event instrumentation: `plan_generated`, `plan_approved`, `meal_replaced`, `shopping_list_generated`, `feedback_submitted`, `shopping_list_opened`
- [x] Week-2 retention trigger — daily Inngest cron (09:00 Warsaw), nudges households 7 days post first approved plan, tracks `retention_nudge_sent`
- [x] GitHub Actions CI (`.github/workflows/ci.yml`) — install + `pnpm typecheck` on push/PR to main
- [x] Vercel deployment config (`vercel.json`) for `apps/web`
- [x] Dev startup stability — Next transpiles `@meal-planner/bot`, and OpenAI client initializes lazily so missing `OPENAI_API_KEY` does not crash startup imports
- [x] Local dev env + resolver stability — bot dev loads the root `.env`, web dev uses webpack with TS extension aliases for workspace packages, and `pnpm dev` stays up cleanly
