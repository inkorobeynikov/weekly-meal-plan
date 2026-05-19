# CLAUDE.md — Weekly Meal Planner

> Instructions for Claude Code. Read this at the start of every session.

---

## Project

Family AI meal planner for Poland. Telegram bot + Next.js PWA/mini app.
Monorepo: Turborepo + pnpm. See `ROADMAP.md` for current status.

**Local path:** `E:/weekly-meal-plan`
**Repo:** https://github.com/inkorobeynikov/weekly-meal-plan

---

## Architecture Rules (non-negotiable)

1. **Domain logic lives in `packages/domain` only.** Next.js API routes and grammY handlers are thin controllers: parse → call domain → respond.
2. **Bot never makes HTTP calls to Next.js.** It imports `@meal-planner/domain` directly.
3. **`packages/domain` has zero imports from `next` or `grammy`.**
4. **Zod validates every LLM output** before it touches the database.
5. **Allergies and `hardRestrictions` are HARD CONSTRAINTS.** Comment this wherever relevant. Never violate them, even in error paths.
6. **Shopping list is only generated after plan is approved.** Enforce in `shopping.service.ts`.
7. **`strict: true`** in all tsconfigs. No `any` types.
8. **Every API route that writes data checks auth first.**

---

## Tech Stack

| Layer           | Choice                                        |
| --------------- | --------------------------------------------- |
| Monorepo        | Turborepo + pnpm workspaces                   |
| Web             | Next.js 16 (App Router, React Compiler)       |
| Bot             | grammY (long-polling dev, webhook prod)       |
| ORM             | Drizzle ORM                                   |
| Database        | PostgreSQL                                    |
| LLM             | OpenAI SDK + Zod structured outputs           |
| Background jobs | Inngest                                       |
| UI              | Tailwind CSS v4 + `packages/ui` design system |
| Auth            | Telegram `initData` → JWT (`jose`)            |

---

## Packages

```
apps/web          Next.js 16 PWA + API routes
apps/bot          grammY bot
packages/db       Drizzle schema + client
packages/domain   All business logic
packages/ai       OpenAI client + Zod schemas
packages/shared   Common types/enums
packages/ui       Design system (tokens, icons, primitives, shell)
```

---

## ⚠️ TRACKING RULE — Update ROADMAP after every completed task

After finishing any PR or feature, you MUST:

1. **Open `ROADMAP.md`** and mark completed items with `[x]`.
2. **Append one line to `CHANGELOG.md`** (create the file if it doesn't exist):
   ```
   - YYYY-MM-DD  Short description of what was done
   ```
3. **Commit both files** together with the feature work (or as a follow-up commit with message `chore: update ROADMAP + CHANGELOG`).

This keeps Ivan (the solo developer) oriented without relying on memory.

---

## Common Commands

```bash
pnpm install          # install all dependencies
pnpm typecheck        # run tsc across all packages (must pass clean)
pnpm dev              # start web + bot in parallel (via Turborepo)
pnpm -F @meal-planner/db generate   # generate Drizzle migrations
pnpm -F @meal-planner/db migrate    # run migrations
```

---

## Design Reference

- `Meal Planner.html` — 9 mobile screens (open in browser)
- `.design-ref/` — screen images
- `packages/ui/src/` — tokens, primitives, shell components

Screen IDs: W01 Weekly Plan · W02 Recipe Detail · W03 Shopping List · W04 Plan Review · W05 Family Preferences · W06 Onboarding · W07 Recipe Swap · W08 Shopping Checked · W09 Feedback

---

## Current Focus (Phase 3)

Next task: implement `generateWeeklyPlan()` in `packages/domain/src/services/plan.service.ts`.

Required steps:

1. Fetch household + preferences from DB
2. Build `buildFamilyMemorySummary()` context (empty for now — stub ok)
3. Call OpenAI with structured output → `WeeklyPlanSchema`
4. Validate with Zod; if allergies/hardRestrictions violated → retry (max 2 retries)
5. Upsert recipes → insert `weekly_plans` + `planned_meals` rows
6. Return `PlanWithMeals`

Wire it via an Inngest job `meal-planner/plan.generate` so it runs async.
