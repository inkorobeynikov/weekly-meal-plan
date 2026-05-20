import { eq, inArray } from 'drizzle-orm'
import {
  db,
  shoppingLists,
  shoppingListItems,
  weeklyPlans,
  plannedMeals,
  recipes,
  type ShoppingList,
  type ShoppingListItem,
  type NewShoppingListItem,
  type Recipe,
  type PlannedMeal,
} from '@meal-planner/db'
import type { BuyTiming, Ingredient, ItemStatus } from '@meal-planner/shared'
import * as analyticsService from './analytics.service.js'

export interface ShoppingListWithItems {
  list: ShoppingList
  items: ShoppingListItem[]
}

// ----- normalization helpers -----

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeName(name: string): string {
  return stripDiacritics(name.trim().toLowerCase()).replace(/\s+/g, ' ')
}

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return ''
  const u = stripDiacritics(unit.trim().toLowerCase()).replace(/\.$/, '')
  // Polish unit aliases → canonical
  const map: Record<string, string> = {
    g: 'g',
    gram: 'g',
    gramow: 'g',
    gramy: 'g',
    kg: 'kg',
    kilogram: 'kg',
    kilogramy: 'kg',
    ml: 'ml',
    mililitr: 'ml',
    mililitry: 'ml',
    l: 'l',
    litr: 'l',
    litry: 'l',
    szt: 'szt',
    sztuka: 'szt',
    sztuki: 'szt',
    sztuk: 'szt',
    pcs: 'szt',
    op: 'op',
    opakowanie: 'op',
    opakowan: 'op',
    lyzka: 'lyzka',
    lyzki: 'lyzka',
    tbsp: 'lyzka',
    lyzeczka: 'lyzeczka',
    lyzeczki: 'lyzeczka',
    tsp: 'lyzeczka',
    szczypta: 'szczypta',
    pek: 'pek', // pęczek
    peczek: 'pek',
    zabek: 'zabek', // ząbek
    zabki: 'zabek',
    pierscien: 'szt',
    plaster: 'szt',
    plastry: 'szt',
  }
  return map[u] ?? u
}

// Conversion to a canonical base unit when possible (for aggregation).
// Returns null if the unit doesn't belong to a known dimensional family.
type Dimensional = { base: 'g' | 'ml' | 'szt'; factor: number }

function toBase(unit: string): Dimensional | null {
  const u = normalizeUnit(unit)
  switch (u) {
    case 'g':
      return { base: 'g', factor: 1 }
    case 'kg':
      return { base: 'g', factor: 1000 }
    case 'ml':
      return { base: 'ml', factor: 1 }
    case 'l':
      return { base: 'ml', factor: 1000 }
    case 'szt':
    case 'op':
      return { base: 'szt', factor: 1 }
    default:
      return null
  }
}

// Render an aggregated quantity in a friendly unit (kg/l when large).
function formatQuantity(totalInBase: number, base: Dimensional['base']): {
  quantity: string
  unit: string
} {
  if (base === 'g') {
    if (totalInBase >= 1000) {
      const kg = totalInBase / 1000
      return { quantity: trimNumber(kg), unit: 'kg' }
    }
    return { quantity: trimNumber(totalInBase), unit: 'g' }
  }
  if (base === 'ml') {
    if (totalInBase >= 1000) {
      const l = totalInBase / 1000
      return { quantity: trimNumber(l), unit: 'l' }
    }
    return { quantity: trimNumber(totalInBase), unit: 'ml' }
  }
  return { quantity: trimNumber(totalInBase), unit: 'szt' }
}

function trimNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

// ----- categorization -----

