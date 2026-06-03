import { inArray } from 'drizzle-orm'
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { db, pushTokens, eq } from '@meal-planner/db'

// Push is the notification channel that replaces the (now dormant) Telegram bot.
// This service is the single place that talks to Expo's push API. It must NOT
// import next or grammy (CLAUDE.md architecture rule).

export interface NotificationPayload {
  title: string
  body: string
  // Arbitrary client-routing hints (e.g. { screen: 'plan', planId }). The mobile
  // notification-response handler reads these to deep-link the tap.
  data?: Record<string, unknown>
}

export interface NotifyResult {
  // How many push messages Expo accepted (one per device token).
  sent: number
  // Tokens removed because the device unregistered (Expo: DeviceNotRegistered).
  pruned: number
}

// A single Expo client. EXPO_ACCESS_TOKEN is optional (only required once the
// project enforces push security); when unset the SDK still works for dev.
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN
    ? { accessToken: process.env.EXPO_ACCESS_TOKEN }
    : undefined,
)

/**
 * Send a push notification to every registered device of a household.
 *
 * Loads the household's push tokens, sends the message in Expo-sized chunks, and
 * prunes any token Expo reports as DeviceNotRegistered so we stop wasting sends
 * on uninstalled apps. Returns counts for logging/analytics.
 */
export async function notifyHousehold(
  householdId: string,
  payload: NotificationPayload,
): Promise<NotifyResult> {
  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.householdId, householdId))

  // Keep only well-formed Expo tokens; a malformed token would reject the whole
  // chunk. Order is preserved so ticket[i] maps back to validTokens[i].
  const validTokens = rows
    .map((r) => r.token)
    .filter((token): token is string => Expo.isExpoPushToken(token))

  if (validTokens.length === 0) {
    return { sent: 0, pruned: 0 }
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    ...(payload.data ? { data: payload.data } : {}),
  }))

  const chunks = expo.chunkPushNotifications(messages)
  const tokensToPrune: string[] = []
  let sent = 0
  // chunkPushNotifications preserves order, so concatenating chunks yields the
  // original message (and token) order — track our position with chunkStart.
  let chunkStart = 0

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[] = []
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk)
    } catch {
      // A whole-chunk transport failure: skip it, keep tokens, move on.
      chunkStart += chunk.length
      continue
    }

    tickets.forEach((ticket, i) => {
      const token = validTokens[chunkStart + i]
      if (ticket.status === 'ok') {
        sent += 1
      } else if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered' &&
        token
      ) {
        tokensToPrune.push(token)
      }
    })
    chunkStart += chunk.length
  }

  if (tokensToPrune.length > 0) {
    await db.delete(pushTokens).where(inArray(pushTokens.token, tokensToPrune))
  }

  return { sent, pruned: tokensToPrune.length }
}
