import { InlineKeyboard } from 'grammy'
import { householdService, planService, shoppingService } from '@meal-planner/domain'
import type { BotContext } from '../session.js'

type ShoppingListWithItems = NonNullable<
  Awaited<ReturnType<typeof shoppingService.getShoppingList>>
>
type ShoppingListItem = ShoppingListWithItems['items'][number]

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[\]])/g, '\\$1')
}

function formatList(items: ShoppingListItem[]): string {
  const byCategory = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const cat = item.category || 'Inne'
    const arr = byCategory.get(cat) ?? []
    arr.push(item)
    byCategory.set(cat, arr)
  }

  const lines: string[] = ['*🛒 Lista zakupów*', '']
  for (const [category, list] of byCategory) {
    lines.push(`*${escapeMarkdown(category)}*`)
    for (const item of list) {
      const unit = item.unit ? ` ${item.unit}` : ''
      const check = item.status === 'bought' ? '✅' : '•'
      lines.push(`${check} ${escapeMarkdown(item.name)} — ${item.quantity}${unit}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export async function handleShopping(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const household = await householdService.getHouseholdByTelegramChatId(String(chatId))
  if (!household) {
    await ctx.reply('Najpierw skonfiguruj rodzinę przez /start.')
    return
  }

  const plan = await planService.getCurrentApprovedPlan(household.id)
  if (!plan) {
    await ctx.reply('Brak listy zakupów. Zatwierdź plan, aby wygenerować listę.')
    return
  }

  const list = await shoppingService.getShoppingList(plan.id)
  if (!list || list.items.length === 0) {
    await ctx.reply('Brak listy zakupów. Zatwierdź plan, aby wygenerować listę.')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const keyboard = appUrl
    ? new InlineKeyboard().url('Otwórz listę w aplikacji', `${appUrl}/shopping`)
    : undefined

  await ctx.reply(formatList(list.items), {
    parse_mode: 'Markdown',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  })
}
