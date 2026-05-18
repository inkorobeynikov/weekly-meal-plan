import { db, analyticsEvents } from '@meal-planner/db'

export async function trackEvent(
  householdId: string | null,
  memberId: string | null,
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  // TODO: route to a real analytics sink (PostHog/etc) in addition to the DB log
  await db.insert(analyticsEvents).values({
    householdId,
    memberId,
    eventName,
    propertiesJson: properties,
  })
}
