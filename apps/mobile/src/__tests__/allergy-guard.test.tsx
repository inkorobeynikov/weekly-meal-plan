import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  FamilyResponse,
  MealWithRecipe,
  PlanWithMealsAndRecipes,
  Recipe,
  WeeklyPlan,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------
// Mirror plan-review.test.tsx: real @meal-planner/ui-native renders W04; only
// api + router are mocked. Allergies/hardRestrictions are HARD CONSTRAINTS —
// this guard must block approval, so we assert it from both directions.

const mockReplace: jest.Mock<void, [string]> = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string): void => mockReplace(path) },
}));

const mockGetWeeklyPlan: jest.Mock<Promise<PlanWithMealsAndRecipes>, []> = jest.fn();
const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
const mockApprovePlan: jest.Mock<Promise<WeeklyPlan>, [string]> = jest.fn();
const mockGeneratePlan: jest.Mock<Promise<unknown>, []> = jest.fn();

jest.mock('../lib/api', () => ({
  getWeeklyPlan: (): Promise<PlanWithMealsAndRecipes> => mockGetWeeklyPlan(),
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
  approvePlan: (planId: string): Promise<WeeklyPlan> => mockApprovePlan(planId),
  generatePlan: (): Promise<unknown> => mockGeneratePlan(),
  apiFetch: (): Promise<unknown> => Promise.resolve({ alternatives: [] }),
}));

import PlanReviewScreen from '../../app/(tabs)/plan/review';

// --- fixtures ----------------------------------------------------------------

function makeRecipe(over: Partial<Recipe>): Recipe {
  return {
    id: 'r1',
    householdId: 'h1',
    title: 'Naleśniki',
    source: 'ai_generated',
    servings: 4,
    timeMinutes: 30,
    difficulty: 'easy',
    ingredientsJson: [],
    stepsJson: [],
    substitutionsJson: [],
    leftoversNotes: null,
    storageNotes: null,
    childFriendlyNotes: null,
    allergenNotes: null,
    costLevel: 'cheap',
    validationStatus: 'valid',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function makeMeal(id: string, recipe: Recipe): MealWithRecipe {
  return {
    meal: {
      id,
      weeklyPlanId: 'plan1',
      date: '2026-06-01', // Monday
      mealType: 'dinner',
      recipeId: recipe.id,
      leftoversPlanned: false,
      servings: 4,
    },
    recipe,
  };
}

const plan: WeeklyPlan = {
  id: 'plan1',
  householdId: 'h1',
  weekStartDate: '2026-06-01',
  status: 'draft',
  aiReasoningSummary: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  approvedAt: null,
};

function makeFamily(allergies: string[]): FamilyResponse {
  return {
    household: {
      id: 'h1',
      name: 'Rodzina',
      locale: 'pl-PL',
      country: 'PL',
      timezone: 'Europe/Warsaw',
      memberCount: null,
      onboardingCompletedAt: null,
      telegramChatId: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    members: [],
    preferences: {
      id: 'p1',
      householdId: 'h1',
      likes: [],
      dislikes: [],
      hardRestrictions: [],
      allergies,
      preferredCuisines: [],
      typicalBreakfasts: [],
      cookingTimeWeekdayMinutes: 30,
      budgetMode: 'normal',
      varietyMode: 'balanced',
      stores: [],
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
  };
}

beforeEach(() => {
  mockReplace.mockReset();
  mockApprovePlan.mockReset().mockResolvedValue(plan);
  mockGeneratePlan.mockReset().mockResolvedValue({ status: 'generating' });
  mockGetWeeklyPlan.mockReset();
  mockGetHousehold.mockReset();
});

// --- tests -------------------------------------------------------------------

describe('Allergy guard (W04 hard constraint)', () => {
  it('shows the allergy warning and blocks approval when a meal hits a household allergen', async () => {
    const recipe = makeRecipe({
      title: 'Tost z masłem orzechowym',
      allergenNotes: 'Zawiera orzechy',
    });
    mockGetWeeklyPlan.mockResolvedValue({ plan, meals: [makeMeal('m1', recipe)] });
    mockGetHousehold.mockResolvedValue(makeFamily(['Orzechy']));

    const { getByLabelText, getByText } = render(<PlanReviewScreen />);

    // The warning banner is visible (assert on its Polish accessibility label
    // and the conflict line listing recipe + matched allergen).
    await waitFor(() => expect(getByLabelText('Ostrzeżenie o alergii')).toBeTruthy());
    expect(getByText(/Tost z masłem orzechowym: Orzechy/)).toBeTruthy();

    // The approve button is disabled while the warning is visible...
    const approveBtn = getByLabelText('Zatwierdź plan');
    expect(approveBtn.props.accessibilityState.disabled).toBe(true);

    // ...AND pressing it does NOT call approvePlan (hard constraint never bypassed).
    fireEvent.press(approveBtn);
    expect(mockApprovePlan).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('allows approval for a clean plan with no allergen conflict', async () => {
    const recipe = makeRecipe({ title: 'Naleśniki', allergenNotes: null });
    mockGetWeeklyPlan.mockResolvedValue({ plan, meals: [makeMeal('m1', recipe)] });
    mockGetHousehold.mockResolvedValue(makeFamily(['Orzechy']));

    const { getByLabelText, queryByLabelText } = render(<PlanReviewScreen />);

    await waitFor(() => expect(getByLabelText('Zatwierdź plan')).toBeTruthy());
    expect(queryByLabelText('Ostrzeżenie o alergii')).toBeNull();

    const approveBtn = getByLabelText('Zatwierdź plan');
    expect(approveBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(approveBtn);
    await waitFor(() => expect(mockApprovePlan).toHaveBeenCalledWith('plan1'));
  });
});
