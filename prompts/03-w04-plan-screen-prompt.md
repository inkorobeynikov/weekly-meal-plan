# Coding Agent Prompt — W04 Weekly Plan Review Screen

## Goal

Build the first real screen of the mini app: **W04 Weekly Plan Review**.

Replace the `apps/web/app/(app)/plan/page.tsx` stub (`<h1>Coming soon</h1>`) with a fully functional React component matching the design reference. Wire up the `(app)` layout to use `@meal-planner/ui` shell components. Use mock data — no API or DB calls yet.

After this task `pnpm -r typecheck` must pass with zero errors, and the Plan tab must render the full W04 screen with working interactive states.

---

## What already exists — read before touching anything

### `packages/ui` — fully built design system
Read these files carefully before writing a single line of JSX:
- `packages/ui/src/tokens.ts` — color tokens (`T.ink`, `T.sage`, `T.amberSoft`, etc.) and `radii`, `shadows`
- `packages/ui/src/primitives.tsx` — exports: `Badge`, `Card`, `Button`, `Avatar`, `Placeholder`, `RestrictionStrip`, `Iconchip`
- `packages/ui/src/shell.tsx` — exports: `Frame`, `StatusBar`, `TabBar`, `Body` (and `TabId` type)
- `packages/ui/src/icons.tsx` — all icons; grep for the ones you need
- `packages/ui/src/index.ts` — barrel; import from `@meal-planner/ui`

### `packages/domain/src/services/plan.service.ts`
Already has stubs for `getPlanWithMeals`, `approvePlan`, `replaceMeal`. The TypeScript types are in place. You will NOT call these yet — use mock data. The function signatures tell you the shape of real data.

### `.design-ref/project/mp-screens-plan.jsx`
**This is your primary design reference.** It contains pixel-accurate JSX for W04, W05, and W07, including:
- The `WEEK` mock data array (Polish dish names, times, difficulty, cost, leftover flags)
- `DayCard` component layout
- `ReplaceSheet` bottom sheet layout
- Exact spacing, font sizes, and token usage

Read this file in full before implementing. Port it to TypeScript React with proper types.

### `apps/web/app/(app)/layout.tsx`
Currently uses plain Tailwind + Next.js `<Link>`. You will replace this with `@meal-planner/ui` shell.

### `apps/web/app/(app)/plan/page.tsx`
Currently `<h1>Coming soon</h1>`. Replace entirely.

---

## Task 1 — Add `@meal-planner/ui` to `apps/web`

In `apps/web/package.json`, add the dependency:
```json
"@meal-planner/ui": "workspace:*"
```

Then run `pnpm install` from the repo root.

---

## Task 2 — Rebuild `apps/web/app/(app)/layout.tsx`

Replace the current layout with one that uses `Frame` + `TabBar` from `@meal-planner/ui`.

Rules:
- This must be a **client component** (`'use client'`) because `TabBar` needs `usePathname` and `useRouter`.
- Use `usePathname()` from `next/navigation` to determine the active tab.
- Use `useRouter()` to navigate on tab press.
- Map tab IDs to routes: `plan → /plan`, `shopping → /shopping`, `recipes → /recipes`, `family → /family`.
- `Frame` wraps the entire screen (sets background, max-width, full-height layout).
- `StatusBar` should be hidden (`hidden` prop) — we are inside a real browser/Telegram WebView.
- `TabBar` goes inside `Frame` — it is `position: absolute` at the bottom, so it stays fixed within the frame.
- The page `children` goes between `Frame` and `TabBar` — do NOT wrap in `Body` here; each page manages its own `Body`.

```tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Frame, StatusBar, TabBar, type TabId } from '@meal-planner/ui'

const ROUTE_TO_TAB: Record<string, TabId> = {
  '/plan':     'plan',
  '/shopping': 'shopping',
  '/recipes':  'recipes',
  '/family':   'family',
}

const TAB_TO_ROUTE: Record<TabId, string> = {
  plan:     '/plan',
  shopping: '/shopping',
  recipes:  '/recipes',
  family:   '/family',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const active = ROUTE_TO_TAB[pathname] ?? 'plan'

  return (
    <Frame>
      <StatusBar hidden />
      {children}
      <TabBar active={active} onSelect={(id) => router.push(TAB_TO_ROUTE[id])} />
    </Frame>
  )
}
```

---

## Task 3 — Build `apps/web/app/(app)/plan/page.tsx`

This is a **client component** (`'use client'`). It renders W04 (list state) and the W06 Replace Sheet (overlay state) in one file.

### Mock data

Define mock data at the top of the file. Copy from the design reference (`WEEK` array), but add proper TypeScript types:

