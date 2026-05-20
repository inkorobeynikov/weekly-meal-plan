import { db, analyticsEvents } from '@meal-planner/db'

// Fire-and-forget: analytics must NEVER break the main flow. Any failure is
// swallowed (logged only) so callers can `await` without risk.
export async function trackEvent(
  householdId: string | null,
  memberId: string | null,
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({
      householdId,
      memberId,
      eventName,
      propertiesJson: properties,
    })
  } catch (err) {
    console.error(`[analytics] failed to track "${eventName}":`, err)
  }
}
