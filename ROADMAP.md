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

## Phase 10 — Mobile app (Expo / React Native) ✅ done

- [x] `packages/ui-native` — RN design system on StyleSheet+tokens (mirrors `packages/ui` tokens): Button, Card, Badge, Avatar, SkeletonBlock, Tag, MealCard, SectionHeader + tests (21 passing)
- [x] `apps/mobile` — Expo SDK 54 + Expo Router v6 + NativeWind v4 + TypeScript strict
- [x] Typed HTTP client `src/lib/api.ts` (SecureStore Bearer, 401→logout, typed wrappers) — calls `apps/web` over HTTP, never imports domain/db
- [x] BetterAuth (Google/Apple/email-password) — additive second auth path in `apps/web` (no global middleware; `withAuth` accepts Telegram-JWT OR BetterAuth session; lazy household bridge). New `user/session/account/verification` + `auth_household_link` tables
- [x] Navigation shell: root auth guard, `(auth)` login/register, 4-tab bar (Plan/Przepisy/Zakupy/Rodzina)
- [x] Onboarding W06 (3-step: household name, family size, allergies/restrictions)
- [x] W01 Weekly Plan + W02 Recipe Detail (allergy-safe badge)
- [x] W04 Plan Review + W07 Recipe Swap sheet — allergy HARD-CONSTRAINT banner blocks approval
- [x] W03 Shopping List + W08 Checked celebration (confetti)
- [x] W05 Family Preferences (debounced auto-save) + W09 Weekly Feedback
- [x] Skeleton loading + empty/error states on every data screen
- [x] Jest + React Native Testing Library — 13 suites / 40 tests (incl. auth-flow, allergy-guard, shopping-flow integration tests); `pnpm typecheck` green across all 9 packages
- [x] Cross-platform UI E2E (`apps/mobile/e2e`) — Maestro flows for all 9 screens driving the real app against a typed, dependency-free mock API server (switchable scenarios); same flows run on iOS Simulator (macOS) + Android emulator (Windows); `testID`s added without breaking jest; opt-in nightly GH Actions (non-gating)
- [x] Backend REST routes for mobile-only actions wired — removed every `// TODO: backend route` stub. `replaceMeal` (POST `/api/plans/:planId/meals/:mealId/replace`) and `updateShoppingItem` (PATCH `/api/shopping/items/:itemId`) now unwrap their existing routes; added the one genuinely missing route POST `/api/shopping/lists/:listId/items` (`shoppingService.addManualItem`). Recipe Swap reworked to A4 Variant 1 ("reason → replace") — the speculative GET `/alternatives` endpoint was dropped, not built. Plan approve/feedback were already routed.

## Phase 11 — "Plately" visual redesign ✅ done

- [x] Re-skinned design tokens to the forest-green (`#214D32`) + lime (`#BCEA4F`) "Plately" palette on a clean near-white green-tinted background (`#FBFCF6`); dropped the warm "AI beige". Retuned `packages/ui/src/tokens.ts` (and its verbatim native mirror `packages/ui-native/src/tokens.ts`) keeping all accent keys so every screen kept compiling
- [x] Minimal/hairline cards — softened `shadows.card` to a barely-there 1px shadow over a 1px border; lighter radii
- [x] Typography → native SF Pro system stack (thin, airy, "Apple" feel) in `packages/ui/src/fonts.ts` + `apps/web/app/globals.css`
- [x] Primary CTA → forest green (was near-black ink); `TabBar` active tint → forest green with a lime accent dot
- [x] Retuned `Placeholder` food tiles from beige to green/lime; replaced remaining hardcoded beige in `(app)/layout.tsx`, `auth-gate.tsx`, family `SegmentedControl`
- [x] Verified: `pnpm typecheck` green across all 9 packages; ui-native (8 suites/21) + mobile (13 suites/41) tests pass

## Phase 12 — Push notifications (bot dormant) ✅ done

