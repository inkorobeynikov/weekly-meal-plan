// Deterministic mock API server for mobile E2E (Maestro) runs.
//
// A tiny dependency-free Node http server that answers every endpoint the Expo
// app calls (see apps/mobile/src/lib/api.ts + auth.ts) with canned, typed
// fixtures — no Postgres / Inngest / OpenAI / apps/web backend involved. Runs
// identically on macOS and Windows.
//
// Scenario switching: a Maestro flow sets the active scenario up-front via the
// control endpoint `POST /__e2e/scenario { scenario }` (or the `x-e2e-scenario`
// header / `?scenario=` query on any request). A small amount of mutable runtime
// state models the real transitions a flow drives — generate → draft,
// approve → approved + shopping list, checking items, adding items.
//
// Strict, no `any`.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import {
  ALTERNATIVES,
  buildFamilyResponse,
  buildFeedback,
  buildPlanResponse,
  buildPreferences,
  buildShoppingItems,
  familyAllergiesFor,
  getRecipeById,
  PLAN_DATES,
  PLAN_ID,
  SHOPPING_LIST_ID,
  WEEK_START_DATE,
} from './fixtures';
import {
  isScenario,
  type FeedbackReaction,
  type ItemStatus,
  type PlanStatus,
  type Scenario,
  type ShoppingListItem,
} from './types';

const PORT = Number.parseInt(process.env.PORT ?? '4010', 10);

// --- mutable runtime state ---------------------------------------------------

interface RuntimeState {
  scenario: Scenario;
  authed: boolean;
  // Transition flags driven by POST actions during a flow.
  generated: boolean;
  approved: boolean;
  boughtIds: Set<string>;
  addedItems: ShoppingListItem[];
}

function baseStateFor(scenario: Scenario): RuntimeState {
  return {
    scenario,
    authed: false,
    generated: false,
    approved: false,
    boughtIds: new Set<string>(),
    addedItems: [],
  };
}

const state: RuntimeState = baseStateFor(
  (process.env.E2E_SCENARIO && isScenario(process.env.E2E_SCENARIO)
    ? process.env.E2E_SCENARIO
    : 'no-plan') as Scenario,
);

function setScenario(scenario: Scenario): void {
  // Full reset (including auth) so every Maestro flow that pins a scenario also
  // starts from a clean, logged-out backend — flow isolation by construction.
  Object.assign(state, baseStateFor(scenario));
}

// --- http helpers ------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  });
  res.end(payload);
}

