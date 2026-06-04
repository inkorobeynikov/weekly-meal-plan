# Phase D — Дистрибуция (деплой + первые семьи)

> Цель: вывести нативное приложение к 2–3 реальным семьям. НЕ полноценный публичный релиз в сторах — для первых пользователей это лишний барьер. Самый быстрый путь ниже.

## Состояние (по коду)

- EAS-проект уже есть: `app.json` → `projectId 316074eb-...`, owner `inkorobeynikov`. Bundle id `com.mealplanner.app` (iOS + Android).
- `vercel.json` для `apps/web` готов.
- **Нет `eas.json`** (профили сборки) — нужно создать.
- `app.json` version `0.0.0` — нужно поднять.
- Мобилка: `BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` — для прод-сборок надо подставить URL задеплоенного бэкенда.
- Бот усыплён → переменные `BOT_TOKEN` / `BOT_WEBHOOK_URL` в проде НЕ нужны.

---

## Самый быстрый путь к первой семье

- **Android:** `eas build -p android --profile preview` собирает APK → шлёшь ссылку → ставится сразу, без Google-аккаунта и модерации. **Самый быстрый вариант.**
- **iOS:** только TestFlight (sideload нельзя). Нужен Apple Developer Program ($99/год) → `eas build` + `eas submit` → пригласить по email. Если первые семьи на Android — iOS можно отложить.

---

## D1 — Промпт для агента (автоматизируемая часть)

```
First, create and switch to a new branch off the latest main: `git checkout main && git pull && git checkout -b chore/distribution-setup`. Do all work for this block on that branch.

Prepare the Expo app + backend for distribution. This block is config only — do NOT run `eas build`/`eas submit` (those need interactive Expo/Apple/Google credentials, handled by a human).

1. apps/mobile/app.json — bump version to 1.0.0; add iOS buildNumber "1" and Android versionCode 1. Keep bundleIdentifier/package com.mealplanner.app and the existing EAS projectId/owner.

2. Create apps/mobile/eas.json with three build profiles:
   - development: developmentClient true, internal distribution.
   - preview: internal distribution; Android buildType apk; env EXPO_PUBLIC_API_URL set to the production backend URL placeholder `https://REPLACE_WITH_PROD_URL`.
   - production: store builds, autoIncrement true; same EXPO_PUBLIC_API_URL prod placeholder.
   Add a `submit` section with placeholders for iOS (Apple ID / ascAppId / team) and Android (service-account key path, track "internal").

3. API base URL: keep apps/mobile/src/lib/api.ts reading EXPO_PUBLIC_API_URL, but make the localhost fallback dev-only (only when __DEV__), so a prod build never silently points at localhost. Update the app.json `extra.apiUrl` comment to note it's dev-only.

4. expo-notifications: confirm the plugin is configured in app.json. Add a short note in eas.json or a comment that EAS will provision APNs (iOS) and FCM (Android) credentials at build time — no code change needed; ExpoPushTokens keep working as long as the build is signed via EAS.

5. Create DEPLOY.md at the repo root — a concise runbook:
   - Backend (Vercel): required env vars (DATABASE_URL prod, OPENAI_API_KEY, OPENAI_MODEL_FAST/SMART, JWT_SECRET, JWT_EXPIRES_IN, INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, NEXT_PUBLIC_APP_URL = deployed URL; optionally EXPO_ACCESS_TOKEN for server push). Note BOT_TOKEN/BOT_WEBHOOK_URL are NOT needed (bot dormant).
   - DB: provision prod Postgres, then `pnpm -F @meal-planner/db migrate` (must include migration 0003 push_tokens).
   - Inngest: connect the prod app, set signing/event keys.
   - Mobile: `eas build -p android --profile preview` (APK to hand out), `eas build -p ios --profile production` + `eas submit -p ios` (TestFlight). Set EXPO_PUBLIC_API_URL to the real backend URL in eas.json first.

6. Roadmap hygiene (CLAUDE.md tracking rule): in ROADMAP.md mark Phase 4d (W06 web onboarding) and Phase 5 "Web UI: W08 Shopping Checked" as out-of-scope / deprioritized after the native pivot + dormant bot (do not delete — annotate). Append a CHANGELOG.md line. Add a new "Phase D — Distribution" section listing the eas.json + DEPLOY.md work.

Done check: `pnpm typecheck` green across 9 packages; mobile Jest passes; eas.json is valid JSON. Commit on chore/distribution-setup.
```

---

## D2 — Ранбук для человека (аккаунты, секреты, сторы)

Эти шаги нельзя автоматизировать — нужны твои учётки и оплаты.

**Бэкенд**
- [ ] Прод Postgres (Neon / Supabase / Vercel Postgres) → `DATABASE_URL`.
- [ ] Vercel: импортировать репо, прописать env-переменные из `DEPLOY.md`, задеплоить `apps/web`.
- [ ] Накатить миграции на прод-БД (`pnpm -F @meal-planner/db migrate`) — включая `0003 push_tokens`.
- [ ] Inngest: подключить прод-приложение, задать signing/event keys.
- [ ] (Рекомендуется) `EXPO_ACCESS_TOKEN` для серверной отправки push.

**Мобилка**
- [ ] В `eas.json` подставить реальный URL бэкенда вместо `REPLACE_WITH_PROD_URL`.
- [ ] `eas login`, при необходимости `eas credentials` (APNs/FCM).
- [ ] **Android:** `eas build -p android --profile preview` → раздать APK семьям.
- [ ] **iOS:** Apple Developer Program ($99/год) → `eas build -p ios --profile production` → `eas submit -p ios` → пригласить в TestFlight.
- [ ] (Опц.) Google Play Console ($25 разово) — internal testing track, если хочешь не APK, а через Play.

**Юридическое / сторы (минимум)**
- [ ] Privacy policy URL — требуется сторами (собираешь аккаунты + push-токены). Хватит простой страницы.
- [ ] Базовый листинг: иконка, скриншоты, описание (для TestFlight внешнего тестирования и Play).

---

## После запуска — что мерить

Аналитика уже инструментирована (`plan_generated`, `plan_approved`, `meal_replaced`, `shopping_list_generated`, `feedback_submitted`, `retention_nudge_sent`). На первых семьях смотреть: доходит ли push, доходят ли люди от онбординга до approve, возвращаются ли на 2-ю неделю.
```
