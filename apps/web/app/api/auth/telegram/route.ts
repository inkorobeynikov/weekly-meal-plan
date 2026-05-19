import { z } from 'zod'
import { householdService } from '@meal-planner/domain'
import { AUTH_COOKIE_NAME } from '../../../../lib/auth-middleware.js'
import {
  AuthError,
  signJwt,
  verifyTelegramInitData,
} from '../../../../lib/auth.js'

const BodySchema = z.object({ initData: z.string().min(1) })

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

export async function POST(req: Request): Promise<Response> {
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'initData is required' }, { status: 400 })
  }

  let telegramUser
  try {
    telegramUser = await verifyTelegramInitData(parsed.data.initData)
  } catch (err) {
    const message = err instanceof AuthError ? err.message : 'initData verification failed'
    return Response.json({ error: 'Unauthorized', message }, { status: 401 })
  }

  const telegramChatId = String(telegramUser.id)
  let household = await householdService.getHouseholdByTelegramChatId(telegramChatId)
  if (!household) {
    const displayName =
      telegramUser.first_name + (telegramUser.last_name ? ` ${telegramUser.last_name}` : '')
    household = await householdService.createHousehold({
      name: displayName || `Telegram ${telegramUser.id}`,
      telegramChatId,
    })
  }

  const token = await signJwt(
    { householdId: household.id, telegramUserId: telegramChatId },
    '7d',
  )

  const cookie = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SEVEN_DAYS_SECONDS}`,
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')

  return Response.json(
    { token, householdId: household.id },
    { status: 200, headers: { 'Set-Cookie': cookie } },
  )
}