const CATEGORY_KEYWORDS: ReadonlyArray<{ category: string; keywords: readonly string[] }> = [
  {
    category: 'Warzywa i owoce',
    keywords: [
      'pomidor', 'ogorek', 'cebul', 'czosn', 'marchew', 'pietruszk', 'seler', 'por',
      'ziemniak', 'kartofl', 'kapust', 'salat', 'salata', 'salaty', 'roszponk',
      'rukol', 'szpinak', 'jarmuz', 'brokul', 'kalafior', 'cukini', 'bakla',
      'paprык', 'papryk', 'dynia', 'burak', 'rzodkiew', 'kalarepa', 'koper',
      'szczypior', 'piecz', 'pieczark', 'grzyb', 'bocznia', 'shiitake',
      'jablk', 'grusz', 'banan', 'pomarancz', 'cytryn', 'limon', 'winogron',
      'truskaw', 'malin', 'borowk', 'jagod', 'arbuz', 'melon', 'mango', 'awokado',
      'kiwi', 'sliw', 'wisni', 'czeresn', 'brzoskwin', 'morel', 'ananas', 'granat',
      'imbir', 'chili', 'natk',
    ],
  },
  {
    category: 'Mięso i ryby',
    keywords: [
      'kurczak', 'kurcz', 'wolow', 'wołow', 'wieprz', 'schab', 'karkowk', 'szynk',
      'kielbas', 'kielb', 'parow', 'salami', 'boczek', 'pasztet', 'mielon',
      'indyk', 'kacz', 'gęs', 'ges', 'kroli', 'jagniec', 'baranin', 'cieleci',
      'losos', 'tunczyk', 'tunc', 'dorsz', 'mintaj', 'pstrag', 'sledz', 'makrel',
      'krewet', 'ryb', 'filet', 'rosol', 'wedlin', 'wedzon',
    ],
  },
  {
    category: 'Nabiał i jaja',
    keywords: [
      'mlek', 'smietan', 'śmietan', 'jogurt', 'kefir', 'maslank', 'maślank',
      'ser ', 'serek', 'twarog', 'twaróg', 'mozzarell', 'feta', 'parmez',
      'cheddar', 'gouda', 'camembert', 'brie', 'mascarpone', 'ricott',
      'masl', 'masło', 'jaj', 'jajk', 'jajko', 'jajka', 'budyn',
    ],
  },
  {
    category: 'Pieczywo i makarony',
    keywords: [
      'chleb', 'bulk', 'bulka', 'bagiet', 'tortill', 'pita', 'lavash',
      'makaron', 'spaghetti', 'penne', 'fusilli', 'tagliatell', 'lasagn',
      'ryz', 'ryż', 'kasz', 'kasza', 'plat', 'platki', 'platki owsiane', 'owsian',
      'maka', 'mąk', 'kuskus', 'bulgur', 'komosa', 'quinoa', 'noodl', 'kluski',
      'pierogi', 'naleski', 'placki', 'sucharki', 'krakers',
    ],
  },
  {
    category: 'Oleje i przyprawy',
    keywords: [
      'olej', 'oliw', 'ocet', 'sol', 'sól', 'pieprz', 'cukier', 'wanili',
      'cynamon', 'kurkuma', 'kmin', 'kolendr', 'oregano', 'bazyli', 'tymianek',
      'rozmaryn', 'majeranek', 'papryka mielona', 'papryka slodka', 'curry',
      'gałka', 'galka', 'liscie laurow', 'lisc laurow', 'lauro', 'goździ', 'gozdz',
      'kardamon', 'anyż', 'szafran', 'sezam', 'mak', 'drozdz', 'drożdż',
      'soda', 'proszek do pieczenia', 'aromat', 'syrop', 'miod', 'miód',
    ],
  },
  {
    category: 'Konserwy i sosy',
    keywords: [
      'ketchup', 'majonez', 'musztard', 'sos', 'passat', 'pomidory kroj',
      'pomidory z puszki', 'puszka', 'koncentrat', 'fasol', 'ciecierzyc',
      'soczewic', 'kukurydz', 'tunczyk w puszc', 'oliwk', 'kapar', 'pesto',
      'tahini', 'humm', 'salsa', 'czatni', 'worcester', 'soja', 'sojowy',
    ],
  },
  {
    category: 'Mrożonki',
    keywords: [
      'mrozon', 'mrożon', 'mieszanka warzyw', 'frytki', 'lod', 'pierogi mrozone',
      'pizza mrozona',
    ],
  },
]

function categorize(name: string): string {
  const n = stripDiacritics(name.toLowerCase())
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (n.includes(stripDiacritics(kw.toLowerCase()))) return category
    }
  }
  return 'Inne'
}

// ----- aggregation -----

interface RawIngredientUsage {
  rawName: string
  normalizedName: string
  unitRaw: string
  scaledQuantity: number
  recipeId: string
  neededByDate: string // ISO YYYY-MM-DD
}

interface AggregatedItem {
  displayName: string
  normalizedName: string
  unitRaw: string // canonical unit string for storage
  quantityText: string
  category: string
  neededByDate: string
  buyTiming: BuyTiming
  relatedRecipeIds: string[]
}

function aggregate(usages: RawIngredientUsage[]): AggregatedItem[] {
  // Bucket by (normalizedName + dimensional base | raw unit fallback)
  type Bucket = {
    displayName: string
    normalizedName: string
    base: Dimensional['base'] | null
    rawUnit: string // when not dimensional
    totalBase: number
    nonBaseQuantity: number // sum when not dimensional; quantity stays as number
    recipeIds: Set<string>
    earliestDate: string
  }
  const buckets = new Map<string, Bucket>()

  for (const u of usages) {
    const dim = toBase(u.unitRaw)
    const key = dim
      ? `${u.normalizedName}|base:${dim.base}`
      : `${u.normalizedName}|unit:${normalizeUnit(u.unitRaw)}`
    let b = buckets.get(key)
    if (!b) {
      b = {
        displayName: u.rawName.trim(),
        normalizedName: u.normalizedName,
        base: dim ? dim.base : null,
        rawUnit: dim ? '' : normalizeUnit(u.unitRaw),
        totalBase: 0,
        nonBaseQuantity: 0,
        recipeIds: new Set(),
        earliestDate: u.neededByDate,
      }
      buckets.set(key, b)
    }
    if (dim) {
      b.totalBase += u.scaledQuantity * dim.factor
    } else {
      b.nonBaseQuantity += u.scaledQuantity
    }
    b.recipeIds.add(u.recipeId)
    if (u.neededByDate < b.earliestDate) b.earliestDate = u.neededByDate
  }

  const items: AggregatedItem[] = []
  for (const b of buckets.values()) {
    let unit: string
    let quantity: string
    if (b.base) {
      const fmt = formatQuantity(b.totalBase, b.base)
      quantity = fmt.quantity
      unit = fmt.unit
    } else {
      quantity = trimNumber(b.nonBaseQuantity)
      unit = b.rawUnit
    }
    const category = categorize(b.displayName)
    const buyTiming: BuyTiming = isMidWeek(b.earliestDate) ? 'later' : 'main_shop'
    items.push({
      displayName: b.displayName,
      normalizedName: b.normalizedName,
      unitRaw: unit,
      quantityText: quantity,
      category,
      neededByDate: b.earliestDate,
      buyTiming,
      relatedRecipeIds: [...b.recipeIds],
    })
  }
  return items
}

