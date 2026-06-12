import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Avatar,
  Badge,
  Button,
  Card,
  SectionHeader,
  SkeletonBlock,
  fontSize,
  radii,
  spacing,
  tokens,
  type AccentTone,
} from '@meal-planner/ui-native';
import type { AgeGroup, BudgetMode } from '@meal-planner/shared';

import {
  createMember,
  deleteMember,
  getHousehold,
  updateMember,
  updatePreferences,
  type FamilyResponse,
  type FamilyPreferences,
  type HouseholdMember,
  type UpdatePreferencesInput,
} from '../../../src/lib/api';
import type { MealsAtHome } from '@meal-planner/shared';

// ---------------------------------------------------------------------------
// W05 — Family Preferences.
//
// Family members list + household preference editor. All preference edits are
// kept in LOCAL state and auto-saved (debounced 800ms) via updatePreferences.
//
// HARD CONSTRAINTS: allergies and hardRestrictions are passed through verbatim
// to the API — they are never altered, deduplicated away, or dropped, because
// downstream plan generation must honour them exactly.
// ---------------------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 800;

const ALLERGENS: readonly string[] = [
  'Orzechy',
  'Gluten',
  'Laktoza',
  'Jajka',
  'Ryby',
  'Owoce morza',
  'Soja',
  'Sezam',
];

const RESTRICTIONS: readonly string[] = [
  'Wegetariańskie',
  'Wegańskie',
  'Halal',
  'Koszerne',
];

interface MealSlotOption {
  readonly slot: keyof MealsAtHome;
  readonly label: string;
}
// The three meal slots a member can eat at home (W05 "eats at home" toggles).
const MEAL_SLOTS: readonly MealSlotOption[] = [
  { slot: 'breakfast', label: 'Śniadanie' },
  { slot: 'lunch', label: 'Obiad' },
  { slot: 'dinner', label: 'Kolacja' },
];

const CUISINES: readonly string[] = [
  'Polska',
  'Włoska',
  'Azjatycka',
  'Meksykańska',
  'Śródziemnomorska',
];

const COOKING_TIME_OPTIONS: readonly number[] = [15, 30, 45, 60];

interface BudgetOption {
  readonly mode: BudgetMode;
  readonly label: string;
}
const BUDGET_OPTIONS: readonly BudgetOption[] = [
  { mode: 'economical', label: 'Ekonomiczny' },
  { mode: 'normal', label: 'Standard' },
  { mode: 'flexible', label: 'Premium' },
];

interface AgeGroupOption {
  readonly group: AgeGroup;
  readonly label: string;
}
// Age groups collapse into three Polish chips. child_0_3 reads as "Niemowlę",
// the remaining child/teen groups as "Dziecko", adults as "Dorosły".
const AGE_GROUP_OPTIONS: readonly AgeGroupOption[] = [
  { group: 'child_0_3', label: 'Niemowlę' },
  { group: 'child_4_7', label: 'Dziecko' },
  { group: 'adult', label: 'Dorosły' },
];

function ageGroupLabel(group: AgeGroup): string {
  if (group === 'child_0_3') return 'Niemowlę';
  if (group === 'adult') return 'Dorosły';
  return 'Dziecko';
}

