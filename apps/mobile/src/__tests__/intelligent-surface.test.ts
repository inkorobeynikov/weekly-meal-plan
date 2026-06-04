import {
  deriveMealBadges,
  formatGroszeAsZl,
  mealBadgeLabel,
  costLevelLabel,
} from '@meal-planner/shared';
import { toMealCardBadges, mealBadgeTone } from '../lib/badges';

// F4 "intelligent surface" — unit coverage for the pure derivation / formatting
// logic that drives the per-dish badges, price indicator and shopping cost.

describe('deriveMealBadges', () => {
  it('returns badges in the stable kid_ok → leftovers → try_new order', () => {
    expect(
      deriveMealBadges({
        isKidFriendly: true,
        isGoodForLeftovers: true,
        isTryNew: true,
        isLeftoverMeal: false,
      }),
    ).toEqual(['kid_ok', 'leftovers', 'try_new']);
  });

  it('omits badges whose source flags are false', () => {
    expect(
      deriveMealBadges({
        isKidFriendly: false,
        isGoodForLeftovers: false,
        isTryNew: false,
        isLeftoverMeal: false,
      }),
    ).toEqual([]);
  });

  it('treats an actual leftover serving as a leftovers badge', () => {
    expect(
      deriveMealBadges({
        isKidFriendly: false,
        isGoodForLeftovers: false,
        isTryNew: false,
        isLeftoverMeal: true,
      }),
    ).toEqual(['leftovers']);
  });

  it('treats a null isTryNew as not a try-new pick', () => {
    expect(
      deriveMealBadges({
        isKidFriendly: false,
        isGoodForLeftovers: false,
        isTryNew: null,
        isLeftoverMeal: false,
      }),
    ).toEqual([]);
  });
});

describe('badge labels + tones', () => {
  it('uses the Polish labels', () => {
    expect(mealBadgeLabel('kid_ok')).toBe('Dla dzieci');
    expect(mealBadgeLabel('leftovers')).toBe('Na zapas');
    expect(mealBadgeLabel('try_new')).toBe('Coś nowego');
  });

  it('maps each badge to a distinct accent tone', () => {
    expect(mealBadgeTone('kid_ok')).toBe('plum');
    expect(mealBadgeTone('leftovers')).toBe('blue');
    expect(mealBadgeTone('try_new')).toBe('amber');
  });

  it('toMealCardBadges returns [] for null / empty input', () => {
    expect(toMealCardBadges(null)).toEqual([]);
    expect(toMealCardBadges([])).toEqual([]);
  });

  it('toMealCardBadges maps enum list to label+tone props', () => {
    expect(toMealCardBadges(['kid_ok', 'try_new'])).toEqual([
      { tone: 'plum', label: 'Dla dzieci' },
      { tone: 'amber', label: 'Coś nowego' },
    ]);
  });
});

describe('formatGroszeAsZl', () => {
  it('formats integer grosze as Polish złoty with a comma decimal', () => {
    expect(formatGroszeAsZl(1299)).toBe('12,99 zł');
    expect(formatGroszeAsZl(100)).toBe('1,00 zł');
    expect(formatGroszeAsZl(5)).toBe('0,05 zł');
    expect(formatGroszeAsZl(0)).toBe('0,00 zł');
  });

  it('returns null for null / negative / non-finite input', () => {
    expect(formatGroszeAsZl(null)).toBeNull();
    expect(formatGroszeAsZl(undefined)).toBeNull();
    expect(formatGroszeAsZl(-1)).toBeNull();
    expect(formatGroszeAsZl(Number.NaN)).toBeNull();
  });

  it('rounds fractional grosze to the nearest grosz before formatting', () => {
    expect(formatGroszeAsZl(1299.4)).toBe('12,99 zł');
    expect(formatGroszeAsZl(1299.6)).toBe('13,00 zł');
  });
});

describe('costLevelLabel', () => {
  it('maps each cost level to a Polish label', () => {
    expect(costLevelLabel('cheap')).toBe('Tanio');
    expect(costLevelLabel('moderate')).toBe('Średnio');
    expect(costLevelLabel('expensive')).toBe('Drożej');
  });
});