function notFound(res: ServerResponse, message = 'Not found'): void {
  sendJson(res, 404, { message });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        resolve(typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// --- auth fixtures -----------------------------------------------------------

const AUTH_TOKEN = 'e2e-session-token';

function authUser() {
  return {
    id: 'user-1',
    email: 'e2e@example.com',
    name: 'E2E Tester',
    emailVerified: true,
    image: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  };
}

function authSession() {
  return {
    id: 'session-1',
    userId: 'user-1',
    token: AUTH_TOKEN,
    expiresAt: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  };
}

function sendAuthSuccess(res: ServerResponse): void {
  state.authed = true;
  const body = { token: AUTH_TOKEN, user: authUser(), redirect: false };
  res.writeHead(200, {
    'Content-Type': 'application/json',
    // The BetterAuth expo plugin reads this header to persist the session token.
    'set-auth-token': AUTH_TOKEN,
    // The cookie MUST use the default `better-auth` prefix: the expo client only
    // stores the cookie and fires its session-refresh signal when the Set-Cookie
    // matches `cookiePrefix` (default "better-auth", since auth.ts sets only
    // storagePrefix). A `mealplanner.` prefix is silently ignored → useSession()
    // never refreshes → the app falls back to the login screen after sign-in.
    'Set-Cookie': `better-auth.session_token=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'set-auth-token',
  });
  res.end(JSON.stringify(body));
}

// --- domain resolution -------------------------------------------------------

function resolvePlanStatus(): PlanStatus {
  if (state.approved) return 'approved';
  if (
    state.scenario === 'approved-plan' ||
    state.scenario === 'shopping-active' ||
    state.scenario === 'shopping-all-bought'
  ) {
    return 'approved';
  }
  return 'draft';
}

function currentPlanResponse(res: ServerResponse): void {
  if (state.scenario === 'no-plan' && !state.generated) {
    notFound(res, 'No plan yet');
    return;
  }
  const scenarioForMeals: Scenario = state.scenario === 'no-plan' ? 'draft-plan' : state.scenario;
  sendJson(res, 200, buildPlanResponse(scenarioForMeals, resolvePlanStatus()));
}

function shoppingExists(): { exists: boolean; allBought: boolean } {
  if (state.scenario === 'shopping-all-bought') return { exists: true, allBought: true };
  if (state.scenario === 'shopping-active') return { exists: true, allBought: false };
  if (state.approved) return { exists: true, allBought: false };
  return { exists: false, allBought: false };
}

function currentShoppingResponse(res: ServerResponse): void {
  const { exists, allBought } = shoppingExists();
  if (!exists) {
    sendJson(res, 200, null);
    return;
  }
  const items = buildShoppingItems(allBought).map((item) =>
    state.boughtIds.has(item.id) ? { ...item, status: 'bought' as ItemStatus } : item,
  );
  sendJson(res, 200, {
    list: {
      id: SHOPPING_LIST_ID,
      weeklyPlanId: PLAN_ID,
      status: allBought ? 'completed' : 'active',
      createdAt: '2026-06-07T19:05:00.000Z',
    },
    items: [...items, ...state.addedItems],
  });
}

// --- routing -----------------------------------------------------------------

interface Route {
  method: string;
  pattern: RegExp;
  handle: (
    req: IncomingMessage,
    res: ServerResponse,
    params: string[],
  ) => void | Promise<void>;
}

const routes: Route[] = [
  // ----- control (E2E harness only) -----
  {
    method: 'GET',
    pattern: /^\/__e2e\/health$/,
    handle: (_req, res) => sendJson(res, 200, { ok: true, scenario: state.scenario, authed: state.authed }),
  },
  {
    method: 'POST',
    pattern: /^\/__e2e\/scenario$/,
    handle: async (req, res) => {
      const body = await readJsonBody(req);
      const next = asString(body.scenario);
      if (!next || !isScenario(next)) {
        sendJson(res, 400, { message: 'Unknown scenario' });
        return;
      }
      setScenario(next);
      sendJson(res, 200, { ok: true, scenario: state.scenario });
    },
  },
  {
    method: 'POST',
    pattern: /^\/__e2e\/reset$/,
    handle: (_req, res) => {
      setScenario(state.scenario);
      state.authed = false;
      sendJson(res, 200, { ok: true, scenario: state.scenario });
    },
  },

  // ----- auth (BetterAuth expo) -----
  { method: 'POST', pattern: /^\/api\/auth\/sign-up\/email$/, handle: (_req, res) => sendAuthSuccess(res) },
  { method: 'POST', pattern: /^\/api\/auth\/sign-in\/email$/, handle: (_req, res) => sendAuthSuccess(res) },
  {
    method: 'GET',
    pattern: /^\/api\/auth\/get-session$/,
    handle: (_req, res) =>
      state.authed
        ? sendJson(res, 200, { session: authSession(), user: authUser() })
        : sendJson(res, 200, null),
  },
  {
    method: 'POST',
    pattern: /^\/api\/auth\/sign-out$/,
    handle: (_req, res) => {
      state.authed = false;
      sendJson(res, 200, { success: true });
    },
  },

  // ----- plans -----
  { method: 'GET', pattern: /^\/api\/plans\/current$/, handle: (_req, res) => currentPlanResponse(res) },
  {
    method: 'POST',
    pattern: /^\/api\/plans\/generate$/,
    handle: (_req, res) => {
      state.generated = true;
      state.approved = false;
      sendJson(res, 200, { status: 'generating', weekStartDate: WEEK_START_DATE, dayCount: PLAN_DATES.length });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/plans\/([^/]+)\/approve$/,
    handle: (_req, res) => {
      state.approved = true;
      sendJson(res, 200, {
        plan: {
          id: PLAN_ID,
          householdId: 'hh-1',
          weekStartDate: WEEK_START_DATE,
          status: 'approved',
          aiReasoningSummary: 'Plan zatwierdzony.',
          createdAt: '2026-06-07T18:00:00.000Z',
          approvedAt: '2026-06-07T19:00:00.000Z',
        },
      });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/plans\/reset$/,
    handle: (_req, res) => {
      state.generated = false;
      state.approved = false;
      sendJson(res, 200, { deletedPlans: 1 });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/plans\/([^/]+)\/meals\/([^/]+)\/alternatives$/,
    handle: (_req, res) => sendJson(res, 200, { alternatives: ALTERNATIVES }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/plans\/([^/]+)\/meals\/([^/]+)\/replace$/,
    handle: (_req, res, params) => {
      const [, mealId] = params;
      // Mirror the real route POST /api/plans/:planId/meals/:mealId/replace,
      // which returns { meal }.
      sendJson(res, 200, {
        meal: {
          id: mealId ?? 'm-lunch-0',
          weeklyPlanId: PLAN_ID,
          date: PLAN_DATES[0],
          mealType: 'lunch',
          recipeId: 'r-alt-1',
          leftoversPlanned: false,
          servings: 4,
        },
      });
    },
  },

  // ----- shopping -----
  { method: 'GET', pattern: /^\/api\/shopping\/current$/, handle: (_req, res) => currentShoppingResponse(res) },
  {
    method: 'PATCH',
    pattern: /^\/api\/shopping\/items\/([^/]+)$/,
    handle: async (req, res, params) => {
      const itemId = params[0] ?? '';
      const body = await readJsonBody(req);
      const status = (asString(body.status) ?? 'pending') as ItemStatus;
      if (status === 'bought') state.boughtIds.add(itemId);
      else state.boughtIds.delete(itemId);
      const seed =
        buildShoppingItems(false).find((it) => it.id === itemId) ??
        state.addedItems.find((it) => it.id === itemId);
      const item: ShoppingListItem = seed
        ? { ...seed, status }
        : {
            id: itemId,
            shoppingListId: SHOPPING_LIST_ID,
            name: itemId,
            normalizedName: itemId,
            category: 'Inne',
            quantity: '1',
            unit: null,
            neededByDate: null,
            buyTiming: 'main_shop',
            relatedRecipeIds: [],
            status,
            replacementText: asString(body.replacementText) ?? null,
            promoHintId: null,
          };
      // Mirror the real route PATCH /api/shopping/items/:itemId → { item }.
      sendJson(res, 200, { item });
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/shopping\/lists\/([^/]+)\/items$/,
    handle: async (req, res) => {
      const body = await readJsonBody(req);
      const name = asString(body.name) ?? 'Nowy produkt';
      const item: ShoppingListItem = {
        id: `it-new-${state.addedItems.length + 1}`,
        shoppingListId: SHOPPING_LIST_ID,
        name,
        normalizedName: name.toLowerCase(),
        category: asString(body.category) ?? 'Inne',
        quantity: asString(body.quantity) ?? '1',
        unit: asString(body.unit) ?? null,
        neededByDate: null,
        buyTiming: 'main_shop',
        relatedRecipeIds: [],
        status: 'pending',
        replacementText: null,
        promoHintId: null,
      };
      state.addedItems.push(item);
      // Mirror the real route POST /api/shopping/lists/:listId/items → { item }.
      sendJson(res, 200, { item });
    },
  },

  // ----- family -----
  { method: 'GET', pattern: /^\/api\/family$/, handle: (_req, res) => sendJson(res, 200, buildFamilyResponse(state.scenario)) },
  {
    method: 'PATCH',
    pattern: /^\/api\/family$/,
    handle: async (req, res) => {
      const body = await readJsonBody(req);
      const allergies = Array.isArray(body.allergies)
        ? body.allergies.filter((a): a is string => typeof a === 'string')
        : familyAllergiesFor(state.scenario);
      sendJson(res, 200, { preferences: { ...buildPreferences(allergies) } });
    },
  },

  // ----- recipes -----
  {
    method: 'GET',
    pattern: /^\/api\/recipes\/([^/]+)$/,
    handle: (_req, res, params) => {
      const recipe = getRecipeById(params[0] ?? '');
      if (!recipe) {
        notFound(res, 'Recipe not found');
        return;
      }
      sendJson(res, 200, { recipe });
    },
  },

  // ----- feedback -----
  {
    method: 'POST',
    pattern: /^\/api\/feedback$/,
    handle: async (req, res) => {
      const body = await readJsonBody(req);
      const recipeId = asString(body.recipeId) ?? 'r-lunch-0';
      const reaction = (asString(body.reaction) ?? 'liked') as FeedbackReaction;
      const weeklyPlanId = asString(body.weeklyPlanId) ?? null;
      const freeText = asString(body.freeText) ?? null;
      sendJson(res, 200, { feedback: buildFeedback(recipeId, reaction, weeklyPlanId, freeText) });
    },
  },
];

// --- server ------------------------------------------------------------------

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    });
    res.end();
    return;
  }

  // Per-request scenario override (header takes precedence over query).
  const headerScenario = req.headers['x-e2e-scenario'];
  const queryScenario = url.searchParams.get('scenario');
  const override = (Array.isArray(headerScenario) ? headerScenario[0] : headerScenario) ?? queryScenario;
  if (typeof override === 'string' && isScenario(override) && override !== state.scenario) {
    setScenario(override);
  }

  const path = url.pathname;
  // Request log — helps debug the app↔mock auth handshake during E2E bring-up.
  // eslint-disable-next-line no-console
  console.log(`[e2e-mock] ${method} ${path} (authed=${state.authed} scenario=${state.scenario})`);
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (!match) continue;
    void Promise.resolve(route.handle(req, res, match.slice(1))).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { message: 'Mock server error' });
    });
    return;
  }

  notFound(res, `No mock handler for ${method} ${path}`);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[e2e-mock] listening on http://0.0.0.0:${PORT} (scenario: ${state.scenario})`);
});