- [x] `push_tokens` table (`packages/db`) — `householdId` FK, nullable `userId`, unique `token`, `platform`, timestamps; migration `0003_wooden_korvac.sql`. `households.telegramChatId` kept as-is (bot dormant)
- [x] `notificationService.notifyHousehold()` (`packages/domain`) — sends via `expo-server-sdk`, chunks messages, prunes `DeviceNotRegistered` tokens; domain imports neither `next` nor `grammy`
- [x] `POST /api/push/register` (`withAuth`, Zod body, upsert on token) + mobile registration (permission → Expo token → POST on authenticated app-start) and notification-tap routing (plan-ready → plan tab, feedback → feedback screen)
- [x] Rewired senders to push: `plan-generate` + `retention-trigger` + new `feedback-reminder` Inngest cron (`TZ=Europe/Warsaw 0 18`, was the bot job); removed the Telegram webhook route and dropped `@meal-planner/bot` + `grammy` from `apps/web`
- [x] `getWeekTwoRetentionCandidates()` now selects households with ≥1 push token (was `telegramChatId IS NOT NULL`)
- [x] Verified: `pnpm typecheck` green across all 9 packages; ui-native + mobile (13 suites/41) tests pass

## F1 — Weekly loop & async generation fixes ✅ done

- [x] Shared async plan-generation pattern (`usePlanGeneration` hook): generate → poll `getWeeklyPlan` every 8s with a hard ceiling (~15 polls / ~2 min). On timeout it switches to an explicit error + "Spróbuj ponownie" action instead of polling forever. Reused across plan, review and shopping screens
- [x] W04 "Wygeneruj nowy" now waits for a genuinely NEW draft (different plan id) via the poll pattern with a "Generuję nowy plan…" state — no longer returns the stale draft instantly
- [x] W08 "Rozpocznij nowy tydzień" routes the user to weekly feedback (W09) for the finishing plan FIRST, then triggers generation via the poll pattern, surfacing any error (no silent catch)
- [x] W09 feedback reachable in-app: end-of-week CTA on the approved plan screen + the new-week flow; `submitFeedback` guarded when `planId === null`; added a "Wróć do planu" button on the success state (was a dead-end)
- [x] W04 post-approve confirmation ("Plan zatwierdzony! — lista zakupów się generuje") with a direct link to the Zakupy tab + "Wróć do planu"
- [x] W01 day cards: swap affordance opens the existing `RecipeSwapSheet`; feedback entry point added
- [x] W03 shopping housekeeping: checkbox now toggles bought ⇄ pending (un-check), grouped list wrapped in a `ScrollView`, manual items get a category picker + per-row delete. New `DELETE /api/shopping/items/:itemId` route (thin + Zod + `withAuth`) backed by `shoppingService.deleteItem`
- [x] Verified: `pnpm typecheck` green across all 9 packages; mobile Jest 13 suites / 44 tests pass

## F2 — Onboarding persistence + family member CRUD ✅ done

- [x] Persist onboarding household data — `households.member_count` + `households.onboarding_completed_at` columns (migration `0005_fresh_landau.sql`); `householdService.completeOnboarding()` saves name + stated family size and stamps the completion marker. Onboarding `finish()` now calls `updateHousehold` (PATCH `/api/family`) alongside `updatePreferences`
- [x] Onboarding cosmetics — step-1 title fixed to "Jak nazwiemy Twoją rodzinę?" (matches the Nazwa rodziny field); added a consistent "Pomiń" on step 2; replaced the dead error UI (error then immediate `router.replace`) with navigation that is BLOCKED on save error so the message stays visible and the user can retry
- [x] Family members CRUD — POST `/api/family/members` (create), PATCH + DELETE `/api/family/members/:memberId` (edit / remove / change `mealsAtHome`), all thin + Zod + `withAuth` and scoped to the authenticated household. W05 add creates server-first (no vanishing optimistic row); remove + "eats at home" toggles are optimistic with rollback; all failures surfaced to the user instead of silent rollback. Domain: `addMember` / `updateMember` / `removeMember` in `packages/domain`
- [x] W05 shows custom (free-text) restrictions added during onboarding as removable chips (previously only the 4 canonical chips rendered) — HARD CONSTRAINT shown verbatim, never dropped
- [x] Server-side onboarding-complete flag — `isOnboardingComplete()` now falls back to `households.onboardingCompletedAt` when the on-device flag is missing (e.g. reinstall) and back-fills the local cache, so returning users skip onboarding from server state
- [x] Verified: `pnpm typecheck` green across all 9 packages; mobile Jest 48 tests pass (13 suites)

