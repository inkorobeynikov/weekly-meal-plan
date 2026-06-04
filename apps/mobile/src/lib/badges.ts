import type { MealBadge } from '@meal-planner/shared';
import { mealBadgeLabel } from '@meal-planner/shared';
import type { AccentTone } from '@meal-planner/ui-native';
import type { MealCardBadge } from '@meal-planner/ui-native';

// F4 "intelligent surface": map a server-derived MealBadge to a Polish label +
// design-system accent tone for the MealCard badge row. Labels/derivation live
// in @meal-planner/shared so the UI never re-implements business rules.
const BADGE_TONES: Record<MealBadge, AccentTone> = {
  kid_ok: 'plum',
  leftovers: 'blue',
  try_new: 'amber',
};

export function mealBadgeTone(badge: MealBadge): AccentTone {
  return BADGE_TONES[badge];
}

// Convert a planned meal's badge enum list into MealCard badge props. Returns an
// empty array when there are no badges (or the column was null on older rows).
export function toMealCardBadges(badges: MealBadge[] | null | undefined): MealCardBadge[] {
  if (!badges || badges.length === 0) return [];
  return badges.map((b) => ({ tone: mealBadgeTone(b), label: mealBadgeLabel(b) }));
}
