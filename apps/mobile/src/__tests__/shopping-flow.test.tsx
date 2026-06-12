import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  AddShoppingItemInput,
  ShoppingListItem,
  ShoppingListWithItems,
} from '../lib/api';
import type { ItemStatus } from '@meal-planner/shared';

// --- mocks -------------------------------------------------------------------
// Mirror shopping.test.tsx: real @meal-planner/ui-native renders W03/W08; api +
// router + the confetti cannon are mocked. We drive the W03 -> W08 transition by
// checking the last remaining item so every item becomes 'bought'.

const mockReplace: jest.Mock<void, [string]> = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string): void => mockReplace(path) },
}));

const mockGetShoppingList: jest.Mock<Promise<ShoppingListWithItems | null>, []> = jest.fn();
const mockUpdateShoppingItem: jest.Mock<
  Promise<ShoppingListItem>,
  [string, ItemStatus, string?]
> = jest.fn();
const mockAddShoppingItem: jest.Mock<Promise<ShoppingListItem>, [string, AddShoppingItemInput]> =
  jest.fn();
const mockApiFetch: jest.Mock<Promise<unknown>, [string, unknown?]> = jest.fn();
const mockGetWeeklyPlan: jest.Mock<Promise<unknown>, []> = jest.fn();
const mockGeneratePlan: jest.Mock<Promise<unknown>, []> = jest.fn();

jest.mock('../lib/api', () => ({
  getShoppingList: (): Promise<ShoppingListWithItems | null> => mockGetShoppingList(),
  updateShoppingItem: (
    id: string,
    status: ItemStatus,
    replacementText?: string,
  ): Promise<ShoppingListItem> => mockUpdateShoppingItem(id, status, replacementText),
  addShoppingItem: (listId: string, input: AddShoppingItemInput): Promise<ShoppingListItem> =>
    mockAddShoppingItem(listId, input),
  apiFetch: (path: string, options?: unknown): Promise<unknown> => mockApiFetch(path, options),
  // The shopping screen loads the current plan (F4 source-recipe labels) and may
  // start a new week via usePlanGeneration.
  getWeeklyPlan: (): Promise<unknown> => mockGetWeeklyPlan(),
  generatePlan: (): Promise<unknown> => mockGeneratePlan(),
}));

// react-native-confetti-cannon → no-op component (avoids native timers).
jest.mock('react-native-confetti-cannon', () => () => null);

import ShoppingScreen from '../../app/(tabs)/shopping/index';

// --- fixtures ----------------------------------------------------------------

function makeItem(
  over: Partial<ShoppingListItem> & Pick<ShoppingListItem, 'id' | 'name'>,
): ShoppingListItem {
  return {
    shoppingListId: 'sl1',
    normalizedName: over.name.toLowerCase(),
    category: 'Inne',
    quantity: '1',
    unit: null,
    neededByDate: null,
    buyTiming: 'main_shop',
    relatedRecipeIds: [],
    status: 'pending',
    replacementText: null,
    promoHintId: null,
    estimatedPriceGrosze: null,
    ...over,
  };
}

function makeList(items: ShoppingListItem[]): ShoppingListWithItems {
  return {
    list: {
      id: 'sl1',
      weeklyPlanId: 'wp1',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    items,
  };
}

beforeEach(() => {
  mockReplace.mockReset();
  mockGetShoppingList.mockReset();
  mockUpdateShoppingItem
    .mockReset()
    .mockImplementation((id, status) => Promise.resolve(makeItem({ id, name: 'x', status })));
  mockAddShoppingItem
    .mockReset()
    .mockImplementation((_listId, input) =>
      Promise.resolve(makeItem({ id: 'new-1', name: input.name })),
    );
  mockApiFetch.mockReset().mockResolvedValue(null);
  mockGetWeeklyPlan.mockReset().mockResolvedValue({ plan: null, meals: [] });
  mockGeneratePlan.mockReset().mockResolvedValue({ status: 'generating' });
});

// --- tests -------------------------------------------------------------------

describe('Shopping flow (W03 -> W08 celebration)', () => {
  it('celebrates once the last remaining item is checked off', async () => {
    // All bought except the final item; checking it pushes the list to 100%.
    mockGetShoppingList.mockResolvedValue(
      makeList([
        makeItem({ id: 'i1', name: 'Ziemniaki', category: 'Warzywa', status: 'bought' }),
        makeItem({ id: 'i2', name: 'Mleko', category: 'Nabiał', status: 'bought' }),
        makeItem({ id: 'i3', name: 'Schab', category: 'Mięso', status: 'pending' }),
      ]),
    );

    const { getByLabelText, getByText, queryByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByLabelText('Schab')).toBeTruthy());
    // Not celebrating yet — one item still pending.
    expect(queryByText('Wszystko kupione! 🎉')).toBeNull();

    fireEvent.press(getByLabelText('Schab'));

    // The last item flips to 'bought' → celebration heading appears.
    await waitFor(() => expect(getByText('Wszystko kupione! 🎉')).toBeTruthy());
    expect(mockUpdateShoppingItem).toHaveBeenCalledWith('i3', 'bought', undefined);
  });

  it('already shows the celebration when the whole list arrives bought', async () => {
    mockGetShoppingList.mockResolvedValue(
      makeList([
        makeItem({ id: 'i1', name: 'Ziemniaki', status: 'bought' }),
        makeItem({ id: 'i2', name: 'Mleko', status: 'bought' }),
      ]),
    );

    const { getByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Wszystko kupione! 🎉')).toBeTruthy());
  });
});
