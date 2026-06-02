import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  FamilyResponse,
  FamilyPreferences,
  UpdatePreferencesInput,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
const mockUpdatePreferences: jest.Mock<Promise<FamilyPreferences>, [UpdatePreferencesInput]> =
  jest.fn();
const mockApiFetch: jest.Mock<Promise<unknown>, [string, unknown]> = jest.fn();

jest.mock('../lib/api', () => ({
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
  updatePreferences: (data: UpdatePreferencesInput): Promise<FamilyPreferences> =>
    mockUpdatePreferences(data),
  apiFetch: (path: string, options: unknown): Promise<unknown> => mockApiFetch(path, options),
}));

import FamilyScreen from '../../app/(tabs)/family/index';

// --- fixtures ----------------------------------------------------------------

const prefs: FamilyPreferences = {
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
    name: 'Kowalscy',
    locale: 'pl-PL',
    country: 'PL',
    timezone: 'Europe/Warsaw',
    telegramChatId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  members: [
    {
      id: 'm1',
      householdId: 'h1',
      displayName: 'Anna',
      role: 'adult',
      approximateAgeGroup: 'adult',
      mealsAtHome: { breakfast: true, lunch: true, dinner: true },
      telegramUserId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  preferences: prefs,
};

beforeEach(() => {
  mockGetHousehold.mockReset().mockResolvedValue(family);
  mockUpdatePreferences.mockReset().mockResolvedValue(prefs);
  mockApiFetch.mockReset().mockResolvedValue(undefined);
});

// --- tests -------------------------------------------------------------------

describe('FamilyScreen (W05)', () => {
  it('toggles an allergy chip and reflects the selected state', async () => {
    const { getByLabelText } = render(<FamilyScreen />);

    await waitFor(() => expect(getByLabelText('Gluten')).toBeTruthy());

    expect(getByLabelText('Gluten').props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(getByLabelText('Gluten'));

    expect(getByLabelText('Gluten').props.accessibilityState).toEqual({ selected: true });
  });

  it('renders the cooking-time control options', async () => {
    const { getByLabelText } = render(<FamilyScreen />);

    await waitFor(() => expect(getByLabelText('15 minut')).toBeTruthy());
    expect(getByLabelText('30 minut')).toBeTruthy();
    expect(getByLabelText('45 minut')).toBeTruthy();
    expect(getByLabelText('60 minut')).toBeTruthy();
  });

  it('auto-saves once, debounced 800ms after the last change', async () => {
    jest.useFakeTimers();
    try {
      const { getByLabelText } = render(<FamilyScreen />);

      // Resolve the initial getHousehold() under fake timers.
      await waitFor(() => expect(mockGetHousehold).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(getByLabelText('Gluten')).toBeTruthy());

      fireEvent.press(getByLabelText('Gluten'));
      // Before the debounce window elapses, no save has fired.
      act(() => {
        jest.advanceTimersByTime(700);
      });
      expect(mockUpdatePreferences).not.toHaveBeenCalled();

      // A second change resets the timer; only one save should follow.
      fireEvent.press(getByLabelText('Laktoza'));
      // Flush the timer, then let the async save promise settle inside act so
      // the trailing setSaveStatus state update is not reported as un-acted.
      await act(async () => {
        jest.advanceTimersByTime(800);
        await Promise.resolve();
      });

      expect(mockUpdatePreferences).toHaveBeenCalledTimes(1);
      const arg = mockUpdatePreferences.mock.calls[0]?.[0];
      expect(arg?.allergies).toEqual(['Gluten', 'Laktoza']);
    } finally {
      jest.useRealTimers();
    }
  });
});
