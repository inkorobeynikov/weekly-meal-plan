import { fireEvent, render, waitFor } from '@testing-library/react-native';

// --- mocks -------------------------------------------------------------------

const mockReplaceMeal: jest.Mock<Promise<unknown>, [string, string, string?]> =
  jest.fn();

jest.mock('../lib/api', () => ({
  replaceMeal: (planId: string, mealId: string, reason?: string): Promise<unknown> =>
    mockReplaceMeal(planId, mealId, reason),
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
  name: 'Naleśniki',
  dayLabel: 'Pon',
  mealTypeLabel: 'Obiad',
};

beforeEach(() => {
  mockReplaceMeal.mockReset();
});

// --- tests -------------------------------------------------------------------

describe('RecipeSwapSheet (W07)', () => {
  it('renders the current meal and the reason → replace form', () => {
    const { getByText, getByTestId } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
      />,
    );

    expect(getByText('Zamień Pon · Obiad')).toBeTruthy();
    expect(getByText('Naleśniki')).toBeTruthy();
    expect(getByTestId('swap-reason')).toBeTruthy();
    expect(getByTestId('swap-confirm')).toBeTruthy();
  });

  it('confirming with a reason calls replaceMeal and notifies the parent', async () => {
    mockReplaceMeal.mockResolvedValueOnce({ id: 'm1' });

    const onSwapped: jest.Mock<void, [string]> = jest.fn();
    const onClose: jest.Mock<void, []> = jest.fn();

    const { getByTestId } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={onClose}
        onSwapped={onSwapped}
      />,
    );

    fireEvent.changeText(getByTestId('swap-reason'), 'za ciężkie');
    fireEvent.press(getByTestId('swap-confirm'));

    await waitFor(() => expect(onSwapped).toHaveBeenCalledWith('m1'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockReplaceMeal).toHaveBeenCalledWith('plan1', 'm1', 'za ciężkie');
  });

  it('confirming without a reason passes undefined', async () => {
    mockReplaceMeal.mockResolvedValueOnce({ id: 'm1' });

    const { getByTestId } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={jest.fn()}
        onSwapped={jest.fn()}
      />,
    );

    fireEvent.press(getByTestId('swap-confirm'));

    await waitFor(() =>
      expect(mockReplaceMeal).toHaveBeenCalledWith('plan1', 'm1', undefined),
    );
  });

  it('shows an error state when the replacement fails', async () => {
    mockReplaceMeal.mockRejectedValueOnce(new Error('boom'));

    const onSwapped: jest.Mock<void, [string]> = jest.fn();

    const { getByTestId, getByText } = render(
      <RecipeSwapSheet
        visible
        meal={meal}
        onClose={jest.fn()}
        onSwapped={onSwapped}
      />,
    );

    fireEvent.press(getByTestId('swap-confirm'));

    await waitFor(() =>
      expect(getByText('Nie udało się zamienić posiłku')).toBeTruthy(),
    );
    expect(onSwapped).not.toHaveBeenCalled();
  });
});
