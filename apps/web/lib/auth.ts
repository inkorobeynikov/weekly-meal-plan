import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

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

/**
 * Verify Telegram Mini App `initData` query string per the documented HMAC scheme.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyTelegramInitData(initData: string): Promise<TelegramUser> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new Error('initData missing hash')
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
  if (computed !== hash) throw new Error('initData hash mismatch')

  const userJson = params.get('user')
  if (!userJson) throw new Error('initData missing user')
  return JSON.parse(userJson) as TelegramUser
}

export async function signJwt(payload: JWTPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '30d'
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret())
}

export async function verifyJwt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret())
  return payload
}
