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
  // Variable plan window length in days (1..14). dayOffset runs 0..dayCount-1.
  dayCount: number
}

export function buildSystemPrompt(): string {
  return [
    'You are a meal planning assistant for families living in Poland.',
    'You produce a single meal plan tailored to a specific household for a window of consecutive days.',
    '',
    'OUTPUT RULES',
    '- Produce exactly TWO meals per day in the plan window: one obiad (mealType="lunch") AND one kolacja (mealType="dinner"). The user message lists every dayOffset with its calendar day.',
    '- INSTEAD of generating a fresh "lunch" on a given day, you MAY add a "lunch_leftover" entry that reuses the previous day\'s dinner — only when the previous dinner has isGoodForLeftovers=true. In that case set leftoversPlanned=true and copy the dinner\'s recipe content. Each day must still end up with exactly two meals total (one lunch-or-lunch_leftover + one dinner).',
    '- Both obiad and kolacja are full hot meals (not sandwiches or cold snacks). Treat them as equally substantial cooked dishes.',
    '- The output MUST conform exactly to the provided WeeklyPlan JSON schema.',
    '- dayOffset is 0..(dayCount-1) where 0 is the weekStartDate provided by the user. The window can start on ANY weekday — consult the "Day map" in the user message for the actual calendar day and weekday/weekend tag of each dayOffset.',
    '- mealType is one of: "dinner", "lunch", "lunch_leftover", "breakfast_template" (do not use breakfast_template — reserved).',
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
    '- The household cooks BOTH meals on weekdays, so split cookingTimeWeekdayMinutes between them: on Monday-Friday, the SUM of (lunch timeMinutes + dinner timeMinutes) for that day MUST be at or below cookingTimeWeekdayMinutes. A lunch_leftover counts as 0 minutes of cooking for the day (it is just reheating).',
    '- Weekend meals (Saturday and Sunday — see the Day map) may take longer.',
    '- When a recipe is good for leftovers, set isGoodForLeftovers=true and, when reasonable, use a lunch_leftover on the next day (replacing the fresh lunch) with leftoversPlanned=true and the same recipe content as the previous dinner.',
    '- Set isKidFriendly=true when the dish is appropriate for children in the household (consider their ageGroup).',
    '',
    'Respond ONLY with the structured JSON that matches the schema. Do not add commentary outside the structure.',
  ].join('\n')
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

function buildDayMap(weekStartDate: string, dayCount: number): string {
  const lines: string[] = []
  const start = new Date(`${weekStartDate}T00:00:00Z`)
  for (let offset = 0; offset < dayCount; offset++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + offset)
    const dow = d.getUTCDay()
    const isWeekend = dow === 0 || dow === 6
    lines.push(
      `- dayOffset ${offset} = ${d.toISOString().slice(0, 10)} (${WEEKDAY_NAMES[dow]}, ${isWeekend ? 'weekend' : 'weekday'})`,
    )
  }
  return lines.join('\n')
}

export function buildUserPrompt(context: PlanGenerationContext): string {
  const { householdName, members, preferences, familyMemory, weekStartDate, dayCount } = context

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
    `Plan window start date (dayOffset=0): ${weekStartDate}`,
    `Plan window length: ${dayCount} day(s). For EACH dayOffset from 0 to ${dayCount - 1} produce one obiad (mealType="lunch" OR "lunch_leftover") and one kolacja (mealType="dinner") — total ${dayCount * 2} meals.`,
    '',
    'Day map (dayOffset → calendar day):',
    buildDayMap(weekStartDate, dayCount),
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
    `Produce the plan now: ${dayCount} consecutive day(s), TWO meals per day (lunch + dinner), so the meals array must have exactly ${dayCount * 2} entries. Remember: allergies and hardRestrictions are absolute.`,
  ].join('\n')
}
