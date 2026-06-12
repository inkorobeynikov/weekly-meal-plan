import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  CreateMemberInput,
  FamilyResponse,
  FamilyPreferences,
  HouseholdMember,
  UpdateMemberInput,
  UpdatePreferencesInput,
} from '../lib/api';

// --- mocks -------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

const mockGetHousehold: jest.Mock<Promise<FamilyResponse>, []> = jest.fn();
const mockUpdatePreferences: jest.Mock<Promise<FamilyPreferences>, [UpdatePreferencesInput]> =
  jest.fn();
const mockCreateMember: jest.Mock<Promise<HouseholdMember>, [CreateMemberInput]> = jest.fn();
const mockUpdateMember: jest.Mock<Promise<HouseholdMember>, [string, UpdateMemberInput]> =
  jest.fn();
const mockDeleteMember: jest.Mock<Promise<{ ok: true }>, [string]> = jest.fn();

jest.mock('../lib/api', () => ({
  getHousehold: (): Promise<FamilyResponse> => mockGetHousehold(),
  updatePreferences: (data: UpdatePreferencesInput): Promise<FamilyPreferences> =>
    mockUpdatePreferences(data),
  createMember: (data: CreateMemberInput): Promise<HouseholdMember> => mockCreateMember(data),
  updateMember: (id: string, data: UpdateMemberInput): Promise<HouseholdMember> =>
    mockUpdateMember(id, data),
  deleteMember: (id: string): Promise<{ ok: true }> => mockDeleteMember(id),
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
    memberCount: null,
    onboardingCompletedAt: null,
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
  mockCreateMember.mockReset();
  mockUpdateMember.mockReset();
  mockDeleteMember.mockReset().mockResolvedValue({ ok: true });
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

  it('adds a member via the real create route and appends the returned row', async () => {
    const created: HouseholdMember = {
      id: 'm2',
      householdId: 'h1',
      displayName: 'Bartek',
      role: 'adult',
      approximateAgeGroup: 'adult',
      mealsAtHome: { breakfast: true, lunch: true, dinner: true },
      telegramUserId: null,
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    mockCreateMember.mockResolvedValueOnce(created);

    const { getByText, getByLabelText, getByPlaceholderText } = render(<FamilyScreen />);
    await waitFor(() => expect(getByText('Anna')).toBeTruthy());

    fireEvent.press(getByLabelText('Dodaj członka rodziny'));
    fireEvent.changeText(getByPlaceholderText('Imię domownika'), 'Bartek');
    fireEvent.press(getByText('Dodaj'));

    await waitFor(() => expect(mockCreateMember).toHaveBeenCalledTimes(1));
    expect(mockCreateMember.mock.calls[0]?.[0]).toEqual({
      displayName: 'Bartek',
      approximateAgeGroup: 'adult',
    });
    await waitFor(() => expect(getByText('Bartek')).toBeTruthy());
  });

  it('surfaces an error instead of silently dropping the member when create fails', async () => {
    mockCreateMember.mockRejectedValueOnce(new Error('no route'));

    const { getByText, getByLabelText, getByPlaceholderText, queryByText, getByTestId } = render(
      <FamilyScreen />,
    );
    await waitFor(() => expect(getByText('Anna')).toBeTruthy());

    fireEvent.press(getByLabelText('Dodaj członka rodziny'));
    fireEvent.changeText(getByPlaceholderText('Imię domownika'), 'Bartek');
    fireEvent.press(getByText('Dodaj'));

    await waitFor(() => expect(getByTestId('family-member-error')).toBeTruthy());
    // The member was never optimistically rendered, so it is not present.
    expect(queryByText('Bartek')).toBeNull();
  });

  it('removes a member through the delete route', async () => {
    const { getByText, getByLabelText, queryByText } = render(<FamilyScreen />);
    await waitFor(() => expect(getByText('Anna')).toBeTruthy());

    fireEvent.press(getByLabelText('Usuń Anna'));

    await waitFor(() => expect(mockDeleteMember).toHaveBeenCalledWith('m1'));
    await waitFor(() => expect(queryByText('Anna')).toBeNull());
  });

  it('toggles "eats at home" (mealsAtHome) for a member via updateMember', async () => {
    mockUpdateMember.mockImplementationOnce((id, data) =>
      Promise.resolve({
        ...family.members[0]!,
        ...('mealsAtHome' in data ? { mealsAtHome: data.mealsAtHome! } : {}),
      }),
    );

    const { getByText, getByTestId } = render(<FamilyScreen />);
    await waitFor(() => expect(getByText('Anna')).toBeTruthy());

    fireEvent.press(getByTestId('family-meal-m1-breakfast'));

    await waitFor(() => expect(mockUpdateMember).toHaveBeenCalledTimes(1));
    expect(mockUpdateMember.mock.calls[0]?.[0]).toBe('m1');
    expect(mockUpdateMember.mock.calls[0]?.[1]).toEqual({
      mealsAtHome: { breakfast: false, lunch: true, dinner: true },
    });
  });

  it('renders custom (free-text) restrictions and removes them on tap', async () => {
    mockGetHousehold.mockReset().mockResolvedValue({
      ...family,
      preferences: { ...prefs, hardRestrictions: ['Wegetariańskie', 'Bez cukru'] },
    });

    const { getByText, getByTestId, queryByLabelText } = render(<FamilyScreen />);
    await waitFor(() => expect(getByText('Anna')).toBeTruthy());

    // The custom one renders as a removable chip; the canonical one as a normal chip.
    const customChip = getByTestId('family-custom-restriction-Bez cukru');
    expect(customChip).toBeTruthy();

    fireEvent.press(customChip);
    await waitFor(() =>
      expect(queryByLabelText('Usuń ograniczenie Bez cukru')).toBeNull(),
    );
  });
});
