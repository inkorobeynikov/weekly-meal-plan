import { z } from 'zod'

export const HouseholdProfileSchema = z.object({
  householdName: z.string().optional(),
  adults: z.number().int().min(1),
  children: z
    .array(
      z.object({
        ageGroup: z.enum(['child_0_3', 'child_4_7', 'child_8_12', 'teen']),
      }),
    )
    .default([]),
  dinnersPerWeek: z.number().int().min(5).max(7).default(6),
  leftoversForLunch: z.boolean().default(false),
  likes: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  // Hard constraints — must never be violated by AI-generated plans.
  allergies: z.array(z.string()).default([]),
  hardRestrictions: z.array(z.string()).default([]),
  preferredCuisines: z.array(z.string()).default([]),
  cookingTimeWeekdayMinutes: z.number().int().min(15).max(120).default(45),
  budgetMode: z.enum(['economical', 'normal', 'flexible']).default('normal'),
  stores: z.array(z.string()).default([]),
  clarificationNeeded: z.array(z.string()).default([]),
})

export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>
