# Weekly Meal Planner — Roadmap

## Phase 1 — Scaffold
- [x] Turborepo + pnpm monorepo
- [x] Packages: db, domain, ai, shared, ui
- [x] Apps: web (Next.js 16), bot (grammY)

## Phase 2 — Database
- [x] Drizzle schema (households, members, recipes, plans, shopping)
- [x] Migrations + client

## Phase 3 — Plan generation
- [ ] `generateWeeklyPlan()` in domain
- [ ] OpenAI structured output + Zod validation
- [ ] Inngest job `meal-planner/plan.generate`

## Phase 4 — Web + auth
- [x] Phase 4a: Telegram `initData` verification + JWT middleware
- [ ] Phase 4b: Web onboarding flow (W06)
- [ ] Phase 4c: Weekly plan view (W01)
- [ ] Phase 4d: Recipe detail view (W02)
- [ ] Phase 4e: Shopping list view (W03)

## Phase 5 — Bot
- [ ] Bot onboarding
- [ ] Plan delivery via Telegram

## Phase 6 — Feedback + memory
- [ ] Dish feedback capture
- [ ] Family memory summary for plan prompts
