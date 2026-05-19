import type { Context, SessionFlavor } from 'grammy'
import type { HouseholdProfile } from '@meal-planner/ai'

export type OnboardingStep =
  | 'idle'
  | 'awaiting_household_name'
  | 'awaiting_member_count'
  | 'awaiting_children_ages'
  | 'awaiting_allergies'
  | 'awaiting_hard_restrictions'
  | 'awaiting_likes'
  | 'awaiting_dislikes'
  | 'awaiting_cooking_time'
  | 'awaiting_budget_mode'
  | 'awaiting_stores'
  | 'complete'

export interface SessionData {
  step: OnboardingStep
  householdId: string | null
  pendingProfile: Partial<HouseholdProfile>
}

export type BotContext = Context & SessionFlavor<SessionData>

export function initialSession(): SessionData {
  return {
    step: 'idle',
    householdId: null,
    pendingProfile: {},
  }
}
