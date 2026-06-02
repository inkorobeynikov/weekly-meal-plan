import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  FamilyResponse,
  FamilyPreferences,
  UpdatePreferencesInput,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------

const mockReplace: jest.Mock<void, [string]> = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string): void => mockReplace(path) },
}));

const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
const mockUpdatePreferences: jest.Mock<Promise<FamilyPreferences>, [UpdatePreferencesInput]> =
  jest.fn();
jest.mock('../lib/api', () => ({
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
  updatePreferences: (data: UpdatePreferencesInput): Promise<FamilyPreferences> =>
    mockUpdatePreferences(data),
}));

const mockSetOnboardingComplete: jest.Mock<Promise<void>, []> = jest.fn();
jest.mock('../lib/onboarding', () => ({
  isOnboardingComplete: (): Promise<boolean> => Promise.resolve(false),
  setOnboardingComplete: (): Promise<void> => mockSetOnboardingComplete(),
}));

// expo-secure-store is mocked globally in jest.setup.ts, but re-declare here so
// this test is self-contained per the task spec.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: (key: string): Promise<string | null> =>
      Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItemAsync: (key: string, value: string): Promise<void> => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string): Promise<void> => {
      store.delete(key);
      return Promise.resolve();
    },
  };
});

import Onboarding from '../../app/onboarding/index';

// --- fixtures ----------------------------------------------------------------

const emptyPrefs: FamilyPreferences = {
  id: 'p1',
  householdId: 'h1',
  likes: [],
  dislikes: [],
  hardRestrictions: [],
  allergies: [],
  preferredCuisines: [],
  typicalBreakfasts: [],
  cookingTimeWeekdayMinutes: 30,
  budgetMode: 'normal',
  varietyMode: 'balanced',
  stores: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const family: FamilyResponse = {
  household: {
    id: 'h1',
    name: '',
    locale: 'pl-PL',
    country: 'PL',
    timezone: 'Europe/Warsaw',
    telegramChatId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  members: [],
  preferences: null,
};

beforeEach(() => {
  mockReplace.mockReset();
  mockGetHousehold.mockReset().mockResolvedValue(family);
  mockUpdatePreferences.mockReset().mockResolvedValue(emptyPrefs);
  mockSetOnboardingComplete.mockReset().mockResolvedValue(undefined);
});

// --- tests -------------------------------------------------------------------

describe('Onboarding (W06)', () => {
  it('renders step 1 name question and advances to step 2 on "Dalej"', async () => {
    const { getByText, queryByText } = render(<Onboarding />);

    await waitFor(() => expect(getByText('Jak masz na imię?')).toBeTruthy());
    expect(queryByText('Ile osób w rodzinie?')).toBeNull();

    fireEvent.press(getByText('Dalej'));

    expect(getByText('Ile osób w rodzinie?')).toBeTruthy();
  });

  it('toggles an allergy chip on and off', async () => {
    const { getByText, getByLabelText } = render(<Onboarding />);

    await waitFor(() => expect(getByText('Jak masz na imię?')).toBeTruthy());
    // Skip straight to step 3.
    fireEvent.press(getByText('Pomiń'));
    expect(getByText('Czy ktoś ma alergie?')).toBeTruthy();

    const gluten = getByLabelText('Gluten');
    expect(gluten.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(gluten);
    expect(getByLabelText('Gluten').props.accessibilityState).toEqual({ selected: true });

    fireEvent.press(getByLabelText('Gluten'));
    expect(getByLabelText('Gluten').props.accessibilityState).toEqual({ selected: false });
  });

  it('"Zakończ" persists selected constraints and marks onboarding complete', async () => {
    const { getByText, getByLabelText } = render(<Onboarding />);

    await waitFor(() => expect(getByText('Jak masz na imię?')).toBeTruthy());
    fireEvent.press(getByText('Pomiń'));

    fireEvent.press(getByLabelText('Gluten'));
    fireEvent.press(getByLabelText('Laktoza'));
    fireEvent.press(getByLabelText('Wegetariańskie'));

    fireEvent.press(getByText('Zakończ'));

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledTimes(1));

    const arg = mockUpdatePreferences.mock.calls[0]?.[0];
    expect(arg?.allergies).toEqual(['Gluten', 'Laktoza']);
    expect(arg?.hardRestrictions).toEqual(['Wegetariańskie']);

    await waitFor(() => expect(mockSetOnboardingComplete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/plan'));
  });
});
