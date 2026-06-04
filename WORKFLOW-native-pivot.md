# Workflow: native pivot (bot → dormant)

Execution prompts for the coding agent, one per block. See `PLAN-native-pivot.md` for rationale.

## Parallelization map

```
 ┌─ LANE 1 ─────────────┐     ┌─ LANE 2 ────────────────────────────────┐
 │ Block A (mobile wiring) │  ║  │ Block B1 (schema + migration)            │
 └─────────────────────┘     │  └───────────────┬──────────────────────────┘
        run in parallel  ═════╝                  │ then fan out, in parallel:
                                      ┌───────────┴───────────┐
                                      │ B2 mobile push reg.   │ B3→B4→B5 backend senders
                                      └───────────┬───────────┘
                                                  │ (after B4)
                                          ┌───────┴────────┐
                                          │ Block C (dormant bot) │
                                          └────────────────┘
```

- **Run A and B in parallel** (two workflow lanes / two agent sessions). Low conflict: different files.
- **Inside B:** do B1 first, then B2 ∥ (B3→B4→B5).
- **Block C is gated on B4** (web must be free of `@meal-planner/bot` imports first).
- All blocks must end green: `pnpm typecheck` (9 packages) + relevant tests, and update `ROADMAP.md` + `CHANGELOG.md` per the tracking rule in `CLAUDE.md`.

### Branch & merge order