## F4 — Intelligent surface ✅ done

- [x] New LLM-produced fields, Zod-validated in `packages/ai` before they touch the DB: `RecipeSchema.isTryNew` (Try-new pick) + `RecipeSchema.priceEstimateGrosze` (per-dish cost in integer grosze, optional). Prompt updated to populate both. The allergy/hardRestrictions validate-and-retry loop in `plan.service` is unchanged and still runs BEFORE any badge/price processing
- [x] Additive, backward-compatible Drizzle migration `0006_lyrical_titania.sql`: `recipes.is_try_new` + `recipes.price_estimate_grosze`, `planned_meals.badges_json` + `planned_meals.cooked_at`, `shopping_list_items.estimated_price_grosze` (all nullable)
- [x] Per-dish badges (kid_ok / leftovers / try_new) derived in `packages/domain` (pure `deriveMealBadges` in `packages/shared`) and persisted on each planned meal at generation + swap time; surfaced on W01/W04 day cards and W02 recipe detail
- [x] AI "why this plan" reasoning block (`PlanReasoning`) surfaced on W01 + W04 (reuses existing `aiReasoningSummary`)
- [x] W02 recipe detail: collapsible storage / for-kids / swaps sections (`CollapsibleSection`) + "mark cooked" action → new `markMealCooked` domain method + `POST /api/plans/:planId/meals/cooked` (thin + Zod + `withAuth` + ownership check)
- [x] W07 RecipeSwapSheet: quick reason chips (Prościej / Taniej / Zdrowiej / Dla dzieci / Inna kuchnia) + a "Zamieniam…" working state
- [x] W03 shopping: each line shows its source recipe, "potrzebne do <dzień>" (neededByDate), promo hint (Biedronka/Lidl) and a real cost estimate (`estimated_price_grosze`, summed in grosze for the footer total) — replaced the old defensive duck-typed price hack
- [x] W04 review: Approve is the primary action, Regenerate a ghost/secondary; fixed the feedback `kids_didnt_eat` step (was mislabelled "Średnio" → now "Dzieci nie zjadły", matching the value it records)
- [x] Verified: `pnpm typecheck` green across all 9 packages; mobile Jest 14 suites / 64 tests + ui-native 25 tests pass

## Phase 13 — Recipe library (scrape → rewrite → pool-based plans)

> Replace "AI invents recipes from scratch" with "AI selects from a curated pool of real
> Polish recipes". Full plan + legal approach: `RECIPE_PIPELINE_PLAN.md`.

- [x] 13a Schema extension (migration `0004_recipe_library`) — `recipes` gains `sourceUrl`, unique `contentHash`, `cuisine`, `tags`, `mealTypes`, `allergens` (new canonical `CanonicalAllergen` enum in `packages/shared`, enables SQL-level HARD-CONSTRAINT pre-filtering), `isGoodForLeftovers`
- [x] 13b Scraper `scripts/scrape-recipes.ts` — fetch + parse only, no LLM/DB. Sitemap or category-listing URL discovery, robots.txt honored (Disallow + Crawl-delay, ≥1 req/2s), parse cascade JSON-LD → site-specific extractor → generic microdata, raw JSON dumped to gitignored `data/raw-recipes/{contentHash}.json` (idempotent re-runs skip cached hashes). Site configs: aniagotuje.pl (sitemap; HowToStep + legacy article-body markup) and kwestiasmaku.com (listing pages; Drupal-field extractor; browser-like UA because its WAF drops bot UAs; 10s crawl-delay)
- [ ] 13c LLM rewrite/normalize `scripts/process-recipes.ts` — rewrite steps in own words, normalize ingredients, infer cuisine/tags/mealTypes/allergens, Zod-validate (allergens from canonical enum only), upsert by `contentHash`; seed ~300–500 obiady/kolacje
- [ ] 13d Pool-based plan generation — `recipeService.findCandidates` with SQL allergen hard-filter, `WeeklyPlanFromPoolSchema` (AI picks recipeId per slot), ad-hoc generation fallback, behind `PLAN_FROM_POOL=1`
- [ ] 13e Surface in app — `GET /api/recipes` (search + tag filter) backing the mobile "Przepisy" tab
