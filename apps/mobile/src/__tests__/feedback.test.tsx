import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  DishFeedback,
  PlanWithMealsAndRecipes,
  SubmitFeedbackInput,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useLocalSearchParams: (): { planId: string } => ({ planId: 'plan-1' }),
  router: { replace: jest.fn(), push: jest.fn() },
}));

const mockGetWeeklyPlan: jest.Mock<Promise<PlanWithMealsAndRecipes>, []> = jest.fn();
const mockSubmitFeedback: jest.Mock<
  Promise<DishFeedback>,
  [string | null, SubmitFeedbackInput]
> = jest.fn();

jest.mock('../lib/api', () => ({
  getWeeklyPlan: (): Promise<PlanWithMealsAndRecipes> => mockGetWeeklyPlan(),
  submitFeedback: (planId: string | null, payload: SubmitFeedbackInput): Promise<DishFeedback> =>
    mockSubmitFeedback(planId, payload),
}));

import FeedbackScreen from '../../app/feedback/[planId]';

// --- fixtures ----------------------------------------------------------------

function makeMeal(mealId: string, recipeId: string, title: string): PlanWithMealsAndRecipes['meals'][number] {
  return {
    meal: {
      id: mealId,
      weeklyPlanId: 'plan-1',
      date: '2026-05-25',
      mealType: 'dinner',
      recipeId,
      leftoversPlanned: false,
      servings: 4,
      badgesJson: null,
      cookedAt: null,
    },
    recipe: {
      id: recipeId,
      householdId: 'h1',
      title,
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
      costLevel: 'moderate',
      isTryNew: false,
      priceEstimateGrosze: null,
      validationStatus: 'valid',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

const plan: PlanWithMealsAndRecipes = {
  plan: {
    id: 'plan-1',
    householdId: 'h1',
    weekStartDate: '2026-05-25',
    status: 'approved',
    aiReasoningSummary: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    approvedAt: '2026-05-24T00:00:00.000Z',
  },
  meals: [
    makeMeal('meal-1', 'recipe-1', 'Pierogi ruskie'),
    makeMeal('meal-2', 'recipe-2', 'Zupa pomidorowa'),
  ],
};

const feedbackRow: DishFeedback = {
  id: 'f1',
  householdId: 'h1',
  recipeId: 'recipe-1',
  weeklyPlanId: 'plan-1',
  memberId: null,
  reaction: 'liked',
  freeText: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  mockGetWeeklyPlan.mockReset().mockResolvedValue(plan);
  mockSubmitFeedback.mockReset().mockResolvedValue(feedbackRow);
});

// --- tests -------------------------------------------------------------------

describe('FeedbackScreen (W09)', () => {
  it('highlights a reaction when selected for a meal', async () => {
    const { getAllByLabelText } = render(<FeedbackScreen />);

    await waitFor(() => expect(getAllByLabelText('Smakowało').length).toBe(2));

    const firstLike = getAllByLabelText('Smakowało')[0];
    expect(firstLike?.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(firstLike as ReturnType<typeof getAllByLabelText>[number]);

    expect(getAllByLabelText('Smakowało')[0]?.props.accessibilityState).toEqual({ selected: true });
  });

  it('submits feedback with planId, chosen reactions and free text', async () => {
    const { getByText, getAllByLabelText, getByLabelText } = render(<FeedbackScreen />);

    await waitFor(() => expect(getByText('Pierogi ruskie')).toBeTruthy());

    // React to meal-1 (favorite) and meal-2 (don't repeat).
    fireEvent.press(getAllByLabelText('Ulubione')[0] as ReturnType<typeof getAllByLabelText>[number]);
    fireEvent.press(
      getAllByLabelText('Nie powtarzać')[1] as ReturnType<typeof getAllByLabelText>[number],
    );

    fireEvent.changeText(getByLabelText('Uwagi na następny tydzień'), 'Mniej ryb');

    fireEvent.press(getByText('Zapisz opinię'));

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(2));

    // First reacted meal carries the free text.
    expect(mockSubmitFeedback).toHaveBeenCalledWith('plan-1', {
      recipeId: 'recipe-1',
      reaction: 'favorite',
      freeText: 'Mniej ryb',
    });
    expect(mockSubmitFeedback).toHaveBeenCalledWith('plan-1', {
      recipeId: 'recipe-2',
      reaction: 'dont_repeat',
    });

    await waitFor(() =>
      expect(getByText('Dzięki! Zapamiętam na przyszły tydzień 🙌')).toBeTruthy(),
    );
  });

  // F4 fix: the 😐 step previously read "Średnio" while it submitted the
  // specific `kids_didnt_eat` value. The label now matches the value it records.
  it('labels the kids_didnt_eat reaction "Dzieci nie zjadły" and submits that value', async () => {
    const { getByText, getAllByLabelText, queryByLabelText } = render(<FeedbackScreen />);

    await waitFor(() => expect(getByText('Pierogi ruskie')).toBeTruthy());

    // The misleading "Średnio" label must be gone.
    expect(queryByLabelText('Średnio')).toBeNull();

    fireEvent.press(
      getAllByLabelText('Dzieci nie zjadły')[0] as ReturnType<typeof getAllByLabelText>[number],
    );
    fireEvent.press(getByText('Zapisz opinię'));

    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitFeedback).toHaveBeenCalledWith('plan-1', {
      recipeId: 'recipe-1',
      reaction: 'kids_didnt_eat',
    });
  });
});
