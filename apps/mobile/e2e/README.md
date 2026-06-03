# Mobile E2E — Maestro + mock API server

Cross-platform UI end-to-end tests for the Expo app (`apps/mobile`). The **same**
Maestro flows run on **both** targets:

- **iOS Simulator on macOS** (primary — matches the iPhone target)
- **Android emulator on Windows** (second target)

Flows drive the **real app** against a small **mock API server**, so they never
depend on Postgres / Inngest / OpenAI / the `apps/web` backend. Everything here is
mobile-only.

```
e2e/
├── mock-server/        Typed, dependency-free Node http mock (no DB)
│   ├── server.ts       Routing + mutable runtime state + scenario control
│   ├── fixtures.ts     One deterministic fixture set
│   └── types.ts        Response contracts (mirror src/lib/api.ts)
├── maestro/
│   ├── config.yaml     Limits `maestro test` to the top-level flows
│   ├── *.yaml          One flow per screen (9 flows)
│   └── subflows/       Reusable building blocks (login, set-scenario)
├── run-e2e.mjs         Boots the mock, waits for health, runs Maestro
└── tsconfig.json       Standalone Node typecheck for the mock server
```

## What's covered (all 9 screens)

| Flow                   | Screen(s)   | Proves |
| ---------------------- | ----------- | ------ |
| `auth.yaml`            | W06         | register → onboarding; "logout" → login (email/password) → plan |
| `onboarding.yaml`      | W06         | 3 steps, allergy chips, finish → plan |
| `plan-generate.yaml`   | W01 → W02   | empty → generate → "Generujemy…" → plan (7 days, obiad+kolacja) → recipe |
| `review-approve.yaml`  | W04         | draft → review → "Zatwierdź plan" → "Plan zatwierdzony" |
| `allergy-guard.yaml`   | W04         | **HARD CONSTRAINT** — banner shown AND approve button disabled |
| `swap.yaml`            | W07         | open swap sheet, alternatives load, re-roll, select |
| `recipe-detail.yaml`   | W02         | green safe badge vs red allergy badge; tab switching |
| `shopping.yaml`        | W03 → W08   | add item, check all → "Wszystko kupione! 🎉" |
| `family-feedback.yaml` | W05 / W09   | allergy/cuisine chips + budget; meal reactions + submit |

## Scenarios

The mock serves one deterministic fixture set projected into switchable
scenarios. A flow pins its scenario up-front via the control endpoint
(`POST /__e2e/scenario`) using the `subflows/setScenario.js` runScript helper:

| Scenario             | Behaviour |
| -------------------- | --------- |
| `no-plan`            | `GET /api/plans/current` → 404 (empty state). `generate` flips it to a draft. |
| `draft-plan`         | 7 days, one obiad (`lunch`) + one kolacja (`dinner`) per day, status `draft`. |
| `approved-plan`      | Same meals, status `approved`; shopping list available. |
| `plan-with-allergen` | Day-1 obiad recipe contains gluten + household is allergic to Gluten. |
| `shopping-active`    | Shopping list with pending items. |
| `shopping-all-bought`| Shopping list with everything bought (celebration). |

The mock also models real transitions inside a flow: `generate` → draft,
`approve` → approved + shopping list, checking/adding items, sign-in/out.

---

## Host networking — READ THIS

The **app** (running on the device/emulator) reaches the mock differently per
platform; the **Maestro `runScript` calls run on the host**, so they always use
`localhost`:

| Target                         | App → mock (`EXPO_PUBLIC_API_URL`) | Maestro runScript (`MOCK_URL`) |
| ------------------------------ | ---------------------------------- | ------------------------------ |
| iOS Simulator (macOS)          | `http://localhost:4010`            | `http://localhost:4010`        |
| Android emulator (Windows)     | `http://10.0.2.2:4010`             | `http://localhost:4010`        |

> On the Android emulator, `10.0.2.2` is the host loopback alias — `localhost`
> from inside the emulator points at the emulator itself, not your PC.