// Wednesday (or later) midweek heuristic relative to the plan week.
// dayOfWeek: 0 Sunday, 1 Monday, ... 3 Wednesday
function isMidWeek(isoDate: string): boolean {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const dow = d.getUTCDay()
  // Monday=1, Tuesday=2: main shop. Wed/Thu/Fri/Sat/Sun: later.
  return dow === 0 || dow >= 4
}

// ----- main entry -----

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

  // Idempotency: return existing list if already generated.
  const existing = await getShoppingList(planId)
  if (existing) return existing

  // Pull all meals + their recipes.
  const meals: PlannedMeal[] = await db
    .select()
    .from(plannedMeals)
    .where(eq(plannedMeals.weeklyPlanId, planId))

  if (meals.length === 0) {
    // Create an empty list to mark the plan as processed.
    const [listRow] = await db
      .insert(shoppingLists)
      .values({ weeklyPlanId: planId, status: 'active' })
      .returning()
    if (!listRow) throw new Error('Failed to insert empty shopping_lists row')
    await analyticsService.trackEvent(plan.householdId, null, 'shopping_list_generated', {
      planId,
      itemCount: 0,
    })
    return { list: listRow, items: [] }
  }

  const recipeIds = [...new Set(meals.map((m) => m.recipeId))]
  const recipeRows: Recipe[] = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, recipeIds))
  const recipeMap = new Map(recipeRows.map((r) => [r.id, r]))

  const usages: RawIngredientUsage[] = []
  for (const meal of meals) {
    const recipe = recipeMap.get(meal.recipeId)
    if (!recipe) continue
    const recipeServings = recipe.servings > 0 ? recipe.servings : 1
    const scaleFactor = meal.servings / recipeServings
    const mealDate = String(meal.date)
    for (const ing of recipe.ingredientsJson as Ingredient[]) {
      const name = ing.name?.trim() ?? ''
      if (!name) continue
      const quantity = Number.isFinite(ing.quantity) ? ing.quantity : 0
      usages.push({
        rawName: name,
        normalizedName: normalizeName(name),
        unitRaw: ing.unit ?? '',
        scaledQuantity: quantity * scaleFactor,
        recipeId: recipe.id,
        neededByDate: mealDate,
      })
    }
  }

  const aggregated = aggregate(usages)

  // Persist list + items in a single transaction.
  const result = await db.transaction(async (tx) => {
    const [listRow] = await tx
      .insert(shoppingLists)
      .values({ weeklyPlanId: planId, status: 'active' })
      .returning()
    if (!listRow) throw new Error('Failed to insert shopping_lists row')

    if (aggregated.length === 0) {
      return { list: listRow, items: [] as ShoppingListItem[] }
    }

    const itemValues: NewShoppingListItem[] = aggregated.map((a) => ({
      shoppingListId: listRow.id,
      name: a.displayName,
      normalizedName: a.normalizedName,
      category: a.category,
      quantity: a.quantityText,
      unit: a.unitRaw || null,
      neededByDate: a.neededByDate,
      buyTiming: a.buyTiming,
      relatedRecipeIds: a.relatedRecipeIds,
      status: 'pending' satisfies ItemStatus,
    }))

    const inserted = await tx.insert(shoppingListItems).values(itemValues).returning()
    return { list: listRow, items: inserted }
  })

  await analyticsService.trackEvent(plan.householdId, null, 'shopping_list_generated', {
    planId,
    itemCount: result.items.length,
  })

  return result
}

export async function getShoppingList(
  planId: string,
): Promise<ShoppingListWithItems | null> {
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
  const [row] = await db
    .update(shoppingListItems)
    .set({ status, replacementText: replacementText ?? null })
    .where(eq(shoppingListItems.id, itemId))
    .returning()
  if (!row) throw new Error(`Item ${itemId} not found`)
  return row
}

export async function addManualItem(input: NewShoppingListItem): Promise<ShoppingListItem> {
  const [row] = await db.insert(shoppingListItems).values(input).returning()
  if (!row) throw new Error('Failed to add item')
  return row
}
