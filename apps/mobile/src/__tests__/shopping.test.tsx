import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  AddShoppingItemInput,
  ShoppingListItem,
  ShoppingListWithItems,
} from '../lib/api';
import type { ItemStatus } from '@meal-planner/shared';

// --- mocks -------------------------------------------------------------------

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
const mockDeleteShoppingItem: jest.Mock<Promise<{ id: string }>, [string]> = jest.fn();
const mockApiFetch: jest.Mock<Promise<unknown>, [string, unknown?]> = jest.fn();
const mockGeneratePlan: jest.Mock<Promise<unknown>, []> = jest.fn();
const mockGetWeeklyPlan: jest.Mock<Promise<unknown>, []> = jest.fn();

jest.mock('../lib/api', () => ({
  getShoppingList: (): Promise<ShoppingListWithItems | null> => mockGetShoppingList(),
  updateShoppingItem: (id: string, status: ItemStatus, replacementText?: string): Promise<ShoppingListItem> =>
    mockUpdateShoppingItem(id, status, replacementText),
  addShoppingItem: (listId: string, input: AddShoppingItemInput): Promise<ShoppingListItem> =>
    mockAddShoppingItem(listId, input),
  deleteShoppingItem: (itemId: string): Promise<{ id: string }> => mockDeleteShoppingItem(itemId),
  apiFetch: (path: string, options?: unknown): Promise<unknown> => mockApiFetch(path, options),
  // Pulled in transitively by usePlanGeneration (new-week flow).
  generatePlan: (): Promise<unknown> => mockGeneratePlan(),
  getWeeklyPlan: (): Promise<unknown> => mockGetWeeklyPlan(),
}));

// react-native-confetti-cannon → no-op component (avoids native timers).
jest.mock('react-native-confetti-cannon', () => () => null);

import ShoppingScreen from '../../app/(tabs)/shopping/index';

// --- fixtures ----------------------------------------------------------------

