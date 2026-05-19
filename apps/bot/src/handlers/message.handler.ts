import { InlineKeyboard } from 'grammy'
import { householdService } from '@meal-planner/domain'
import type { BudgetMode } from '@meal-planner/shared'

type ChildAgeGroup = 'child_0_3' | 'child_4_7' | 'child_8_12' | 'teen'
import type { BotContext } from '../session.js'

const NEGATIVE_ANSWERS = ['nie', 'no', 'brak', 'nic', 'żadne', 'zadne']

function parseCommaList(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function isNegative(input: string): boolean {
  return NEGATIVE_ANSWERS.includes(input.trim().toLowerCase())
}

function ageToGroup(age: number): ChildAgeGroup {
  if (age <= 3) return 'child_0_3'
  if (age <= 7) return 'child_4_7'
  if (age <= 12) return 'child_8_12'
  return 'teen'
}

function parseChildAges(input: string): number[] {
  return input
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 25)
}

function parseBudgetMode(input: string): BudgetMode | null {
  const v = input.trim().toLowerCase()
  if (v.startsWith('ekon')) return 'economical'
  if (v.startsWith('norm')) return 'normal'
  if (v.startsWith('elast') || v.startsWith('flex')) return 'flexible'
  return null
}

async function completeOnboarding(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return
  const profile = ctx.session.pendingProfile

  const household = await householdService.createHousehold({
    name: profile.householdName ?? 'Moja rodzina',
    telegramChatId: String(chatId),
  })

  const adults = profile.adults ?? 1
  for (let i = 0; i < adults; i++) {
    await householdService.addMember({
      householdId: household.id,
      displayName: i === 0 ? 'Rodzic' : `Dorosły ${i + 1}`,
      role: i === 0 ? 'planning_parent' : 'adult',
      approximateAgeGroup: 'adult',
    })
  }

  const children = profile.children ?? []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child) continue
    await householdService.addMember({
      householdId: household.id,
      displayName: `Dziecko ${i + 1}`,
      role: 'child',
      approximateAgeGroup: child.ageGroup,
    })
  }

  await householdService.upsertPreferences({
    householdId: household.id,
    likes: profile.likes ?? [],
    dislikes: profile.dislikes ?? [],
    allergies: profile.allergies ?? [],
    hardRestrictions: profile.hardRestrictions ?? [],
    preferredCuisines: profile.preferredCuisines ?? [],
    cookingTimeWeekdayMinutes: profile.cookingTimeWeekdayMinutes ?? 45,
    budgetMode: profile.budgetMode ?? 'normal',
    stores: profile.stores ?? [],
  })

  ctx.session.householdId = household.id
  ctx.session.step = 'complete'

  const summary = [
    `*Świetnie!* Zapisałem profil rodziny *${household.name}*.`,
    '',
    `👨‍👩‍👧 Dorośli: ${adults}`,
    `🧒 Dzieci: ${children.length}`,
    `🚫 Alergie: ${(profile.allergies ?? []).join(', ') || 'brak'}`,
    `⛔ Ograniczenia: ${(profile.hardRestrictions ?? []).join(', ') || 'brak'}`,
    `❤️ Lubicie: ${(profile.likes ?? []).join(', ') || '—'}`,
    `⏱️ Czas gotowania: ${profile.cookingTimeWeekdayMinutes ?? 45} min`,
    `💰 Budżet: ${profile.budgetMode ?? 'normal'}`,
    `🛒 Sklepy: ${(profile.stores ?? []).join(', ') || '—'}`,
  ].join('\n')

  await ctx.reply(summary, { parse_mode: 'Markdown' })

  const keyboard = new InlineKeyboard()
    .text('Tak, generuj', 'generate_plan_yes')
    .text('Nie teraz', 'generate_plan_no')
  await ctx.reply('Czy wygenerować plan na ten tydzień?', { reply_markup: keyboard })
}

