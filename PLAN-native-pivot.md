# План: разворот на нативные приложения, бот → спящий режим

> Решение (2026-06-03): MVP работает, но живых пользователей нет. Отказываемся от Telegram-бота как продукта, делаем нативные iOS/Android (Expo) основным каналом. Бот — в **спящий режим** (код остаётся, деплой/webhook снимаются). Эта работа в три блока: **A — доводка мобилки**, **B — push-слой вместо бота**, **C — усыпление бота**. Промпты для агента — в `WORKFLOW-native-pivot.md`.

---

## Контекст / находки по коду

- TODO-комментарии в мобилке **устарели**: роуты `replace` и `shopping item PATCH` уже существуют. Мобилка просто разворачивает ответ неправильно (ждёт «голое» тело, а роут отдаёт `{ meal }` / `{ item }`).
- Реально отсутствует только **один** роут: добавить товар вручную (`POST /api/shopping/lists/:listId/items`). Доменный метод `shoppingService.addManualItem` уже написан.
- Свайп-шит (`RecipeSwapSheet`) спроектирован под **показ AI-альтернатив и выбор одной** (`/alternatives` + replace по `recipeId`). Текущий backend этого не умеет — он делает AI-замену по `reason`. Здесь развилка (см. A4).
- `expo-notifications` подключён в `package.json` и плагинах, **но кода нет** — push реально не работает.
- Уведомления в бэкенде завязаны на Telegram (`households.telegramChatId`): план готов (`plan-generate.ts`), ретеншн-нудж (`retention-trigger.ts`), фидбек-ремайндер (cron внутри `apps/bot` — при усыплении бота **молча умрёт**).
- `apps/web` сейчас импортирует `getBot()` из `@meal-planner/bot` в двух Inngest-функциях — это последняя связка web↔bot. После миграции на push она убирается, и web полностью отвязывается от грамми.

---

## Блок A — Доводка мобилки (≈0.5 дня)

Цель: приложение работает end-to-end, без заглушек.

- **A1. Починить `replaceMeal`** — `apps/mobile/src/lib/api.ts`. Роут существует, отдаёт `{ meal }`. Развернуть `.meal`, убрать устаревший TODO.
- **A2. Починить `updateShoppingItem`** — `apps/mobile/src/lib/api.ts`. Роут существует, отдаёт `{ item }`. Развернуть `.item`, убрать TODO.
- **A3. Новый роут «добавить товар вручную»** — создать `apps/web/app/api/shopping/lists/[listId]/items/route.ts` → `POST`, `withAuth`, Zod, вызвать `shoppingService.addManualItem`, вернуть `{ item }`. В мобилке развернуть `.item`.
- **A4. Свайп-шит — РАЗВИЛКА** (`apps/mobile/src/components/RecipeSwapSheet.tsx`):
  - **Вариант 1 (рекомендую для v1):** упростить до «причина → заменить» через существующий `replaceMeal`. Ноль нового бэкенда.
  - **Вариант 2 (богатый UX):** построить `/alternatives` + расширить replace приёмом `recipeId`. +1–2 дня, в бэклог.
- **A5. Зелёный билд** — `pnpm typecheck` (9 пакетов) + мобильные Jest-тесты.

---

## Блок B — Push-слой вместо бота (≈1–2 дня) — обязателен для отказа от бота

Цель: уведомления, которые слал бот, уходят в Expo push.

- **B1. Схема** — `packages/db/src/schema.ts` + миграция. Таблица `push_tokens` (householdId/userId, token unique, platform, timestamps). `pnpm -F @meal-planner/db generate`.
- **B2. Регистрация токена на клиенте** — `apps/mobile`: разрешение, получение Expo push-токена, `POST /api/push/register` (upsert). Обработчик тапа → нужный экран.
- **B3. Утилита отправки** — `packages/domain/src/services/notification.service.ts`: `notifyHousehold(householdId, {title, body, data})` через `expo-server-sdk`, чистка невалидных токенов. Домен без next/grammy.
- **B4. Переключить отправителей** — `plan-generate.ts`, `retention-trigger.ts` на `notifyHousehold` (убрать `getBot()`); переселить фидбек-ремайндер из `apps/bot/src/jobs/feedback-reminder.ts` в Inngest-cron (TZ Europe/Warsaw 18:00).
- **B5. Отбор кандидатов** — `plan.service.ts`: `getWeekTwoRetentionCandidates()` по наличию push-токена вместо `telegramChatId`.
- **B6. Зелёный билд** — `pnpm typecheck` + тесты + ручная проверка push.

---

## Блок C — Усыпление бота (≈1–2 часа)

Цель: бот не деплоится и не мешает, код остаётся как запасной канал.

- **C1.** Убрать `apps/bot` из `pnpm dev` / `scripts/dev-tunnel.ts`, не деплоить.
- **C2.** Снять Telegram webhook в проде (или `deleteWebhook`). Роут webhook оставить простаивать.
- **C3.** Грепом подтвердить, что в `apps/web` не осталось импортов `@meal-planner/bot` / `grammy`.
- **C4.** Код НЕ удаляем — `apps/bot`, `telegramChatId`, webhook остаются спящими.

---

## Порядок и зависимости

1. **A** (быстрая победа) ∥ **B** (без него отказ от бота = потеря уведомлений) →
2. **C** (только после B4).

## Что НЕ делаем сейчас (бэклог)

- Веб-хвосты W06/W08 — для нативного запуска не нужны.
- Богатый свайп с альтернативами (A4 Вариант 2).
- Дистрибуция (TestFlight / Play internal) — отдельный блок D, когда A+B+C зелёные.

## Критерий готовности

`pnpm typecheck` зелёный по 9 пакетам; мобильные тесты проходят; на устройстве: онбординг → генерация плана → push «готов» → подтверждение → список покупок → отметка куплено → ручное добавление товара; бот не деплоится, web без импортов грамми.