function makeItem(over: Partial<ShoppingListItem> & Pick<ShoppingListItem, 'id' | 'name'>): ShoppingListItem {
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

const sampleItems: ShoppingListItem[] = [
  makeItem({ id: 'i1', name: 'Ziemniaki', category: 'Warzywa', quantity: '1', unit: 'kg' }),
  makeItem({ id: 'i2', name: 'Mleko', category: 'Nabiał', quantity: '1', unit: 'l' }),
  makeItem({ id: 'i3', name: 'Schab', category: 'Mięso', quantity: '600', unit: 'g' }),
];

beforeEach(() => {
  mockReplace.mockReset();
  mockGetShoppingList.mockReset().mockResolvedValue(makeList(sampleItems));
  mockUpdateShoppingItem
    .mockReset()
    .mockImplementation((id, status) => Promise.resolve(makeItem({ id, name: 'x', status })));
  mockAddShoppingItem
    .mockReset()
    .mockImplementation((_listId, input) =>
      Promise.resolve(makeItem({ id: 'new-1', name: input.name })),
    );
  mockDeleteShoppingItem.mockReset().mockResolvedValue({ id: 'i1' });
  mockApiFetch.mockReset().mockResolvedValue(null);
  mockGeneratePlan.mockReset().mockResolvedValue({ status: 'generating' });
  // The shopping screen loads the current plan in parallel to map recipe titles
  // onto shopping lines (F4 source-recipe labels). Default to an empty plan.
  mockGetWeeklyPlan.mockReset().mockResolvedValue({
    plan: null,
    meals: [],
  });
});

// --- tests -------------------------------------------------------------------

describe('ShoppingScreen (W03 + W08)', () => {
  it('shows skeleton placeholders while loading', () => {
    // Pending promise → stays in loading state.
    mockGetShoppingList.mockReturnValue(new Promise<ShoppingListWithItems | null>(() => {}));
    const { getAllByLabelText, getByText } = render(<ShoppingScreen />);

    expect(getByText('Zakupy')).toBeTruthy();
    // SkeletonBlock renders with accessibilityLabel "Ładowanie".
    expect(getAllByLabelText('Ładowanie').length).toBeGreaterThan(0);
  });

  it('renders grouped items with category headers', async () => {
    const { getByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Ziemniaki')).toBeTruthy());
    expect(getByText('Warzywa')).toBeTruthy();
    expect(getByText('Nabiał')).toBeTruthy();
    expect(getByText('Mięso')).toBeTruthy();
    expect(getByText('Mleko')).toBeTruthy();
    expect(getByText('Schab')).toBeTruthy();
  });

  // F4: each line surfaces the source recipe, needed-by day, promo retailer and
  // its cost estimate; the footer sums the estimates into a total.
  it('surfaces source recipe, needed-by, promo and cost estimate (F4)', async () => {
    mockGetWeeklyPlan.mockResolvedValue({
      plan: { id: 'wp1' },
      meals: [{ recipe: { id: 'rec-1', title: 'Schabowy z ziemniakami' } }],
    });
    mockGetShoppingList.mockResolvedValue(
      makeList([
        makeItem({
          id: 'i1',
          name: 'Ziemniaki',
          category: 'Warzywa',
          quantity: '1',
          unit: 'kg',
          relatedRecipeIds: ['rec-1'],
          neededByDate: '2026-06-03',
          estimatedPriceGrosze: 450,
          promoHints: [
            {
              id: 'p1',
              retailer: 'Biedronka',
              productName: 'Ziemniaki',
              normalizedProductName: 'ziemniaki',
              priceText: '2,99',
              startDate: null,
              endDate: null,
              conditionsText: null,
              requiresLoyaltyApp: false,
              availabilityScope: 'nationwide',
              sourceUrl: null,
              confidenceScore: 90,
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        }),
      ]),
    );

    const { getByText, getAllByText, getByTestId } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Ziemniaki')).toBeTruthy());
    // Source recipe label.
    expect(getByTestId('shopping-source-i1')).toBeTruthy();
    expect(getByText('Schabowy z ziemniakami')).toBeTruthy();
    // Needed-by day + promo chips.
    expect(getByTestId('shopping-neededby-i1')).toBeTruthy();
    expect(getByTestId('shopping-promo-i1')).toBeTruthy();
    expect(getByText('Promocja: Biedronka')).toBeTruthy();
    // Per-line price + footer total (single priced line → both show the value).
    expect(getAllByText('4,50 zł').length).toBe(2);
    expect(getByText('Szacowany koszt:')).toBeTruthy();
  });

  it('shows the friendly empty state when there is no active list', async () => {
    mockGetShoppingList.mockResolvedValue(null);
    const { getByText } = render(<ShoppingScreen />);

    await waitFor(() =>
      expect(
        getByText('Brak listy zakupów — zatwierdź plan, aby ją wygenerować.'),
      ).toBeTruthy(),
    );
  });

  it('optimistically checks an item and calls updateShoppingItem(id, "bought")', async () => {
    const { getByLabelText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByLabelText('Ziemniaki')).toBeTruthy());
    const checkbox = getByLabelText('Ziemniaki');
    expect(checkbox.props.accessibilityState).toEqual({ checked: false });

    fireEvent.press(checkbox);

    // Optimistic: reflects checked immediately.
    expect(getByLabelText('Ziemniaki').props.accessibilityState).toEqual({ checked: true });
    expect(mockUpdateShoppingItem).toHaveBeenCalledWith('i1', 'bought', undefined);
  });

  it('marks an item not found via the per-row action', async () => {
    const { getByLabelText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByLabelText('Ziemniaki')).toBeTruthy());
    fireEvent.press(getByLabelText('Nie znaleziono: Ziemniaki'));

    expect(mockUpdateShoppingItem).toHaveBeenCalledWith('i1', 'not_found', undefined);
  });

  it('renders the celebration when every item is already bought', async () => {
    mockGetShoppingList.mockResolvedValue(
      makeList(sampleItems.map((it) => ({ ...it, status: 'bought' as ItemStatus }))),
    );
    const { getByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Wszystko kupione! 🎉')).toBeTruthy());
    expect(getByText('Udostępnij listę')).toBeTruthy();
    expect(getByText('Rozpocznij nowy tydzień')).toBeTruthy();
  });

  it('transitions to celebration after checking the last remaining item', async () => {
    mockGetShoppingList.mockResolvedValue(
      makeList([
        makeItem({ id: 'i1', name: 'Ziemniaki', status: 'bought' }),
        makeItem({ id: 'i2', name: 'Mleko', status: 'bought' }),
        makeItem({ id: 'i3', name: 'Schab', status: 'pending' }),
      ]),
    );
    const { getByLabelText, getByText, queryByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByLabelText('Schab')).toBeTruthy());
    expect(queryByText('Wszystko kupione! 🎉')).toBeNull();

    fireEvent.press(getByLabelText('Schab'));

    await waitFor(() => expect(getByText('Wszystko kupione! 🎉')).toBeTruthy());
  });

  it('adds a custom item via "Dodaj ręcznie"', async () => {
    const { getByLabelText, getByText, queryByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Ziemniaki')).toBeTruthy());
    expect(queryByText('Masło')).toBeNull();

    fireEvent.press(getByLabelText('Dodaj ręcznie'));
    fireEvent.changeText(getByLabelText('Nazwa produktu'), 'Masło');
    fireEvent.press(getByText('Dodaj'));

    // Optimistic append renders the new row immediately.
    await waitFor(() => expect(getByText('Masło')).toBeTruthy());
    // A category is sent (defaults to "Inne" unless the user picks one).
    expect(mockAddShoppingItem).toHaveBeenCalledWith('sl1', { name: 'Masło', category: 'Inne' });
  });

  it('lets the user pick a category for a manually added item', async () => {
    const { getByLabelText, getByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Ziemniaki')).toBeTruthy());

    fireEvent.press(getByLabelText('Dodaj ręcznie'));
    fireEvent.changeText(getByLabelText('Nazwa produktu'), 'Marchew');
    fireEvent.press(getByLabelText('Kategoria: Warzywa'));
    fireEvent.press(getByText('Dodaj'));

    await waitFor(() =>
      expect(mockAddShoppingItem).toHaveBeenCalledWith('sl1', {
        name: 'Marchew',
        category: 'Warzywa',
      }),
    );
  });

  it('deletes a row via the per-item delete action', async () => {
    const { getByLabelText, getByText } = render(<ShoppingScreen />);

    await waitFor(() => expect(getByText('Ziemniaki')).toBeTruthy());
    fireEvent.press(getByLabelText('Usuń: Ziemniaki'));

    // Optimistically removed from the list.
    await waitFor(() => expect(() => getByText('Ziemniaki')).toThrow());
    expect(mockDeleteShoppingItem).toHaveBeenCalledWith('i1');
  });
});
