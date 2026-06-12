import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { FamilyResponse, Recipe } from '../lib/api';

// --- mocks -------------------------------------------------------------------

let mockRouteParams: Record<string, string> = { id: 'r1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: (): Record<string, string> => mockRouteParams,
}));

const mockGetRecipe: jest.Mock<Promise<Recipe>, [string]> = jest.fn();
const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
const mockMarkMealCooked: jest.Mock<Promise<{ updated: number }>, [string, string, boolean]> =
  jest.fn();
jest.mock('../lib/api', () => ({
  getRecipe: (id: string): Promise<Recipe> => mockGetRecipe(id),
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
  markMealCooked: (planId: string, recipeId: string, cooked: boolean): Promise<{ updated: number }> =>
    mockMarkMealCooked(planId, recipeId, cooked),
}));

// Mock the sibling swap sheet so this test does not depend on its impl.
jest.mock('../components/RecipeSwapSheet', () => ({
  RecipeSwapSheet: (): null => null,
}));

import RecipeDetailScreen from '../../app/(tabs)/plan/recipe/[id]';

// --- fixtures ----------------------------------------------------------------

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    householdId: 'h1',
    title: 'Łosoś pieczony',
    source: 'ai_generated',
    servings: 4,
    timeMinutes: 25,
    difficulty: 'easy',
    ingredientsJson: [
      { name: 'Łosoś', quantity: 400, unit: 'g' },
      { name: 'Cytryna', quantity: 1, unit: 'szt' },
    ],
    stepsJson: ['Rozgrzej piekarnik.', 'Piecz 20 minut.'],
    substitutionsJson: [{ original: 'mleko', substitute: 'mleko owsiane' }],
    leftoversNotes: null,
    storageNotes: null,
    childFriendlyNotes: null,
    allergenNotes: null,
    costLevel: 'moderate',
    isTryNew: false,
    priceEstimateGrosze: null,
    validationStatus: 'valid',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFamily(allergies: string[]): FamilyResponse {
  return {
    household: {
      id: 'h1',
      name: 'Rodzina',
      locale: 'pl',
      country: 'PL',
      timezone: 'Europe/Warsaw',
      memberCount: null,
      onboardingCompletedAt: null,
      telegramChatId: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    members: [],
    preferences:
      allergies.length === 0
        ? null
        : {
            id: 'pref1',
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
  mockRouteParams = { id: 'r1' };
  mockGetRecipe.mockReset();
  mockGetHousehold.mockReset();
  mockMarkMealCooked.mockReset().mockResolvedValue({ updated: 1 });
});

describe('W02 Recipe Detail', () => {
  it('shows the green "Bezpieczne" badge when there is no allergy conflict', async () => {
    // Recipe contains fish; household has NO allergies → safe.
    mockGetRecipe.mockResolvedValue(makeRecipe());
    mockGetHousehold.mockResolvedValue(makeFamily([]));

    const { getByText } = render(<RecipeDetailScreen />);

    await waitFor(() => {
      expect(getByText('Bezpieczne dla rodziny ✓')).toBeTruthy();
    });
  });

  it('shows a red allergy warning when a household allergen is present in the recipe', async () => {
    // Recipe contains "Łosoś"/fish; household is allergic to "Ryby" → conflict.
    mockGetRecipe.mockResolvedValue(makeRecipe());
    mockGetHousehold.mockResolvedValue(makeFamily(['Ryby']));

    const { getByText, queryByText } = render(<RecipeDetailScreen />);

    await waitFor(() => {
      expect(getByText(/Uwaga na alergeny/)).toBeTruthy();
    });
    // Matched allergen named.
    expect(getByText(/Ryby/)).toBeTruthy();
    // The safe badge must NOT be shown.
    expect(queryByText('Bezpieczne dla rodziny ✓')).toBeNull();
  });

  it('switches between Składniki / Kroki / Zamienniki tabs', async () => {
    mockGetRecipe.mockResolvedValue(makeRecipe());
    mockGetHousehold.mockResolvedValue(makeFamily([]));

    const { getByText, queryByText } = render(<RecipeDetailScreen />);

    // Default tab = Składniki: ingredient name visible.
    await waitFor(() => {
      expect(getByText('Cytryna')).toBeTruthy();
    });
    expect(queryByText('Rozgrzej piekarnik.')).toBeNull();

    // Switch to Kroki: step text visible, ingredient gone.
    fireEvent.press(getByText('Kroki'));
    expect(getByText('Rozgrzej piekarnik.')).toBeTruthy();
    expect(queryByText('Cytryna')).toBeNull();

    // Switch to Zamienniki: substitution chip visible.
    fireEvent.press(getByText('Zamienniki'));
    expect(getByText('mleko → mleko owsiane')).toBeTruthy();
  });

  // F4 W02: collapsible storage / for-kids sections appear when the recipe
  // carries those notes, and start collapsed (body hidden until tapped).
  it('renders collapsible storage / for-kids sections that expand on tap', async () => {
    mockGetRecipe.mockResolvedValue(
      makeRecipe({
        storageNotes: 'Przechowuj w lodówce do 2 dni.',
        childFriendlyNotes: 'Podawaj bez ostrych przypraw.',
      }),
    );
    mockGetHousehold.mockResolvedValue(makeFamily([]));

    const { getByText, queryByText, getByTestId } = render(<RecipeDetailScreen />);

    await waitFor(() => expect(getByText('Przechowywanie')).toBeTruthy());
    // Bodies are collapsed initially.
    expect(queryByText('Przechowuj w lodówce do 2 dni.')).toBeNull();

    fireEvent.press(getByTestId('recipe-section-storage-header'));
    expect(getByText('Przechowuj w lodówce do 2 dni.')).toBeTruthy();
  });

  // F4 W02: "mark cooked" is only offered with plan context (planId param); it
  // calls markMealCooked and flips the label.
  it('marks the dish cooked when plan context is present', async () => {
    mockRouteParams = { id: 'r1', planId: 'plan-1', mealId: 'meal-1' };
    mockGetRecipe.mockResolvedValue(makeRecipe());
    mockGetHousehold.mockResolvedValue(makeFamily([]));

    const { getByTestId, getByText } = render(<RecipeDetailScreen />);

    await waitFor(() => expect(getByTestId('recipe-mark-cooked')).toBeTruthy());
    fireEvent.press(getByTestId('recipe-mark-cooked'));

    await waitFor(() =>
      expect(mockMarkMealCooked).toHaveBeenCalledWith('plan-1', 'r1', true),
    );
    await waitFor(() => expect(getByText('Ugotowane ✓')).toBeTruthy());
  });

  it('hides the "mark cooked" action without plan context', async () => {
    mockGetRecipe.mockResolvedValue(makeRecipe());
    mockGetHousehold.mockResolvedValue(makeFamily([]));

    const { queryByTestId, getByText } = render(<RecipeDetailScreen />);

    await waitFor(() => expect(getByText('Łosoś pieczony')).toBeTruthy());
    expect(queryByTestId('recipe-mark-cooked')).toBeNull();
  });
});
