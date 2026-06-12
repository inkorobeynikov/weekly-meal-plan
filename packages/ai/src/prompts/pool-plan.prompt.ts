/**
 * Pool-based plan generation prompts (Phase 13d). Used together with
 * buildUserPrompt(context) from plan.prompt.ts — the candidate block goes in
 * a separate follow-up message, mirroring the replaceMeal message pattern.
 */

export interface PoolCandidate {
  id: string
  title: string
  cuisine: string | null
  tags: string[]
  mealTypes: string[]
  timeMinutes: number
  costLevel: string
  isGoodForLeftovers: boolean
  mainIngredients: string[]
}

export function buildPoolSystemPrompt(): string {
  return [
    'You are a meal planning assistant for families living in Poland.',
    'You compose a meal plan by SELECTING recipes from a provided candidate list — real,',
    'tested Polish recipes. You never invent recipes and never modify them.',
    '',
    'OUTPUT RULES',
    '- Produce exactly TWO meals per day in the plan window: one obiad (mealType="lunch") AND one',
    '  kolacja (mealType="dinner"). The user message lists every dayOffset with its calendar day.',
    '- Every meal references a recipe by its exact `recipeId` from the candidate list. Never output',
    '  an id that is not in the list.',
    '- Use each candidate recipe AT MOST ONCE in the plan — except the lunch_leftover rule below.',
    '- INSTEAD of a fresh "lunch" on a given day, you MAY plan a "lunch_leftover" that reuses THE',
    '  PREVIOUS DAY\'S DINNER — only when that dinner\'s candidate has leftovers: yes. Then set',
    '  leftoversPlanned=true and repeat the SAME recipeId as that dinner. Each day still ends up',
    '  with exactly two meals (one lunch-or-lunch_leftover + one dinner).',
    '- Each whyThisMeal explains in 1-2 sentences (in Polish) why this dish fits the family.',
    '- reasoningSummary is a short Polish paragraph (2-4 sentences) about the overall composition.',
    '',
    'HARD CONSTRAINTS (NEVER VIOLATE)',
    '- The candidate list is already filtered for the family\'s allergies, but stay vigilant: if a',
    '  candidate\'s title or ingredients clearly conflict with a listed allergy or hard restriction,',
    '  DO NOT select it.',
    '',
    'SELECTION GUIDELINES',
    '- TIME: on weekdays (see the Day map) the SUM of lunch timeMinutes + dinner timeMinutes for a',
    '  day must stay at or below the family\'s weekday cooking limit. A lunch_leftover counts as 0',
    '  minutes. Weekend meals may take longer.',
    '- VARIETY: vary main proteins and cuisines across the week; avoid similar dishes on adjacent',
    '  days. Honor varietyMode (safe = familiar favorites, adventurous = more new dishes).',
    '- BUDGET: honor budgetMode via the candidates\' cost levels (economical → prefer cheap).',
    '- PREFERENCES: prefer candidates matching likes, preferred cuisines and family-memory favorites;',
    '  avoid ones resembling dislikes or recently rejected dishes.',
    '',
    'Respond ONLY with the structured JSON matching the schema. Do not add commentary.',
  ].join('\n')
}

export function formatCandidateList(candidates: PoolCandidate[]): string {
  const lines = candidates.map((c) => {
    const tags = c.tags.length ? c.tags.join(', ') : '-'
    const ingredients = c.mainIngredients.length ? c.mainIngredients.join(', ') : '-'
    return (
      `- recipeId: ${c.id} | ${c.title} | kuchnia: ${c.cuisine ?? '-'} | ${c.timeMinutes} min | ` +
      `koszt: ${c.costLevel} | pasuje na: ${c.mealTypes.join(', ')} | ` +
      `leftovers: ${c.isGoodForLeftovers ? 'yes' : 'no'} | tagi: ${tags} | składniki: ${ingredients}`
    )
  })
  return ['Candidate recipes (select by recipeId):', ...lines].join('\n')
}

export function buildPoolSelectionPrompt(candidates: PoolCandidate[]): string {
  return [
    formatCandidateList(candidates),
    '',
    'Compose the full plan now from these candidates only. Remember: two meals per day,',
    'weekday time budget, allergies and hard restrictions are absolute.',
  ].join('\n')
}

export function buildPoolReplacementPrompt(
  candidates: PoolCandidate[],
  previousTitle: string,
  mealType: string,
  reason: string | undefined,
  otherMeals: Array<{ date: string; mealType: string; title: string }>,
): string {
  const otherBlock = otherMeals.length
    ? [
        'Other meals already in this plan (do NOT select anything that repeats or closely resembles these):',
        ...otherMeals.map((m) => `- ${m.date} ${m.mealType}: ${m.title}`),
      ].join('\n')
    : ''
  return [
    'Replace a single meal in an existing weekly plan by selecting ONE candidate.',
    `Previous recipe title (do NOT repeat or closely resemble): ${previousTitle}`,
    `Meal type to fill: ${mealType}`,
    reason ? `Reason for replacement: ${reason}` : 'Reason for replacement: (none specified)',
    ...(otherBlock ? ['', otherBlock] : []),
    '',
    formatCandidateList(candidates),
    '',
    'Return exactly one selection matching the schema (recipeId + whyThisMeal in Polish).',
  ].join('\n')
}
