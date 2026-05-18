import type { Context, SessionFlavor } from 'grammy'

export type OnboardingStep =
  | 'idle'
  | 'awaiting_household_name'
  | 'awaiting_adults_count'
  | 'awaiting_children'
  | 'awaiting_preferences'
  | 'complete'

export interface SessionData {
  step: OnboardingStep
  householdId: string | null
}

export type BotContext = Context & SessionFlavor<SessionData>

export function initialSession(): SessionData {
  return {
    step: 'idle',
    householdId: null,
  }
}
