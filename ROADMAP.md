# Roadmap

## Phase 1 — Monorepo scaffold
- [x] Turborepo + pnpm workspaces
- [x] Drizzle schema + db client
- [x] Shared types/enums

## Phase 2 — Design system
- [x] `packages/ui` tokens, primitives, shell
- [x] Mobile mockup `Meal Planner.html`

## Phase 3 — AI plan generation
- [x] `packages/ai/src/prompts/plan.prompt.ts` (system + user prompts)
- [x] `planService.generateWeeklyPlan` — fetch profile/memory, call OpenAI with `zodResponseFormat(WeeklyPlanSchema)`, Zod-validate, HARD-CONSTRAINT check (allergies + hardRestrictions), retry up to 2 attempts, persist recipes + weekly_plan + planned_meals
- [x] `planService.replaceMeal` — AI replacement for a single meal with the same HARD-CONSTRAINT guard
- [x] Inngest job `meal-planner/plan.generate` wired in `apps/web/app/api/inngest`

## Phase 4 — Web + auth
- [x] Phase 4a: Telegram `initData` verification + JWT middleware (`withAuth`, `/api/auth/telegram`, `api-client`)
- [ ] Phase 4b: Web onboarding flow (W06)
- [ ] Phase 4c: Weekly plan view (W01)
- [ ] Phase 4d: Recipe detail view (W02)

## Phase 5 — Shopping list
- [ ] `shoppingService.buildShoppingList` (only runs once plan is approved)
- [ ] Promotion-fact lookups (Biedronka/Lidl/Kaufland)
- [ ] Web UI: W03 Shopping List, W08 Shopping Checked

## Phase 6 — Bot
- [ ] Bot onboarding
- [ ] Plan delivery via Telegram

## Phase 7 — Feedback + memory
- [ ] Dish feedback capture
- [ ] Family memory summary for plan prompts
