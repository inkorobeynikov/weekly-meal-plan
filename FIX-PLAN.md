# План починок по UX-ревью (34 пункта)

> Сгруппировано так, чтобы каждый блок владел своими файлами и ветки не конфликтовали. Severity-приоритет: BLOCKER → ANNOYING → COSMETIC. Косметика вкладывается в тот блок, который и так трогает этот файл.

## Карта блоков и параллельность

```
Параллельно (непересекающиеся файлы):
  F1  fix/weekly-loop          ── plan/index, plan/review, shopping/index, feedback, shell
  F2  fix/household-backend    ── onboarding, family (+ новые роуты/схема)
  F5  fix/polish-quickwins     ── (auth)/login, register, recipes  [чистая косметика]
  F3  feat/recipe-placeholders ── ui-native MealCard + recipe/[id]  [фронт, без фото]

Последовательно (трогают те же файлы, что F1/F3):
  F4  feat/intelligent-surface ── после F1 и F3 · самый большой, продукт-дефайнинг
```

- **F1 ∥ F2 ∥ F5 ∥ F3** можно гонять одновременно (разные файлы; F3 лишь чуть трогает plan/index — согласовать проп с F1 при мёрже).
- **F4** после F1 и F3 (те же экраны). Восстанавливает «интеллект» из макета.

---

## F1 — Недельная петля и надёжность генерации (оба BLOCKER) · ветка `fix/weekly-loop`

```
First: git checkout main && git pull && git checkout -b fix/weekly-loop. Work only on this branch.

Fix the broken weekly loop (cook → shop → rate → regenerate) and make async plan generation consistent across screens. Owns: apps/mobile/app/(tabs)/plan/index.tsx, plan/review.tsx, (tabs)/shopping/index.tsx, app/feedback/[planId].tsx, (tabs)/_layout.tsx.

1. Async generation — single shared pattern. plan/index.tsx already polls every 8s while not 'ready'. Add a retry CEILING (e.g. ~15 polls / ~2 min); on exceeding, switch to an error state with a "Spróbuj ponownie" action AND surface an explicit error message/toast to the user (do not poll forever). Extract this generate+poll logic so it can be reused.

2. plan/review.tsx — "Wygeneruj nowy" currently calls generatePlan() then immediately loadPlan(), returning the stale draft. Reuse the F1 generate+poll pattern with a "Generuję nowy plan…" state instead of an instant refetch.

3. shopping/index.tsx — "Rozpocznij nowy tydzień" (handleStartNewWeek) currently POSTs generate and immediately router.replace to plan, swallowing errors and skipping feedback. Instead: first route the user to the feedback screen for the finishing plan (W09), and only after that trigger generation using the poll pattern, surfacing any error (no silent catch).

4. feedback/[planId].tsx (W09) is unreachable in-app. Add in-app entry points: (a) a CTA after plan approval, (b) an end-of-week prompt on the plan or shopping screen, and ensure it is navigable (link or surfaced from the plan tab). Guard submitFeedback so it never fires when planId === null. Add a "Wróć do planu" button on the success/done state (currently a dead-end).

5. plan/review.tsx — after approve, show a confirmation that the shopping list is being generated, with a link to the Zakupy tab (approval's whole purpose per CLAUDE.md).

6. plan/index.tsx — add a swap affordance directly from the day cards (open the existing RecipeSwapSheet) and a path into feedback.

7. shopping/index.tsx (same screen as W08) housekeeping: allow UN-checking a bought item (make the checkbox toggle both ways via updateItemStatus); wrap the grouped list container (listScroll) in a ScrollView so long lists scroll; for manually added items allow choosing a category and deleting a row (add a DELETE shopping-item route if none exists; keep domain logic in packages/domain, route thin + Zod + withAuth).

Constraints (CLAUDE.md): domain-only business logic, thin routes, Zod on writes, strict types, HARD CONSTRAINTS untouched.
Done: pnpm typecheck green (9 pkgs) + mobile Jest pass. Update ROADMAP.md + CHANGELOG.md. Commit on fix/weekly-loop.
```

---

## F2 — Дыры бэкенда: онбординг + семья (ANNOYING) · ветка `fix/household-backend`

```
First: git checkout main && git pull && git checkout -b fix/household-backend. Work only on this branch.

Close the backend-gap UIs that currently render optimistically then silently roll back. Owns: apps/mobile/app/onboarding/index.tsx, (tabs)/family/index.tsx, plus new API routes in apps/web, domain methods, and schema if needed.

1. Persist onboarding household data. onboarding finish() collects household name (step 1) and member count (step 2) but only sends allergies/restrictions (TODO: not persisted). Add/extend a route (e.g. PATCH /api/family or /api/household) + domain method to save householdName and memberCount, and wire finish() to call it.

2. onboarding cosmetics (same file): add a consistent "Pomiń" on step 2 (currently only step 1 has skip); fix the step-1 title mismatch ("Jak masz na imię?" → "Jak nazwiemy Twoją rodzinę?" to match the Nazwa rodziny field); remove the dead error UI (error shows then router.replace unmounts immediately) — either block navigation on save error or drop the error branch.

3. Family members CRUD. family/index.tsx "add member" POSTs to a non-existent route → row appears then vanishes. Add POST /api/family/members (create) plus PATCH and DELETE for edit/remove and changing "eats at home" (mealsAtHome). Wire W05 add/edit/remove and surface failures to the user instead of silent rollback. Domain logic in packages/domain, routes thin + Zod + withAuth.

4. family/index.tsx — show custom (free-text) restrictions added during onboarding (currently only the 4 canonical chips render) and allow removing them.

5. Server-side onboarding-complete flag. The completed flag is local SecureStore only, so a reinstall re-runs onboarding with no server memory. Derive completion from backend household state so returning users skip onboarding.

Constraints (CLAUDE.md): domain-only logic, thin routes, Zod on writes, strict types, allergies/hardRestrictions are HARD CONSTRAINTS.
Done: pnpm typecheck green (9 pkgs) + mobile Jest pass; new routes check auth. Update ROADMAP.md + CHANGELOG.md. Commit on fix/household-backend.
```