```typescript
type Difficulty = 'easy' | 'medium' | 'hard'
type CostLevel = '€' | '€€' | '€€€'

interface MockMeal {
  id: string
  day: string
  date: string
  dish: string
  time: string
  diff: Difficulty
  cost: CostLevel
  kid: boolean
  leftover: boolean
  newTag?: boolean
  reason: string
}

const WEEK: MockMeal[] = [
  { id: 'mon', day: 'Monday',    date: '19', dish: 'Kotlet schabowy z ziemniakami',      time: '45 min', diff: 'easy',   cost: '€€',  kid: true,  leftover: true,  reason: 'Family classic, makes great lunchboxes' },
  { id: 'tue', day: 'Tuesday',   date: '20', dish: 'Makaron z kurczakiem i szpinakiem',  time: '25 min', diff: 'easy',   cost: '€',   kid: true,  leftover: false, reason: 'Weeknight 25-min, kids approved' },
  { id: 'wed', day: 'Wednesday', date: '21', dish: 'Żurek z jajkiem i kiełbasą',         time: '30 min', diff: 'medium', cost: '€€',  kid: false, leftover: true,  reason: 'Uses Monday leftover kiełbasa' },
  { id: 'thu', day: 'Thursday',  date: '22', dish: 'Pierogi z mięsem',                   time: '20 min', diff: 'easy',   cost: '€',   kid: true,  leftover: false, reason: 'Quick — Ania has practice at 18:00' },
  { id: 'fri', day: 'Friday',    date: '23', dish: 'Łosoś pieczony z warzywami',         time: '35 min', diff: 'medium', cost: '€€€', kid: true,  leftover: false, reason: 'Try-new: oven salmon, low-effort', newTag: true },
  { id: 'sat', day: 'Saturday',  date: '24', dish: 'Pizza domowa z rodziną',             time: '60 min', diff: 'medium', cost: '€€',  kid: true,  leftover: false, reason: 'Weekend cooking-together meal' },
]

const RESTRICTIONS = ['No broccoli', 'No spicy', 'No shellfish']

const AI_SUMMARY = '3 quick weekday meals, 2 leftover-friendly, 1 try-new. Skipped broccoli & spicy. Saturday is a cooking-together night.'
```

### Component structure

```
PlanPage (client, holds state: replacingMealId | null)
  └── Body (from @meal-planner/ui, top=6, bottom=124)
        ├── PlanHeader (week dates, avatars, AI summary card, RestrictionStrip)
        ├── MealList (maps WEEK → DayCard)
        │     └── DayCard (Card + day pill + dish name + badges + menu button)
        └── StickyActions (Regenerate ghost btn + Approve Plan primary btn)
  └── ReplaceSheet (bottom sheet, shown when replacingMealId !== null)
        ├── drag handle
        ├── current dish name
        └── replace option list (Simpler / Cheaper / Healthier / Kid-friendly / Different cuisine / custom text input)
```

### State

```typescript
const [replacingId, setReplacingId] = useState<string | null>(null)
const replacingMeal = replacingId ? WEEK.find(m => m.id === replacingId) ?? null : null
```

- Clicking the `···` menu button on a `DayCard` calls `setReplacingId(meal.id)`
- The `ReplaceSheet` closes on backdrop tap or explicit cancel
- When `replacingMeal` is set, `Body` shrinks (`bottom={320}`) to leave room for the sheet

### Badges

Use the `Badge` component from `@meal-planner/ui`. Tone mapping:
- time → `amber`
- difficulty → `neutral`
- cost → `neutral`
- kid-ok → `sage`
- leftover → `blue`
- try-new → `plum`

### PlanHeader

Matches the design reference exactly:
- Label "Next week" (muted, small)
- H1 "May 19 – 25" (large, display weight)
- Avatar stack (right-aligned): A (amber) / P (plum, ring) / J (sage, ring)
- AI reasoning card: small "ai" pill + italic summary text
- `RestrictionStrip` with `RESTRICTIONS`

### DayCard

```
Card (padding 14, highlighted if being replaced)
  Row:
    Day pill (46px wide, surface2 bg):
      - 3-letter day abbr (uppercase, tiny)
      - date number (large, display font)
    Content column:
      - Dish name (17px, 600 weight, leading-tight)
      - ··· button (top-right, 28×28 tap target)
      - Badge row (compact, gap 6)
```

Highlighted state when `replacingId === meal.id`: `boxShadow: shadows.cardHighlight` from tokens.

### StickyActions

```
Position: absolute, bottom: 84px (above TabBar), left 0, right 0
Gradient fade behind it (rgba(251,247,241,0) → T.bg)
Two buttons in a row:
  - "Regenerate" ghost, icon: refresh, flex: 0 0 auto, padding 0 18px
  - "Approve plan" primary, icon: check, flex: 1
```

When `replacingMeal` is set, hide StickyActions entirely.

### ReplaceSheet

Bottom sheet, `position: absolute`, `left 0 right 0 bottom 0`, `borderTopRadius radii.xl`, `boxShadow shadows.sheet`.

```
- Drag handle (36×4px pill, centered)
- Section label "Replace {day}" (muted uppercase 12px)
- Dish name (19px display)
- Option list (scrollable):
    Simpler       → amber chip + "Same idea, fewer steps"
    Cheaper       → sage chip + "Use pantry staples"
    Healthier     → sage chip + "More veg, less fat"
    Kid-friendly  → plum chip + "Mild, familiar"
    Different     → blue chip + "Asian / Italian / …"
    [custom text button, dashed border]
- Cancel button (ghost, full width, "Cancel")
```

Each option row: `background: T.surface2`, 12px border-radius, 12px padding, chevron icon right.

---

## Task 4 — Verify

Run:
```bash
pnpm -r typecheck
```

Zero errors required. Fix any type issues before committing.

Then open `http://localhost:3000/plan` — the W04 screen must:
- Show 6 meal cards with correct Polish dish names
- Show AI reasoning card
- Show RestrictionStrip
- Tapping `···` on any card opens the ReplaceSheet with that dish name
- Tapping outside or Cancel closes the sheet
- Approve and Regenerate buttons are visible in the default state

---

## Hard constraints

- **No DB/API calls in this PR.** All data is local mock constants.
- **No `any` types.** Strict TypeScript throughout.
- `packages/domain` and `packages/ui` must not be modified — only consume them.
- Keep `packages/ui` components as-is. Do not inline token values; always import from `@meal-planner/ui`.
- The `(app)/layout.tsx` must remain a client component (router integration requires it).

---

## Commit

One PR, title: `feat(web): W04 plan review screen + ui shell layout`
