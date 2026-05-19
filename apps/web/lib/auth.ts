import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface TelegramInitUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

function getBotToken(): string {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN must be set')
  return token
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength)
  new Uint8Array(out).set(view)
  return out
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const rawKey: ArrayBuffer = key instanceof Uint8Array ? toArrayBuffer(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(new TextEncoder().encode(data)))
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verify Telegram Mini App `initData` query string per the documented HMAC scheme.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyTelegramInitData(initData: string): Promise<TelegramInitUser> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new AuthError('initData missing hash')
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = await hmacSha256(
    new TextEncoder().encode('WebAppData'),
    getBotToken(),
  )
  const computed = toHex(await hmacSha256(secretKey, dataCheckString))
  if (!timingSafeEqualHex(computed, hash)) {
    throw new AuthError('initData hash mismatch')
  }

  const authDateStr = params.get('auth_date')
  if (!authDateStr) throw new AuthError('initData missing auth_date')
  const authDate = Number(authDateStr)
  if (!Number.isFinite(authDate)) throw new AuthError('initData has invalid auth_date')
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new AuthError('initData expired')
  }

  const userJson = params.get('user')
  if (!userJson) throw new AuthError('initData missing user')
  try {
    return JSON.parse(userJson) as TelegramInitUser
  } catch {
    throw new AuthError('initData user payload is not valid JSON')
  }
}

export async function signJwt(payload: JWTPayload, expiresIn: string = '7d'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret())
}

export async function verifyJwt(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : 'Invalid token')
  }
}
