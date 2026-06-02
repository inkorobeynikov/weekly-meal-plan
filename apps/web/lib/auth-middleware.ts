import type { JWTPayload } from 'jose'
import { db, households, authHouseholdLink, eq } from '@meal-planner/db'
import { AuthError, verifyJwt } from './auth.js'
import { auth } from './auth-server.js'

const USER_SYMBOL = Symbol.for('@meal-planner/web/auth-user')
const COOKIE_NAME = 'mp_token'

type AuthedRequest = Request & { [USER_SYMBOL]?: JWTPayload }

export interface AuthedHandlerContext {
  user: JWTPayload
}

export type AuthedHandler<TCtx = unknown> = (
  req: Request,
  ctx: TCtx & AuthedHandlerContext,
) => Promise<Response> | Response

function readBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

function readCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName === COOKIE_NAME && rest.length > 0) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

function extractToken(req: Request): string | null {
  return readBearerToken(req) ?? readCookieToken(req)
}

function unauthorized(message: string): Response {
  return Response.json({ error: 'Unauthorized', message }, { status: 401 })
}

/**
 * Resolve a household id for a BetterAuth user, creating one lazily the first
 * time the user authenticates via BetterAuth.
 *
 * A freshly-created household has NO preferences yet, which means its allergies
 * and hardRestrictions are empty — HARD CONSTRAINTS are never violated by an
 * empty set, so lazy creation is safe.
 */
async function resolveHouseholdIdForBetterAuthUser(
  userId: string,
  userName: string | null | undefined,
): Promise<string> {
  const existing = await db
    .select({ householdId: authHouseholdLink.householdId })
    .from(authHouseholdLink)
    .where(eq(authHouseholdLink.userId, userId))
    .limit(1)

  const linked = existing[0]
  if (linked) return linked.householdId

  const name = userName && userName.trim().length > 0 ? userName.trim() : 'Moja rodzina'

  const insertedHousehold = await db
    .insert(households)
    .values({ name })
    .returning({ id: households.id })

  const household = insertedHousehold[0]
  if (!household) {
    throw new AuthError('Failed to create household for BetterAuth user')
  }

  await db
    .insert(authHouseholdLink)
    .values({ userId, householdId: household.id })
    .onConflictDoNothing()

  // Re-read in case a concurrent request created the link first.
  const afterInsert = await db
    .select({ householdId: authHouseholdLink.householdId })
    .from(authHouseholdLink)
    .where(eq(authHouseholdLink.userId, userId))
    .limit(1)

  return afterInsert[0]?.householdId ?? household.id
}

/**
 * Resolve the authenticated principal from EITHER the existing Telegram-JWT path
 * OR a BetterAuth session. The JWT path is tried first and is completely
 * unchanged, so existing clients (mini app + bot) behave exactly as before.
 *
 * Returns a `JWTPayload`-shaped object so existing routes — which only read
 * `user.householdId` (string) and occasionally `user.sub` — keep working
 * regardless of which path authenticated the request.
 */
async function authenticate(req: Request): Promise<JWTPayload | null> {
  // 1) Existing Telegram JWT path — unchanged behavior for existing clients.
  const token = extractToken(req)
  if (token) {
    try {
      return await verifyJwt(token)
    } catch {
      // Fall through to BetterAuth — a stale/foreign token shouldn't block the
      // second auth path. If neither succeeds, the caller returns 401.
    }
  }

  // 2) BetterAuth session fallback (cookie or Bearer via the bearer() plugin).
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) return null

  const householdId = await resolveHouseholdIdForBetterAuthUser(
    session.user.id,
    session.user.name,
  )

  const payload: JWTPayload = {
    sub: session.user.id,
    householdId,
  }
  return payload
}

export function withAuth<TCtx = unknown>(
  handler: AuthedHandler<TCtx>,
): (req: Request, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    let payload: JWTPayload | null
    try {
      payload = await authenticate(req)
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Invalid token'
      return unauthorized(message)
    }

    if (!payload) return unauthorized('Missing authentication token')

    ;(req as AuthedRequest)[USER_SYMBOL] = payload
    const merged = { ...(ctx ?? ({} as TCtx)), user: payload } as TCtx & AuthedHandlerContext
    return handler(req, merged)
  }
}

export function getCurrentUser(req: Request): JWTPayload | null {
  return (req as AuthedRequest)[USER_SYMBOL] ?? null
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