function ageGroupTone(group: AgeGroup): AccentTone {
  if (group === 'child_0_3') return 'plum';
  if (group === 'adult') return 'sage';
  return 'amber';
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Locally tracked editable preferences (the subset W05 edits).
interface PrefsState {
  allergies: string[];
  hardRestrictions: string[];
  preferredCuisines: string[];
  cookingTimeWeekdayMinutes: number;
  budgetMode: BudgetMode;
}

const DEFAULT_PREFS: PrefsState = {
  allergies: [],
  hardRestrictions: [],
  preferredCuisines: [],
  cookingTimeWeekdayMinutes: 30,
  budgetMode: 'normal',
};

function prefsFrom(p: FamilyPreferences | null): PrefsState {
  if (!p) return DEFAULT_PREFS;
  return {
    allergies: p.allergies,
    hardRestrictions: p.hardRestrictions,
    preferredCuisines: p.preferredCuisines,
    cookingTimeWeekdayMinutes: p.cookingTimeWeekdayMinutes,
    budgetMode: p.budgetMode,
  };
}

// --- selectable chip ---------------------------------------------------------

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextOn : styles.chipTextOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function FamilyScreen(): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULT_PREFS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Add-member inline form.
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newAge, setNewAge] = useState<AgeGroup>('adult');
  const [savingMember, setSavingMember] = useState<boolean>(false);
  // Surfaced to the user when a member create/edit/remove fails, instead of a
  // silent optimistic rollback.
  const [memberError, setMemberError] = useState<string | null>(null);

  // Debounce bookkeeping. We hold the latest prefs in a ref so the timer always
  // flushes the freshest snapshot, and clear any pending timer on unmount.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPrefs = useRef<PrefsState>(DEFAULT_PREFS);
  const dirty = useRef<boolean>(false);

  useEffect(() => {
    latestPrefs.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const family: FamilyResponse = await getHousehold();
        if (cancelled) return;
        setHouseholdId(family.household.id);
        setMembers(family.members);
        const loaded = prefsFrom(family.preferences);
        setPrefs(loaded);
        latestPrefs.current = loaded;
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear the pending debounce timer when the screen unmounts.
  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, []);

  const flushSave = useCallback(async () => {
    const snapshot = latestPrefs.current;
    setSaveStatus('saving');
    try {
      // HARD CONSTRAINTS: allergies + hardRestrictions are sent exactly as the
      // user selected them. Only fields supported by UpdatePreferencesInput are
      // included.
      const payload: UpdatePreferencesInput = {
        allergies: snapshot.allergies,
        hardRestrictions: snapshot.hardRestrictions,
        preferredCuisines: snapshot.preferredCuisines,
        cookingTimeWeekdayMinutes: snapshot.cookingTimeWeekdayMinutes,
        budgetMode: snapshot.budgetMode,
      };
      await updatePreferences(payload);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, []);

  // Schedule a debounced save. Called by every preference mutation.
  const scheduleSave = useCallback(() => {
    dirty.current = true;
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const mutatePrefs = useCallback(
    (next: (prev: PrefsState) => PrefsState) => {
      setPrefs((prev) => {
        const updated = next(prev);
        latestPrefs.current = updated;
        return updated;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const toggleAllergy = useCallback(
    (value: string) => {
      mutatePrefs((prev) => ({ ...prev, allergies: toggle(prev.allergies, value) }));
    },
    [mutatePrefs],
  );

  const toggleRestriction = useCallback(
    (value: string) => {
      mutatePrefs((prev) => ({
        ...prev,
        hardRestrictions: toggle(prev.hardRestrictions, value),
      }));
    },
    [mutatePrefs],
  );

  const toggleCuisine = useCallback(
    (value: string) => {
      mutatePrefs((prev) => ({
        ...prev,
        preferredCuisines: toggle(prev.preferredCuisines, value),
      }));
    },
    [mutatePrefs],
  );

  const setCookingTime = useCallback(
    (minutes: number) => {
      mutatePrefs((prev) => ({ ...prev, cookingTimeWeekdayMinutes: minutes }));
    },
    [mutatePrefs],
  );

  const setBudget = useCallback(
    (mode: BudgetMode) => {
      mutatePrefs((prev) => ({ ...prev, budgetMode: mode }));
    },
    [mutatePrefs],
  );

  const addMember = useCallback(async () => {
    const name = newName.trim();
    if (name.length === 0 || householdId === null || savingMember) return;

    setSavingMember(true);
    setMemberError(null);
    try {
      // Create on the server FIRST, then append the real row. No optimistic
      // placeholder: previously the row appeared then vanished when the request
      // failed against a non-existent route. The age group drives the role.
      const created = await createMember({
        displayName: name,
        approximateAgeGroup: newAge,
      });
      setMembers((prev) => [...prev, created]);
      setNewName('');
      setNewAge('adult');
      setAddOpen(false);
    } catch {
      // Surface the failure instead of silently dropping the member.
      setMemberError('Nie udało się dodać domownika. Spróbuj ponownie.');
    } finally {
      setSavingMember(false);
    }
  }, [newName, newAge, householdId, savingMember]);

  // Remove a member. Optimistically drops the row, restoring it on failure and
  // surfacing the error so the deletion never silently fails.
  const removeMember = useCallback(
    async (member: HouseholdMember) => {
      setMemberError(null);
      const snapshot = member;
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      try {
        await deleteMember(member.id);
      } catch {
        setMembers((prev) =>
          prev.some((m) => m.id === snapshot.id) ? prev : [...prev, snapshot],
        );
        setMemberError('Nie udało się usunąć domownika. Spróbuj ponownie.');
      }
    },
    [],
  );

  // Toggle whether a member eats a given meal at home (mealsAtHome). Optimistic
  // with rollback + surfaced error.
  const toggleMealAtHome = useCallback(
    async (member: HouseholdMember, slot: keyof MealsAtHome) => {
      setMemberError(null);
      const nextMeals: MealsAtHome = {
        ...member.mealsAtHome,
        [slot]: !member.mealsAtHome[slot],
      };
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, mealsAtHome: nextMeals } : m)),
      );
      try {
        const updated = await updateMember(member.id, { mealsAtHome: nextMeals });
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } catch {
        // Roll back to the previous mealsAtHome on failure.
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, mealsAtHome: member.mealsAtHome } : m,
          ),
        );
        setMemberError('Nie udało się zapisać zmiany. Spróbuj ponownie.');
      }
    },
    [],
  );

  // Free-text restrictions the user added during onboarding (anything outside
  // the canonical RESTRICTIONS chip set). Rendered as removable chips so they're
  // visible and editable here.
  const customRestrictions = useMemo<string[]>(
    () => prefs.hardRestrictions.filter((r) => !RESTRICTIONS.includes(r)),
    [prefs.hardRestrictions],
  );

  const saveIndicator = useMemo<string | null>(() => {
    if (saveStatus === 'saving') return 'Zapisywanie…';
    if (saveStatus === 'saved') return 'Zapisano ✓';
    if (saveStatus === 'error') return 'Błąd zapisu — spróbuj ponownie';
    return null;
  }, [saveStatus]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <SkeletonBlock width={140} height={24} style={{ marginBottom: spacing.xl }} />
          <SkeletonBlock width="100%" height={64} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock width="100%" height={64} style={{ marginBottom: spacing.xl }} />
          <SkeletonBlock width="60%" height={18} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock width="100%" height={48} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={tokens.faint} />
          <Text style={styles.emptyTitle}>Nie udało się wczytać rodziny</Text>
          <Text style={styles.emptyText}>
            Sprawdź połączenie z internetem i spróbuj ponownie za chwilę.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <SectionHeader title="Rodzina" />
          {saveIndicator ? (
            <Text
              testID="family-save-status"
              style={[styles.saveBadge, saveStatus === 'error' ? styles.saveBadgeError : null]}
              accessibilityLabel={saveIndicator}
            >
              {saveIndicator}
            </Text>
          ) : null}
        </View>

        {/* --- Members ----------------------------------------------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Domownicy</Text>
          {members.length === 0 ? (
            <Text style={styles.helperText}>Nie dodano jeszcze żadnych domowników.</Text>
          ) : (
            members.map((m) => (
              <View key={m.id} style={styles.memberBlock}>
                <View style={styles.memberRow}>
                  <Avatar name={m.displayName} size="md" />
                  <Text style={styles.memberName}>{m.displayName}</Text>
                  <Badge
                    tone={ageGroupTone(m.approximateAgeGroup)}
                    label={ageGroupLabel(m.approximateAgeGroup)}
                  />
                  <Pressable
                    testID={`family-remove-${m.id}`}
                    onPress={() => void removeMember(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`Usuń ${m.displayName}`}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={tokens.terra} />
                  </Pressable>
                </View>
                {/* "Eats at home" toggles (mealsAtHome). */}
                <View style={styles.mealSlotRow}>
                  {MEAL_SLOTS.map((opt) => {
                    const on = m.mealsAtHome[opt.slot];
                    return (
                      <Pressable
                        key={opt.slot}
                        testID={`family-meal-${m.id}-${opt.slot}`}
                        onPress={() => void toggleMealAtHome(m, opt.slot)}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.label} w domu — ${m.displayName}`}
                        accessibilityState={{ selected: on }}
                        style={[styles.mealSlot, on ? styles.mealSlotOn : styles.mealSlotOff]}
                      >
                        <Text
                          style={[
                            styles.mealSlotText,
                            on ? styles.mealSlotTextOn : styles.mealSlotTextOff,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {memberError ? (
            <Text testID="family-member-error" style={styles.memberErrorText}>
              {memberError}
            </Text>
          ) : null}

          {addOpen ? (
            <View style={styles.addForm}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Imię domownika"
                placeholderTextColor={tokens.faint}
                style={styles.input}
                accessibilityLabel="Imię domownika"
                returnKeyType="done"
                onSubmitEditing={() => void addMember()}
              />
              <Text style={styles.label}>Grupa wiekowa</Text>
              <View style={styles.chipWrap}>
                {AGE_GROUP_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.group}
                    label={opt.label}
                    selected={newAge === opt.group}
                    onPress={() => setNewAge(opt.group)}
                  />
                ))}
              </View>
              <View style={styles.addActions}>
                <Button variant="secondary" size="sm" onPress={() => setAddOpen(false)}>
                  Anuluj
                </Button>
                <Button
                  size="sm"
                  onPress={() => void addMember()}
                  loading={savingMember}
                  disabled={newName.trim().length === 0 || savingMember}
                >
                  Dodaj
                </Button>
              </View>
            </View>
          ) : (
            <Pressable
              testID="family-add-member"
              onPress={() => setAddOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Dodaj członka rodziny"
              style={styles.addMemberBtn}
            >
              <Ionicons name="add-circle-outline" size={20} color={tokens.sageInk} />
              <Text style={styles.addMemberText}>Dodaj członka rodziny</Text>
            </Pressable>
          )}
        </Card>

        {/* --- Allergies (HARD CONSTRAINT) -------------------------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Alergie</Text>
          <Text style={styles.helperText}>
            Te składniki nigdy nie pojawią się w planie posiłków.
          </Text>
          <View style={styles.chipWrap}>
            {ALLERGENS.map((a) => (
              <Chip
                key={a}
                label={a}
                selected={prefs.allergies.includes(a)}
                onPress={() => toggleAllergy(a)}
              />
            ))}
          </View>
        </Card>

        {/* --- Restrictions (HARD CONSTRAINT) ----------------------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Ograniczenia</Text>
          <View style={styles.chipWrap}>
            {RESTRICTIONS.map((r) => (
              <Chip
                key={r}
                label={r}
                selected={prefs.hardRestrictions.includes(r)}
                onPress={() => toggleRestriction(r)}
              />
            ))}
            {/* Custom (free-text) restrictions added during onboarding — not in
                the canonical chip set. Always selected; tapping removes them.
                HARD CONSTRAINT: shown verbatim, never silently dropped. */}
            {customRestrictions.map((r) => (
              <Pressable
                key={r}
                testID={`family-custom-restriction-${r}`}
                onPress={() => toggleRestriction(r)}
                accessibilityRole="button"
                accessibilityLabel={`Usuń ograniczenie ${r}`}
                style={[styles.chip, styles.chipOn, styles.customChip]}
              >
                <Text style={[styles.chipText, styles.chipTextOn]}>{r}</Text>
                <Ionicons name="close" size={14} color={tokens.sageInk} />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* --- Cuisines --------------------------------------------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Ulubione kuchnie</Text>
          <View style={styles.chipWrap}>
            {CUISINES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={prefs.preferredCuisines.includes(c)}
                onPress={() => toggleCuisine(c)}
              />
            ))}
          </View>
        </Card>

        {/* --- Cooking time (segmented stepper, no slider dep) ------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Czas gotowania w tygodniu</Text>
          <Text style={styles.timeValue} accessibilityLabel={`Wybrany czas: ${prefs.cookingTimeWeekdayMinutes} minut`}>
            {prefs.cookingTimeWeekdayMinutes} min
          </Text>
          <View style={styles.segmentRow}>
            {COOKING_TIME_OPTIONS.map((minutes) => {
              const selected = prefs.cookingTimeWeekdayMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  testID={`family-cooking-${minutes}`}
                  onPress={() => setCookingTime(minutes)}
                  accessibilityRole="button"
                  accessibilityLabel={`${minutes} minut`}
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected ? styles.segmentOn : styles.segmentOff]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextOn : styles.segmentTextOff]}>
                    {minutes}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* --- Budget ----------------------------------------------------- */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Budżet</Text>
          <View style={styles.segmentRow}>
            {BUDGET_OPTIONS.map((opt) => {
              const selected = prefs.budgetMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  testID={`family-budget-${opt.mode}`}
                  onPress={() => setBudget(opt.mode)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected }}
                  style={[styles.segment, styles.segmentWide, selected ? styles.segmentOn : styles.segmentOff]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextOn : styles.segmentTextOff]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBadge: { fontSize: fontSize.xs, fontWeight: '700', color: tokens.sage },
  saveBadgeError: { color: tokens.terra },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: tokens.ink, textAlign: 'center' },
  emptyText: { fontSize: fontSize.base, color: tokens.muted, textAlign: 'center', lineHeight: 22 },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '700', color: tokens.ink },
  helperText: { fontSize: fontSize.sm, color: tokens.muted, lineHeight: 20 },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.ink2 },

  memberBlock: { paddingVertical: spacing.xs, gap: spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberName: { flex: 1, fontSize: fontSize.base, fontWeight: '600', color: tokens.ink },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mealSlotRow: { flexDirection: 'row', gap: spacing.sm, paddingLeft: 52 },
  mealSlot: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  mealSlotOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  mealSlotOff: { backgroundColor: tokens.surface, borderColor: tokens.line2 },
  mealSlotText: { fontSize: fontSize.xs, fontWeight: '700' },
  mealSlotTextOn: { color: tokens.sageInk },
  mealSlotTextOff: { color: tokens.muted },

  memberErrorText: { color: tokens.terra, fontSize: fontSize.sm, marginTop: spacing.xs },

  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  addMemberText: { fontSize: fontSize.base, fontWeight: '600', color: tokens.sageInk },

  addForm: { gap: spacing.md, marginTop: spacing.sm },
  addActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },

  input: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line2,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
    color: tokens.ink,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  chipOff: { backgroundColor: tokens.surface, borderColor: tokens.line2 },
  chipText: { fontSize: fontSize.sm, fontWeight: '600' },
  chipTextOn: { color: tokens.sageInk },
  chipTextOff: { color: tokens.ink2 },
  customChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  timeValue: { fontSize: fontSize.xl, fontWeight: '700', color: tokens.ink },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentWide: { paddingVertical: spacing.sm },
  segmentOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  segmentOff: { backgroundColor: tokens.surface, borderColor: tokens.line2 },
  segmentText: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
  segmentTextOn: { color: tokens.sageInk },
  segmentTextOff: { color: tokens.ink2 },
});
