import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { CookbookEntry, FamilyCookbook, Recipe } from '../lib/api';

// --- mocks -------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (args: unknown): void => mockPush(args) },
}));

const mockGetFamilyCookbook: jest.Mock<Promise<FamilyCookbook>, []> = jest.fn();
const mockSetRecipeFavorite: jest.Mock<Promise<{ isFavorite: boolean }>, [string, boolean]> =
  jest.fn();
const mockRequestRecipeForNextPlan: jest.Mock<Promise<{ requested: boolean }>, [string]> =
  jest.fn();
jest.mock('../lib/api', () => ({
  getFamilyCookbook: (): Promise<FamilyCookbook> => mockGetFamilyCookbook(),
  setRecipeFavorite: (recipeId: string, favorite: boolean): Promise<{ isFavorite: boolean }> =>
    mockSetRecipeFavorite(recipeId, favorite),
  requestRecipeForNextPlan: (recipeId: string): Promise<{ requested: boolean }> =>
    mockRequestRecipeForNextPlan(recipeId),
}));

import RecipesScreen from '../../app/(tabs)/recipes/index';

// --- fixtures ----------------------------------------------------------------

function makeRecipe(id: string, title: string): Recipe {
  return {
    id,
    householdId: null,
    title,
    source: 'imported',
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
    isTryNew: null,
    priceEstimateGrosze: null,
    validationStatus: 'valid',
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeEntry(
  id: string,
  title: string,
  overrides: Partial<Omit<CookbookEntry, 'recipe'>> = {},
): CookbookEntry {
  return {
    recipe: makeRecipe(id, title),
    lastCookedAt: null,
    timesPlanned: 1,
    reactions: [],
    isFavorite: false,
    isRequested: false,
    ...overrides,
  };
}

const favorite = makeEntry('r1', 'Pierogi ruskie', {
  isFavorite: true,
  reactions: ['favorite'],
  lastCookedAt: '2026-06-08T00:00:00.000Z',
});
const cooked = makeEntry('r2', 'Rosół z makaronem', {
  lastCookedAt: '2026-06-10T00:00:00.000Z',
});
const planned = makeEntry('r3', 'Naleśniki z serem', { timesPlanned: 3 });

const fullCookbook: FamilyCookbook = {
  favorites: [favorite],
  recentlyCooked: [cooked, favorite],
  all: [cooked, favorite, planned],
};

beforeEach(() => {
  mockPush.mockReset();
  mockGetFamilyCookbook.mockReset().mockResolvedValue(fullCookbook);
  mockSetRecipeFavorite.mockReset().mockResolvedValue({ isFavorite: true });
  mockRequestRecipeForNextPlan.mockReset().mockResolvedValue({ requested: true });
});

describe('Przepisy — family cookbook (PR-4)', () => {
  it('renders the three sections from the cookbook', async () => {
    const { getByText } = render(<RecipesScreen />);

    await waitFor(() => expect(getByText('Ulubione')).toBeTruthy());
    expect(getByText('Ostatnio gotowane')).toBeTruthy();
    expect(getByText('Wszystkie wasze dania')).toBeTruthy();
    // The favorite dish appears (it is in multiple sections).
    expect(getByText('Naleśniki z serem')).toBeTruthy();
  });

  it('shows the new-household empty state when nothing has been cooked', async () => {
    mockGetFamilyCookbook.mockResolvedValue({
      favorites: [],
      recentlyCooked: [],
      all: [],
    });

    const { getByText, queryByText } = render(<RecipesScreen />);

    await waitFor(() =>
      expect(getByText('Twoje dania pojawią się tu po pierwszym planie.')).toBeTruthy(),
    );
    expect(queryByText('Wszystkie wasze dania')).toBeNull();
  });

  it('filters the family recipes by the search query', async () => {
    const { getByTestId, getByText, queryByText } = render(<RecipesScreen />);

    await waitFor(() => expect(getByText('Wszystkie wasze dania')).toBeTruthy());

    fireEvent.changeText(getByTestId('recipes-search'), 'rosół');

    // Only the matching dish + the "Wyniki" header remain.
    await waitFor(() => expect(getByText('Wyniki')).toBeTruthy());
    expect(getByText('Rosół z makaronem')).toBeTruthy();
    expect(queryByText('Naleśniki z serem')).toBeNull();
    expect(queryByText('Ulubione')).toBeNull();
  });

  it('toggles a favorite from a cookbook card', async () => {
    const { getByTestId } = render(<RecipesScreen />);

    await waitFor(() => expect(getByTestId('cookbook-favorite-r3')).toBeTruthy());
    fireEvent.press(getByTestId('cookbook-favorite-r3'));

    await waitFor(() =>
      expect(mockSetRecipeFavorite).toHaveBeenCalledWith('r3', true),
    );
  });

  it('queues a recipe for the next plan from a cookbook card', async () => {
    const { getByTestId, getByText } = render(<RecipesScreen />);

    await waitFor(() => expect(getByTestId('cookbook-add-r3')).toBeTruthy());
    fireEvent.press(getByTestId('cookbook-add-r3'));

    await waitFor(() =>
      expect(mockRequestRecipeForNextPlan).toHaveBeenCalledWith('r3'),
    );
    // The card flips to the already-requested state.
    await waitFor(() => expect(getByText('W następnym planie ✓')).toBeTruthy());
  });

  it('opens recipe detail within the recipes stack on card tap', async () => {
    const { getByLabelText } = render(<RecipesScreen />);

    await waitFor(() => expect(getByLabelText('Naleśniki z serem')).toBeTruthy());
    fireEvent.press(getByLabelText('Naleśniki z serem'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/recipes/recipe/[id]',
      params: { id: 'r3' },
    });
  });
});
