import type { JWTPayload } from 'jose'
import { AuthError, verifyJwt } from './auth.js'

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

export function withAuth<TCtx = unknown>(
  handler: AuthedHandler<TCtx>,
): (req: Request, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    const token = extractToken(req)
    if (!token) return unauthorized('Missing authentication token')

    let payload: JWTPayload
    try {
      payload = await verifyJwt(token)
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Invalid token'
      return unauthorized(message)
    }

    ;(req as AuthedRequest)[USER_SYMBOL] = payload
    const merged = { ...(ctx ?? ({} as TCtx)), user: payload } as TCtx & AuthedHandlerContext
    return handler(req, merged)
  }
}

export function getCurrentUser(req: Request): JWTPayload | null {
  return (req as AuthedRequest)[USER_SYMBOL] ?? null
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