---

## F5 — Косметика, непересекающиеся файлы (parallel anytime) · ветка `fix/polish-quickwins`

```
First: git checkout main && git pull && git checkout -b fix/polish-quickwins. Work only on this branch.

Small isolated fixes on disjoint files. Owns: apps/mobile/app/(auth)/login.tsx, register.tsx, (tabs)/recipes/index.tsx.

1. login.tsx — add a "Nie pamiętasz hasła?" (forgot password) affordance (link to a reset flow or, if no backend reset exists yet, a clearly-labelled stub that explains how to recover). Add a pending/disabled state to the social sign-in buttons (Google/Apple) while the OAuth redirect spins up (currently no feedback).

2. recipes/index.tsx — the tab is a permanent empty placeholder (no list/search). Hide the "Przepisy" tab until it's populated (remove it from the tab bar in (tabs)/_layout.tsx) rather than showing a dead tab. (If you prefer to keep it, wire it to the current plan's recipes — but hiding is the quick win.)

Constraints: strict types. Done: pnpm typecheck green + Jest pass. Update CHANGELOG.md. Commit on fix/polish-quickwins.
```

---

## F3 — Красивые плейсхолдеры вместо фото (ANNOYING) · ветка `feat/recipe-placeholders`

> Решение: фото пока НЕ заводим. Вместо серых плейсхолдеров — аккуратные иллюстрированные/цветные карточки. Чисто фронтовая работа, без схемы и пайплайна картинок. Почти не пересекается с F1 (живёт в компоненте `MealCard` + hero рецепта) — можно гонять параллельно, только проп категории/seed в `plan/index.tsx` согласовать с F1.

```
First: git checkout main && git pull && git checkout -b feat/recipe-placeholders. Work only on this branch.

We are NOT adding recipe photos. Replace the gray/blurhash placeholders with attractive, deterministic illustrated/colored cards so the app stops looking broken. Owns: packages/ui-native (MealCard + any Placeholder), apps/mobile/app/(tabs)/plan/recipe/[id].tsx. Minimal touch to plan/index.tsx (pass a seed/category prop only).

1. MealCard placeholder (packages/ui-native): replace the gray placeholder with a pleasant generated visual — a deterministic color/gradient derived from the recipe name or category (stable per dish), with a food/category glyph or the dish initials centered, in the Plately green/lime palette. No external images.

2. Recipe detail hero (recipe/[id].tsx): replace the always-placeholder 240px hero with the same deterministic colored/illustrated header (larger), so library-opened recipes look intentional, not broken.

3. Fold in W02 cosmetics on this screen: HIDE the "Zamień w planie" CTA entirely when !canSwap (currently a disabled full-width dead button); make the Składniki/Kroki/Zamienniki tabs real Pressables with padding hit-area + pressed feedback (currently <Text onPress>).

4. plan/index.tsx: pass the seed (recipe name or category) into MealCard so the placeholder is stable per dish. Keep this change tiny to avoid clashing with the F1 branch.

Constraints: strict types; keep ui-native tests green. Done: pnpm typecheck green (9 pkgs) + ui-native & mobile Jest pass. Update CHANGELOG.md. Commit on feat/recipe-placeholders.
```

## F4 — «Интеллектуальная» поверхность из макета · ветка `feat/intelligent-surface` · после F1+F3

Самый большой, продукт-дефайнинг. Затрагивает plan/index, plan/review, recipe/[id], RecipeSwapSheet, shopping/index — те же файлы, что F1/F3, поэтому строго после них.
- AI-блок «почему такой план» + per-dish бейджи (Kid-ok, Leftovers, Try-new, цена) на W01/W04 и в деталях рецепта.
- W02: сворачиваемые секции (хранение / для детей / замены) + «mark cooked».
- W07: быстрые чипы причин замены (Проще/Дешевле/Полезнее/Детям/Другая кухня) + превью результата/«меняем…».
- W03: показать в строках рецепт-источник, «нужно к Пн», промо (Biedronka/Lidl) и оценку стоимости — данные уже есть в модели (`relatedRecipeIds`, `neededByDate`, `promoHintId`), кроме цены.
- W04: Approve primary / Regenerate ghost; «Średnio» для `kids_didnt_eat` → корректная подпись.

Часть требует новых полей данных (reasoning-текст, бейджи) — уточним объём перед стартом.
```
