import { and, eq, gte, isNull, or, sql } from 'drizzle-orm'
import {
  db,
  promotionFacts,
  type NewPromotionFact,
  type PromotionFact,
  type ShoppingListItem,
} from '@meal-planner/db'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Two normalized names match when one is a substring of the other.
// This mirrors the bidirectional ILIKE the SQL query would do, but in memory
// so we only hit the DB once instead of once per shopping list item.
function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

/**
 * For each shopping list item, find currently-active promotions whose
 * normalized product name overlaps the item's normalized name.
 *
 * Active = endDate is in the future (>= today) or has no end date.
 * Returns a map of itemId → matching promotion facts (only items with at
 * least one match are present in the map).
 */
export async function matchPromos(
  items: ShoppingListItem[],
): Promise<Map<string, PromotionFact[]>> {
  const result = new Map<string, PromotionFact[]>()
  if (items.length === 0) return result

  const today = todayIso()
  const activePromos: PromotionFact[] = await db
    .select()
    .from(promotionFacts)
    .where(or(isNull(promotionFacts.endDate), gte(promotionFacts.endDate, today)))

  if (activePromos.length === 0) return result

  for (const item of items) {
    const matches = activePromos.filter((promo) =>
      namesMatch(item.normalizedName, promo.normalizedProductName),
    )
    if (matches.length > 0) result.set(item.id, matches)
  }

  return result
}

/**
 * Manual upsert keyed on (retailer, normalizedProductName, startDate). The
 * table has no unique constraint on those columns, so we look up an existing
 * row and update it, otherwise insert. Used by the CSV importer.
 */
export async function upsertPromotionFact(
  fact: NewPromotionFact,
): Promise<'inserted' | 'updated'> {
  const startCond =
    fact.startDate == null
      ? isNull(promotionFacts.startDate)
      : eq(promotionFacts.startDate, fact.startDate)

  const [existing] = await db
    .select({ id: promotionFacts.id })
    .from(promotionFacts)
    .where(
      and(
        eq(promotionFacts.retailer, fact.retailer),
        eq(promotionFacts.normalizedProductName, fact.normalizedProductName),
        startCond,
      ),
    )
    .limit(1)

  if (existing) {
    await db.update(promotionFacts).set(fact).where(eq(promotionFacts.id, existing.id))
    return 'updated'
  }
  await db.insert(promotionFacts).values(fact)
  return 'inserted'
}

// Kept for callers that prefer DB-side filtering for a single item.
export async function matchPromosForName(
  normalizedName: string,
): Promise<PromotionFact[]> {
  if (!normalizedName) return []
  const today = todayIso()
  const pattern = `%${normalizedName}%`
  return db
    .select()
    .from(promotionFacts)
    .where(
      and(
        or(
          sql`${promotionFacts.normalizedProductName} ILIKE ${pattern}`,
          sql`${normalizedName} ILIKE '%' || ${promotionFacts.normalizedProductName} || '%'`,
        ),
        or(isNull(promotionFacts.endDate), gte(promotionFacts.endDate, today)),
      ),
    )
}
