import { fireEvent, render, waitFor } from '@testing-library/react-native';

// --- mocks -------------------------------------------------------------------

interface ApiCall {
  path: string;
  options?: { method?: string; body?: unknown };
}

const mockApiFetch: jest.Mock<Promise<unknown>, [string, ApiCall['options']?]> =
  jest.fn();

jest.mock('../lib/api', () => ({
  apiFetch: (path: string, options?: ApiCall['options']): Promise<unknown> =>
    mockApiFetch(path, options),
}));

// expo-router is not used by the sheet, but mock it for self-containment.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

import { RecipeSwapSheet, type SwapMealRef } from '../components/RecipeSwapSheet';

// --- fixtures ----------------------------------------------------------------

const meal: SwapMealRef = {
  planId: 'plan1',
  mealId: 'm1',
  recipeId: 'r1',
  name: 'Naleśniki',
  dayLabel: 'Pon',
  mealTypeLabel: 'Obiad',
};

const alternatives = [
  { recipeId: 'r2', name: 'Spaghetti', matchScore: 0.98 },
  { recipeId: 'r3', name: 'Risotto', matchScore: 0.91 },
];

beforeEach(() => {
  mockApiFetch.mockReset();
});

// --- tests -------------------------------------------------------------------

describe('RecipeSwapSheet (W07)', () => {
  it('renders the current meal and loads alternatives', async () => {
    mockApiFetch.mockResolvedValueOnce({ alternatives });

    const { getByText } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
      />,
    );

    // Header + current meal.
    expect(getByText('Zamień Pon · Obiad')).toBeTruthy();
    expect(getByText('Naleśniki')).toBeTruthy();

    // Alternatives resolve.
    await waitFor(() => expect(getByText('Spaghetti')).toBeTruthy());
    expect(getByText('Risotto')).toBeTruthy();
    expect(getByText('98% dopasowania')).toBeTruthy();
  });

  it('selecting an alternative confirms the swap and notifies the parent', async () => {
    // 1st call -> alternatives, 2nd call -> replace confirmation.
    mockApiFetch
      .mockResolvedValueOnce({ alternatives })
      .mockResolvedValueOnce({ id: 'm1' });

    const onSwapped: jest.Mock<void, [string]> = jest.fn();
    const onClose: jest.Mock<void, []> = jest.fn();

    const { getByText } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={onClose}
        onSwapped={onSwapped}
      />,
    );

    await waitFor(() => expect(getByText('Spaghetti')).toBeTruthy());

    fireEvent.press(getByText('Spaghetti'));

    await waitFor(() => expect(onSwapped).toHaveBeenCalledWith('m1'));
    expect(onClose).toHaveBeenCalledTimes(1);

    const confirmCall = mockApiFetch.mock.calls.find(
      ([path]) => path === '/api/plans/plan1/meals/m1/replace',
    );
    expect(confirmCall).toBeDefined();
    expect(confirmCall?.[1]?.method).toBe('POST');
    expect(confirmCall?.[1]?.body).toEqual({ recipeId: 'r2' });
  });

  it('shows an error state when alternatives fail to load', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('boom'));

    const { getByText } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(getByText('Nie udało się pobrać propozycji')).toBeTruthy(),
    );
  });
});
