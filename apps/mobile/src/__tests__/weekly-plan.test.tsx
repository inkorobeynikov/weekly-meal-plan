import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../lib/api';
import type {
  GeneratePlanResult,
  PlanWithMealsAndRecipes,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------

const mockPush: jest.Mock<void, [unknown]> = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (args: unknown): void => mockPush(args) },
}));

const mockGetWeeklyPlan: jest.Mock<Promise<PlanWithMealsAndRecipes>, []> = jest.fn();
const mockGeneratePlan: jest.Mock<Promise<GeneratePlanResult>, []> = jest.fn();

// ApiError must be a real class so `instanceof` checks in the screen work.
// The class is defined *inside* the (hoisted) factory to avoid the TDZ — a
// class declaration's value is not hoisted, so referencing an outer one here
// would be `undefined`. The test imports `ApiError` from the (mocked) module to
// build a 404 rejection the screen recognises.
jest.mock('../lib/api', () => {
  class MockApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    ApiError: MockApiError,
    getWeeklyPlan: (): Promise<PlanWithMealsAndRecipes> => mockGetWeeklyPlan(),
    generatePlan: (): Promise<GeneratePlanResult> => mockGeneratePlan(),
  };
});

import PlanScreen from '../../app/(tabs)/plan/index';

// --- fixtures ----------------------------------------------------------------

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Today + the Monday that starts today's week, computed dynamically so the
// fixture's "today" meal is always inside the rendered week and selected by
// default — independent of the machine date.
const TODAY = new Date();
const TODAY_ISO = toIso(TODAY);
const WEEK_START_ISO = toIso(
  new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - ((TODAY.getDay() + 6) % 7)),
);

function makePlan(): PlanWithMealsAndRecipes {
  const recipe = {
    id: 'r1',
    householdId: 'h1',
    title: 'Naleśniki z serem',
    source: 'ai_generated' as const,
    servings: 4,
    timeMinutes: 30,
    difficulty: 'easy' as const,
    ingredientsJson: [],
    stepsJson: [],
    substitutionsJson: [],
    leftoversNotes: null,
    storageNotes: null,
    childFriendlyNotes: null,
    allergenNotes: null,
    costLevel: 'cheap' as const,
    isTryNew: false,
    priceEstimateGrosze: null,
    validationStatus: 'valid' as const,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
  return {
    plan: {
      id: 'p1',
      householdId: 'h1',
      weekStartDate: WEEK_START_ISO,
      status: 'approved',
      aiReasoningSummary: null,
      createdAt: '2026-06-01T00:00:00.000Z',
      approvedAt: '2026-06-01T00:00:00.000Z',
    },
    meals: [
      {
        meal: {
          id: 'm1',
          weeklyPlanId: 'p1',
          // Today so it shows on the default-selected day.
          date: TODAY_ISO,
          mealType: 'dinner',
          recipeId: 'r1',
          leftoversPlanned: false,
          servings: 4,
          badgesJson: null,
          cookedAt: null,
        },
        recipe,
      },
    ],
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockGetWeeklyPlan.mockReset();
  mockGeneratePlan.mockReset();
});

describe('W01 Weekly Plan', () => {
  it('shows skeletons while loading', () => {
    // Pending promise → stays in loading state.
    mockGetWeeklyPlan.mockReturnValue(new Promise<PlanWithMealsAndRecipes>(() => undefined));
    const { getAllByLabelText } = render(<PlanScreen />);
    // SkeletonBlock exposes accessibilityLabel "Ładowanie".
    expect(getAllByLabelText('Ładowanie').length).toBeGreaterThan(0);
  });

  it('renders the day strip and the selected day meals for an approved plan', async () => {
    mockGetWeeklyPlan.mockResolvedValue(makePlan());
    const { getByText, getAllByText } = render(<PlanScreen />);

    await waitFor(() => {
      expect(getByText('Naleśniki z serem')).toBeTruthy();
    });

    // Day strip weekday abbreviations present.
    expect(getAllByText('Pon').length).toBeGreaterThan(0);
    // Meal type label — a 'dinner' meal is labelled "Kolacja".
    expect(getByText('Kolacja')).toBeTruthy();
  });

  it('navigates to the recipe detail with the recipeId when a meal is tapped', async () => {
    mockGetWeeklyPlan.mockResolvedValue(makePlan());
    const { getByText } = render(<PlanScreen />);

    await waitFor(() => {
      expect(getByText('Naleśniki z serem')).toBeTruthy();
    });

    fireEvent.press(getByText('Naleśniki z serem'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/plan/recipe/[id]',
      params: { id: 'r1' },
    });
  });

  it('shows the empty state generate button which calls generatePlan', async () => {
    mockGetWeeklyPlan.mockRejectedValue(new ApiError(404, 'No plan found', null));
    mockGeneratePlan.mockResolvedValue({
      status: 'generating',
      weekStartDate: '2026-06-08',
      dayCount: 7,
    });
    const { getByLabelText } = render(<PlanScreen />);

    const button = await waitFor(() => getByLabelText('Wygeneruj pierwszy plan'));
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    });
  });

  // F4: the AI reasoning blurb and per-dish badges are surfaced on W01.
  it('surfaces the AI reasoning block and per-dish badges', async () => {
    const base = makePlan();
    const meal0 = base.meals[0];
    if (!meal0) throw new Error('fixture missing meal');
    mockGetWeeklyPlan.mockResolvedValue({
      ...base,
      plan: { ...base.plan, aiReasoningSummary: 'Lekki i tani tydzień dla rodziny.' },
      meals: [
        {
          ...meal0,
          meal: { ...meal0.meal, badgesJson: ['kid_ok', 'try_new'] },
        },
      ],
    });

    const { getByText, getByTestId } = render(<PlanScreen />);

    await waitFor(() => expect(getByText('Naleśniki z serem')).toBeTruthy());
    // Reasoning block.
    expect(getByTestId('plan-reasoning')).toBeTruthy();
    expect(getByText('Lekki i tani tydzień dla rodziny.')).toBeTruthy();
    // Per-dish badges rendered from badgesJson.
    expect(getByText('Dla dzieci')).toBeTruthy();
    expect(getByText('Coś nowego')).toBeTruthy();
  });
});