A **development build** (`expo run:ios` / `expo run:android`) gives the most
stable automation. **Expo Go** also works (open the project, then run Maestro
against it); a dev/standalone build is preferred because deep links and cleared
state behave most predictably.

---

## Setup — Windows + Android emulator (developer's PC)

1. **Install Android Studio**, create an AVD (e.g. *Pixel 7, API 34*), and start it:
   ```powershell
   emulator -list-avds
   emulator -avd Pixel_7_API_34
   ```
2. **Install Maestro** (see <https://maestro.mobile.dev>) and confirm `maestro --version`.
3. **Start the mock server** (terminal A):
   ```powershell
   pnpm -F @meal-planner/mobile e2e:mock      # listens on :4010
   ```
4. **Build & launch the app pointed at the mock** (terminal B). The emulator
   reaches your PC at `10.0.2.2`:
   ```powershell
   $env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:4010"
   $env:EXPO_PUBLIC_BETTER_AUTH_URL = "http://10.0.2.2:4010"
   pnpm -F @meal-planner/mobile exec expo run:android
   ```
5. **Run the flows** (terminal C):
   ```powershell
   pnpm -F @meal-planner/mobile e2e:android   # = maestro test e2e/maestro
   ```

## Setup — macOS + iOS Simulator (developer's MacBook)

1. **Install Xcode** + the iOS Simulator, and boot a simulator (e.g. *iPhone 15*):
   ```bash
   xcrun simctl boot "iPhone 15"
   open -a Simulator
   ```
2. **Install Maestro**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   maestro --version
   ```
3. **Start the mock server** (terminal A):
   ```bash
   pnpm -F @meal-planner/mobile e2e:mock      # listens on :4010
   ```
4. **Build & launch the app pointed at the mock** (terminal B). The simulator
   shares the host network, so `localhost` works:
   ```bash
   export EXPO_PUBLIC_API_URL="http://localhost:4010"
   export EXPO_PUBLIC_BETTER_AUTH_URL="http://localhost:4010"
   pnpm -F @meal-planner/mobile exec expo run:ios
   ```
5. **Run the flows** (terminal C):
   ```bash
   pnpm -F @meal-planner/mobile e2e:ios        # = maestro test e2e/maestro
   ```

### One command (mock + Maestro together)

`run-e2e.mjs` boots the mock, waits for it to be healthy, runs the whole suite,
then shuts the mock down. The app must already be installed/running on a booted
device or emulator:

```bash
pnpm -F @meal-planner/mobile e2e
```

---

## Running a single flow

```bash
maestro test apps/mobile/e2e/maestro/allergy-guard.yaml
```

## Switching scenarios manually

Each flow sets its own scenario, but you can drive the mock by hand:

```bash
# Set the active scenario
curl -X POST localhost:4010/__e2e/scenario -d '{"scenario":"plan-with-allergen"}'
# Inspect current state
curl localhost:4010/__e2e/health
```

Override the host the Maestro scripts use (rarely needed — defaults to localhost):

```bash
maestro test -e MOCK_URL=http://localhost:4010 apps/mobile/e2e/maestro
```

## Selectors

Flows target stable `testID`s (and existing Polish `accessibilityLabel`s / text),
never screen coordinates. Platform-specific UI (e.g. the iOS-only Apple sign-in
button) is gated behind `EXPO_PUBLIC_ENABLE_SOCIAL` and is not exercised — auth
always uses email/password.

## Typecheck

The mock server is typed and checked separately from the app (Node vs
React-Native libs):

```bash
pnpm -F @meal-planner/mobile e2e:typecheck
```

## Notes / limitations

- **Logout**: the app has no logout button — sign-out is wired to the API 401
  handler. `auth.yaml` represents the signed-out state via `clearState` + the
  mock resetting auth, then signs back in.
- **Feedback (W09)** has no in-app nav entry (normally reached from a push
  notification), so `family-feedback.yaml` opens it with a `mealplanner://`
  deep link.
- The mock is **not** a contract test — it returns valid-looking shapes so the UI
  renders; it does not re-implement domain rules.
