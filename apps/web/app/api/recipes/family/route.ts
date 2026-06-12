import { recipeService } from '@meal-planner/domain'
import { withAuth } from '../../../../lib/auth-middleware.js'

// Phase 13 PR-4 — the family cookbook. Recipes this household has interacted
// with (planned_meals incl. cooked marks + dishFeedback), grouped into
// "Ulubione" / "Ostatnio gotowane" / "Wszystkie wasze dania". This is NOT the
// full imported pool — only the household's own history surfaces here.
export const GET = withAuth(async (_req, { user }) => {
  const householdId = typeof user.householdId === 'string' ? user.householdId : null
  if (!householdId) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const cookbook = await recipeService.getFamilyCookbook(householdId)
  return Response.json({ cookbook })
})
