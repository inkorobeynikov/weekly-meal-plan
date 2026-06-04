import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { FamilyResponse, Recipe } from '../lib/api';

// --- mocks -------------------------------------------------------------------

let mockRouteParams: Record<string, string> = { id: 'r1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: (): Record<string, string> => mockRouteParams,
}));

const mockGetRecipe: jest.Mock<Promise<Recipe>, [string]> = jest.fn();
const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
jest.mock('../lib/api', () => ({
  getRecipe: (id: string): Promise<Recipe> => mockGetRecipe(id),
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
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
});
