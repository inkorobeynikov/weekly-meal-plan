export interface PlanGenerationContext {
  householdName: string
  members: Array<{
    displayName: string
    ageGroup: string
    mealsAtHome: { dinner: boolean }
  }>
  preferences: {
    likes: string[]
    dislikes: string[]
    hardRestrictions: string[]
    allergies: string[]
    preferredCuisines: string[]
    cookingTimeWeekdayMinutes: number
    budgetMode: 'economical' | 'normal' | 'flexible'
    varietyMode: 'safe' | 'balanced' | 'adventurous'
    stores: string[]
  }
  familyMemory: {
    liked: string[]
    disliked: string[]
    kidsRejected: string[]
    favorites: string[]
    goodForLeftovers: string[]
  }
  weekStartDate: string
}

export function buildSystemPrompt(): string {
  return [
    'You are a meal planning assistant for families living in Poland.',
    'You produce one weekly meal plan tailored to a specific household.',
    '',
    'OUTPUT RULES',
    '- Produce 5 to 7 dinners for the week. Optionally add lunch_leftover meals when a dinner is good for leftovers.',
    '- The output MUST conform exactly to the provided WeeklyPlan JSON schema.',
    '- dayOffset is 0..6 where 0 is the weekStartDate provided by the user (Monday).',
    '- mealType is one of: "dinner", "lunch_leftover", "breakfast_template".',
    '- Each recipe.whyThisMeal field explains in 1-2 sentences why this dish fits the family this week.',
    '- reasoningSummary is a short paragraph (2-4 sentences) explaining the overall composition of the plan.',
    '',
    'POLISH CONTEXT',
    '- All recipes should be culturally appropriate for a household in Poland.',
    '- Ingredients must be commonly available in Polish supermarkets such as Biedronka, Lidl, and Kaufland.',
    '- Use metric units (g, kg, ml, l, szt.) for ingredient quantities.',
    '- Prefer ingredient names that match Polish shopping habits; English names are acceptable but should be unambiguous.',
    '',
    'HARD CONSTRAINTS (NEVER VIOLATE)',
    '- Items listed under allergies MUST NOT appear in any recipe ingredient, substitution, or step. No exceptions.',
    '- Items listed under hardRestrictions MUST NOT appear in any recipe ingredient, substitution, or step. No exceptions.',
    '- If you are not sure whether an ingredient triggers an allergy or restriction, do not include it. Choose a safe alternative.',
    '- Hidden sources count too (e.g. butter contains dairy, soy sauce contains gluten and soy).',
    '',
    'SOFT PREFERENCES',
    '- Prefer the family\'s liked dishes, preferred cuisines, and previously favorited recipes.',
    '- Avoid recipes resembling those marked disliked or that kids recently rejected.',
    '- Honor varietyMode: "safe" repeats familiar favorites; "balanced" mixes 1-2 new dishes; "adventurous" introduces several new dishes.',
    '- Honor budgetMode: "economical" uses cheap, staple ingredients; "normal" is mid-range; "flexible" allows higher-cost items.',
    '',
    'TIME AND PLANNING',
    '- For weekday dinners (Mon-Fri, dayOffset 0..4) keep recipe.timeMinutes at or below the household\'s cookingTimeWeekdayMinutes.',
    '- Weekend dinners (dayOffset 5..6) may take longer.',
    '- When a recipe is good for leftovers, set isGoodForLeftovers=true and, when reasonable, add a lunch_leftover the next day with leftoversPlanned=true and the same recipe content.',
    '- Set isKidFriendly=true when the dish is appropriate for children in the household (consider their ageGroup).',
    '',
    'Respond ONLY with the structured JSON that matches the schema. Do not add commentary outside the structure.',
  ].join('\n')
}

export function buildUserPrompt(context: PlanGenerationContext): string {
  const { householdName, members, preferences, familyMemory, weekStartDate } = context

  const memberLines = members.length
    ? members
        .map(
          (m) =>
            `- ${m.displayName} (${m.ageGroup}); dinner at home: ${m.mealsAtHome.dinner ? 'yes' : 'no'}`,
        )
        .join('\n')
    : '- (no members listed)'

  const fmt = (label: string, items: string[]): string =>
    `- ${label}: ${items.length ? items.join(', ') : '(none)'}`

  return [
    `Household: ${householdName}`,
    `Week start date (Monday, dayOffset=0): ${weekStartDate}`,
    '',
    'Members:',
    memberLines,
    '',
    'Preferences:',
    fmt('Likes', preferences.likes),
    fmt('Dislikes', preferences.dislikes),
    fmt('HARD RESTRICTIONS (never include)', preferences.hardRestrictions),
    fmt('ALLERGIES (never include, including hidden sources)', preferences.allergies),
    fmt('Preferred cuisines', preferences.preferredCuisines),
    `- Weekday cooking time limit: ${preferences.cookingTimeWeekdayMinutes} minutes`,
    `- Budget mode: ${preferences.budgetMode}`,
    `- Variety mode: ${preferences.varietyMode}`,
    fmt('Shops typically used', preferences.stores),
    '',
    'Family memory (from past feedback):',
    fmt('Recently liked', familyMemory.liked),
    fmt('Recently disliked', familyMemory.disliked),
    fmt('Kids rejected recently', familyMemory.kidsRejected),
    fmt('All-time favorites', familyMemory.favorites),
    fmt('Good for leftovers', familyMemory.goodForLeftovers),
    '',
    'Produce the weekly plan now. Remember: allergies and hardRestrictions are absolute.',
  ].join('\n')
}
