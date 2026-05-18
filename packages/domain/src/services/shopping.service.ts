import { eq } from 'drizzle-orm'
import {
  db,
  shoppingLists,
  shoppingListItems,
  weeklyPlans,
  type ShoppingList,
  type ShoppingListItem,
  type NewShoppingListItem,
} from '@meal-planner/db'
import type { ItemStatus } from '@meal-planner/shared'

export interface ShoppingListWithItems {
  list: ShoppingList
  items: ShoppingListItem[]
}

export async function generateShoppingList(planId: string): Promise<ShoppingListWithItems> {
  // INVARIANT: shopping list is only generated after the plan is approved.
  const [plan] = await db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, planId))
    .limit(1)
  if (!plan) throw new Error(`Plan ${planId} not found`)
  if (plan.status !== 'approved') {
    throw new Error('Shopping list can only be generated after the plan is approved')
  }
  // TODO: aggregate ingredients from planned_meals -> recipes,
  //       normalize names/units, categorize, persist.
  throw new Error('Not implemented: generateShoppingList')
}

export async function getShoppingList(
  planId: string,
): Promise<ShoppingListWithItems | null> {
  // TODO
  const [list] = await db
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.weeklyPlanId, planId))
    .limit(1)
  if (!list) return null
  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, list.id))
  return { list, items }
}

export async function updateItemStatus(
  itemId: string,
  status: ItemStatus,
  replacementText?: string,
): Promise<ShoppingListItem> {
  // TODO
  const [row] = await db
    .update(shoppingListItems)
    .set({ status, replacementText: replacementText ?? null })
    .where(eq(shoppingListItems.id, itemId))
    .returning()
  if (!row) throw new Error(`Item ${itemId} not found`)
  return row
}

export async function addManualItem(input: NewShoppingListItem): Promise<ShoppingListItem> {
  // TODO
  const [row] = await db.insert(shoppingListItems).values(input).returning()
  if (!row) throw new Error('Failed to add item')
  return row
}
