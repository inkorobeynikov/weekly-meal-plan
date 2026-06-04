# Оркестрация починок — один промпт для Claude Code

> Запускает все 5 блоков из `FIX-PLAN.md` из одной сессии: F1/F2/F3/F5 параллельно (каждый в своём git worktree на своей ветке), F4 — после F1 и F3. Worktree-изоляция убирает конфликты веток.

## Вариант A (рекомендую) — параллельные worktree-subagent'ы

Вставь это в Claude Code в корне репозитория:

```
Read FIX-PLAN.md at the repo root. It defines five fix blocks derived from a UX review: F1, F2, F3, F5 are independent (disjoint files); F4 depends on F1 and F3. Orchestrate them as follows, using worktree-isolated subagents (isolation: worktree) so each block runs on its OWN git branch in its OWN worktree with no conflicts.

PHASE 1 — run these FOUR blocks IN PARALLEL, each as a separate worktree subagent, following the exact prompt written for that block in FIX-PLAN.md:
  - F1 → branch fix/weekly-loop          (weekly loop + async generation; both BLOCKERs)
  - F2 → branch fix/household-backend    (onboarding persist + family CRUD)
  - F3 → branch feat/recipe-placeholders (nice placeholders instead of photos)
  - F5 → branch fix/polish-quickwins     (auth + hide empty recipes tab)
Each subagent must: branch from the latest main; implement its block exactly per FIX-PLAN.md; ensure `pnpm typecheck` is green across all 9 packages and the relevant Jest suites pass; update ROADMAP.md + CHANGELOG.md per the CLAUDE.md tracking rule; commit on its branch; then open a PR (or report the branch name + a one-line summary). A subagent must NOT finish with typecheck or tests red.

PHASE 2 — only AFTER F1 and F3 are complete, integrate them into main (merge their branches), then run:
  - F4 → branch feat/intelligent-surface, branched from the updated main (so it contains F1 + F3), per FIX-PLAN.md.

Global constraints for EVERY block (from CLAUDE.md, non-negotiable):
  - All business logic lives in packages/domain; Next.js routes + bot handlers are thin controllers.
  - Zod-validate every write; strict types, no `any`.
  - Allergies and hardRestrictions are HARD CONSTRAINTS — never violated.
  - Every API route that writes data checks auth first.

When all blocks are done, print a summary table: block → branch → status (green/red) → PR link. Flag any block you could not finish and why.
```

## Если хочешь меньше токенов / больше контроля

- **Последовательно, по одному:** убери «IN PARALLEL», скажи «run the blocks one at a time in this order: F1, F2, F3, F5, then F4, merging each before the next». Медленнее, дешевле, проще ревьюить.
- **Только блокеры сначала:** «run only F1 now; hold F2/F3/F5/F4». Сначала чинит то, что ломает основной цикл, остальное потом.

## Заметки

- Worktree-изоляция требует, чтобы агенты могли создавать ветки от свежего `main` — сведи операционку до старта (влей `chore/bot-dormant`, проверь, что `pnpm typecheck` на `main` зелёный).
- F4 трогает те же экраны, что F1/F3 — поэтому он строго в Phase 2, после их вливания, иначе конфликты.
- Параллель ≈ 2–3× токенов против последовательного прогона, но кратно быстрее по времени.
```