- Each block runs on its **own branch, created at the start of work**:
  - Block A → `feat/mobile-wiring`, branched from `main`.
  - Block B → `feat/push-notifications`, branched from `main` (parallel with A).
  - Block C → `chore/bot-dormant`, branched from `main` **after Block B is merged** (C needs B4's bot-import removal).
- Merge order: A and B independently into `main` (either order), then C.

---

## PROMPT — Block A (mobile wiring) — run in parallel with Block B

```
First, create and switch to a new branch off the latest main: `git checkout main && git pull && git checkout -b feat/mobile-wiring`. Do all work for this block on that branch.

Finish wiring the Expo mobile app to existing backend routes. The TODO comments claiming "backend route not implemented" are STALE — the routes exist; the mobile client just unwraps responses wrong.

1. apps/mobile/src/lib/api.ts — fix replaceMeal: route POST /api/plans/:planId/meals/:mealId/replace already exists and returns `{ meal }`. Unwrap `.meal`, type as PlannedMeal, delete the stale TODO comment.

2. apps/mobile/src/lib/api.ts — fix updateShoppingItem: route PATCH /api/shopping/items/:itemId already exists and returns `{ item }`. Unwrap `.item`, delete the stale TODO.

3. Create the ONE genuinely missing route: apps/web/app/api/shopping/lists/[listId]/items/route.ts — export POST wrapped in withAuth, Zod-validate the body, build a NewShoppingListItem (inject listId from params), call shoppingService.addManualItem, return `{ item }`. Then in apps/mobile/src/lib/api.ts addShoppingItem unwrap `.item` and drop the TODO. Follow the existing PATCH route file (apps/web/app/api/shopping/items/[itemId]/route.ts) for the auth + Zod pattern.

4. Simplify the swap sheet to ship now (A4 Variant 1). apps/mobile/src/components/RecipeSwapSheet.tsx currently expects a non-existent GET /alternatives endpoint and a replace-by-recipeId. Replace that UX with a "reason → replace" flow: a short reason text input + confirm button that calls replaceMeal(planId, mealId, reason) (the existing route does the AI replacement). Remove the alternatives fetch, the reroll function, and the Alternative/AlternativesResponse types. Keep the onSwapped(mealId) callback and the loading/error states.

Constraints (CLAUDE.md): domain logic stays in packages/domain (the route is a thin controller); Zod-validate the request body; strict types, no `any`; HARD CONSTRAINTS (allergies/hardRestrictions) untouched.

Done check: `pnpm typecheck` green across all 9 packages; mobile Jest suites pass. Then mark the Phase 10 "Backend REST routes for mobile-only actions still stubbed" item progress in ROADMAP.md and append a CHANGELOG.md line. Commit on the feat/mobile-wiring branch.
```

---

## PROMPT — Block B (push layer replacing the bot) — run in parallel with Block A

```
First, create and switch to a new branch off the latest main: `git checkout main && git pull && git checkout -b feat/push-notifications`. Do all work for this block on that branch.

Replace the Telegram bot notification channel with Expo push. The bot is being put dormant, so every notification it sent must move to push. expo-notifications is already a dependency but no push code exists yet.

B1 (do first — schema): packages/db/src/schema.ts — add a `push_tokens` table: id, householdId (fk -> households), userId (nullable), token (text, unique), platform (text), createdAt, updatedAt. Keep households.telegramChatId as-is (dormant, do not drop). Generate the migration: `pnpm -F @meal-planner/db generate`.

B2 (mobile, parallel after B1): in apps/mobile, on login/app-start request notification permission via expo-notifications, get the Expo push token, and POST it to a new route apps/web/app/api/push/register/route.ts (withAuth, Zod body, upsert into push_tokens). Add a notification-response handler that routes a tap to the relevant screen (e.g. plan ready -> plan tab).

B3 (domain): create packages/domain/src/services/notification.service.ts exposing `notifyHousehold(householdId, { title, body, data })`. Implement with expo-server-sdk: load the household's push tokens, send, and prune tokens that return DeviceNotRegistered. Add expo-server-sdk as a dependency of packages/domain. Domain must NOT import next or grammy.

B4 (rewire senders to push, remove bot coupling):
 - apps/web/app/api/inngest/functions/plan-generate.ts — replace the getBot()/sendMessage/InlineKeyboard "plan ready" notification with notifyHousehold. Remove the grammy + @meal-planner/bot imports.
 - apps/web/app/api/inngest/functions/retention-trigger.ts — send the retention nudge via notifyHousehold instead of bot.api.sendMessage.
 - Move the feedback reminder: it currently lives as a cron in apps/bot/src/jobs/feedback-reminder.ts (TZ Europe/Warsaw 18:00). Recreate it as an Inngest cron function under apps/web/app/api/inngest/functions/ that sends via push. (Leave the bot job file in place but it will no longer run once the bot is dormant.)

B5 (candidate selection): packages/domain/src/services/plan.service.ts — getWeekTwoRetentionCandidates() currently filters households by telegramChatId IS NOT NULL. Change it to select households that have at least one push token.

Constraints (CLAUDE.md): packages/domain has zero imports from next/grammy; Zod-validate the register body; strict types, no `any`.

Done check: `pnpm typecheck` green across 9 packages; tests pass; manually verify a push arrives on a device/emulator. After B4, confirm apps/web has no remaining `@meal-planner/bot` imports. Update ROADMAP.md + CHANGELOG.md. Commit on the feat/push-notifications branch.
```

---

## PROMPT — Block C (put the bot dormant) — run AFTER Block B is merged

```
First, create and switch to a new branch off the latest main (run this only AFTER Block B has been merged into main): `git checkout main && git pull && git checkout -b chore/bot-dormant`. Do all work for this block on that branch.

Put the Telegram bot into dormant mode. Do NOT delete code — apps/bot, households.telegramChatId, and the webhook route all stay as a fallback channel.

1. Remove apps/bot from the parallel dev flow: take it out of the `pnpm dev` fan-out / scripts/dev-tunnel.ts so local dev no longer launches the bot. Do not deploy apps/bot.

2. Stop the production webhook: ensure prod no longer calls setWebhook (or explicitly call deleteWebhook in the deploy/runtime path). Leave apps/web/app/api/telegram/webhook/route.ts in place — with no updates delivered it just idles.

3. Verify decoupling: grep apps/web for `@meal-planner/bot` and `grammy` — after Block B4 there should be no remaining imports. If any remain, finish removing them.

4. Do not touch apps/bot source, the telegramChatId column, or the webhook route — they stay dormant.

Done check: `pnpm typecheck` green; `pnpm dev` starts web (+ mobile/inngest as before) without the bot; no @meal-planner/bot imports in apps/web. Update ROADMAP.md + CHANGELOG.md. Commit on the chore/bot-dormant branch.
```