export async function messageHandler(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text?.trim()
  if (!text) return
  if (text.startsWith('/')) return

  const step = ctx.session.step

  switch (step) {
    case 'awaiting_household_name': {
      ctx.session.pendingProfile.householdName = text
      ctx.session.step = 'awaiting_member_count'
      await ctx.reply('Ile dorosłych je obiady razem?')
      return
    }

    case 'awaiting_member_count': {
      const adults = parseInt(text, 10)
      if (!Number.isFinite(adults) || adults < 1 || adults > 10) {
        await ctx.reply('Podaj liczbę dorosłych (np. 2).')
        return
      }
      ctx.session.pendingProfile.adults = adults
      ctx.session.step = 'awaiting_children_ages'
      await ctx.reply(
        "Czy są dzieci? Podaj grupy wiekowe (np. 3, 7, 12) lub napisz 'nie'.",
      )
      return
    }

    case 'awaiting_children_ages': {
      if (isNegative(text)) {
        ctx.session.pendingProfile.children = []
      } else {
        const ages = parseChildAges(text)
        ctx.session.pendingProfile.children = ages.map((age) => ({
          ageGroup: ageToGroup(age),
        }))
      }
      ctx.session.step = 'awaiting_allergies'
      await ctx.reply(
        "Czy ktoś w rodzinie ma alergie lub nietolerancje? (np. gluten, laktoza) lub 'nie'",
      )
      return
    }

    case 'awaiting_allergies': {
      // HARD CONSTRAINT input — stored and later enforced by plan.service.
      ctx.session.pendingProfile.allergies = isNegative(text) ? [] : parseCommaList(text)
      ctx.session.step = 'awaiting_hard_restrictions'
      await ctx.reply(
        "Czy są inne twarde ograniczenia? (np. wegetariański, bez wieprzowiny) lub 'nie'",
      )
      return
    }

    case 'awaiting_hard_restrictions': {
      // HARD CONSTRAINT input — stored and later enforced by plan.service.
      ctx.session.pendingProfile.hardRestrictions = isNegative(text)
        ? []
        : parseCommaList(text)
      ctx.session.step = 'awaiting_likes'
      await ctx.reply('Co wasza rodzina lubi jeść? (np. włoskie, azjatyckie, zupy)')
      return
    }

    case 'awaiting_likes': {
      ctx.session.pendingProfile.likes = isNegative(text) ? [] : parseCommaList(text)
      ctx.session.step = 'awaiting_dislikes'
      await ctx.reply("Czego unikacie? lub 'nic'")
      return
    }

    case 'awaiting_dislikes': {
      ctx.session.pendingProfile.dislikes = isNegative(text) ? [] : parseCommaList(text)
      ctx.session.step = 'awaiting_cooking_time'
      await ctx.reply('Ile czasu masz na gotowanie w dni robocze? (15/30/45/60/90 minut)')
      return
    }

    case 'awaiting_cooking_time': {
      const minutes = parseInt(text, 10)
      if (!Number.isFinite(minutes) || minutes < 15 || minutes > 120) {
        await ctx.reply('Podaj liczbę minut (między 15 a 120).')
        return
      }
      ctx.session.pendingProfile.cookingTimeWeekdayMinutes = minutes
      ctx.session.step = 'awaiting_budget_mode'
      await ctx.reply('Jaki budżet? Ekonomiczny / Normalny / Elastyczny')
      return
    }

    case 'awaiting_budget_mode': {
      const mode = parseBudgetMode(text)
      if (!mode) {
        await ctx.reply('Wybierz: Ekonomiczny, Normalny lub Elastyczny.')
        return
      }
      ctx.session.pendingProfile.budgetMode = mode
      ctx.session.step = 'awaiting_stores'
      await ctx.reply('W jakich sklepach zazwyczaj robisz zakupy? (np. Biedronka, Lidl)')
      return
    }

    case 'awaiting_stores': {
      ctx.session.pendingProfile.stores = isNegative(text) ? [] : parseCommaList(text)
      await completeOnboarding(ctx)
      return
    }

    case 'complete':
    case 'idle':
    default: {
      await ctx.reply('Użyj /help, aby zobaczyć dostępne komendy.')
      return
    }
  }
}
