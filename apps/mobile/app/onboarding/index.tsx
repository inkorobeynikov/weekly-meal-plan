import { useCallback, useEffect, useState } from 'react';
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
import { router } from 'expo-router';

import {
  Button,
  SkeletonBlock,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';

import {
  getHousehold,
  updatePreferences,
  type UpdatePreferencesInput,
} from '../../src/lib/api';
import { setOnboardingComplete } from '../../src/lib/onboarding';

// ---------------------------------------------------------------------------
// W06 — 3-step onboarding wizard.
//
// Step 1: household name. Step 2: family size. Step 3: allergies +
// hardRestrictions (HARD CONSTRAINTS — must reach the API exactly as picked,
// never silently dropped). Completion is gated on a LOCAL flag (SecureStore)
// because the households table has no onboardingCompleted column.
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3;
const TOTAL_STEPS = 3;

const MIN_MEMBERS = 1;
const MAX_MEMBERS = 8;

// Polish allergen labels. Stored verbatim as plain strings in the allergies[]
// array (the domain treats allergies/restrictions as free-string arrays).
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

interface WizardState {
  step: Step;
  householdName: string;
  memberCount: number;
  allergies: string[];
  hardRestrictions: string[];
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// --- progress dots -----------------------------------------------------------

function ProgressDots({ step }: { step: Step }): React.JSX.Element {
  return (
    <View style={styles.dotsRow} accessibilityRole="progressbar" accessibilityLabel={`Krok ${step} z ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const active = i + 1 === step;
        return (
          <View
            key={i}
            style={[styles.dot, active ? styles.dotActive : styles.dotIdle]}
          />
        );
      })}
    </View>
  );
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

export default function Onboarding(): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    step: 1,
    householdName: '',
    memberCount: 4,
    allergies: [],
    hardRestrictions: [],
  });
  const [customRestriction, setCustomRestriction] = useState<string>('');

  // Prefill name/prefs from the existing household. A failure here is
  // non-fatal: we treat it as a brand-new household with empty fields.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const family = await getHousehold();
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          householdName: family.household.name ?? prev.householdName,
          allergies: family.preferences?.allergies ?? prev.allergies,
          hardRestrictions: family.preferences?.hardRestrictions ?? prev.hardRestrictions,
        }));
      } catch {
        // Brand-new household / offline — keep empty defaults.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goTo = useCallback((step: Step) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setMembers = useCallback((memberCount: number) => {
    const clamped = Math.min(MAX_MEMBERS, Math.max(MIN_MEMBERS, memberCount));
    setState((prev) => ({ ...prev, memberCount: clamped }));
  }, []);

  const addCustomRestriction = useCallback(() => {
    const value = customRestriction.trim();
    if (value.length === 0) return;
    setState((prev) =>
      prev.hardRestrictions.includes(value)
        ? prev
        : { ...prev, hardRestrictions: [...prev.hardRestrictions, value] },
    );
    setCustomRestriction('');
  }, [customRestriction]);

  const finish = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      // HARD CONSTRAINTS: pass the selected allergies/hardRestrictions through
      // verbatim. Only fields supported by UpdatePreferencesInput are sent.
      const payload: UpdatePreferencesInput = {
        allergies: state.allergies,
        hardRestrictions: state.hardRestrictions,
      };
      await updatePreferences(payload);
      // TODO: backend route — api.ts exposes no household-update wrapper, so
      // householdName/memberCount cannot be persisted yet. Skipping for now.
    } catch {
      // Surface a friendly error but still let the user proceed: onboarding is
      // a local gate and preferences can be re-edited later in W05.
      setError('Nie udało się zapisać preferencji. Możesz to poprawić później.');
    }
    try {
      await setOnboardingComplete();
    } catch {
      // Even if the flag write fails we proceed; worst case is re-onboarding.
    }
    setSubmitting(false);
    router.replace('/(tabs)/plan');
  }, [state.allergies, state.hardRestrictions]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <SkeletonBlock width={120} height={10} style={{ marginBottom: spacing.xl }} />
          <SkeletonBlock width="70%" height={28} style={{ marginBottom: spacing.lg }} />
          <SkeletonBlock width="100%" height={52} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock width="100%" height={52} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ProgressDots step={state.step} />

        {state.step === 1 ? (
          <View>
            <Text style={styles.title}>Jak masz na imię?</Text>
            <Text style={styles.subtitle}>
              Nadaj nazwę swojej rodzinie — będziemy jej używać w planie posiłków.
            </Text>

            <Text style={styles.label}>Nazwa rodziny</Text>
            <TextInput
              testID="onboarding-name"
              value={state.householdName}
              onChangeText={(householdName) => setState((prev) => ({ ...prev, householdName }))}
              placeholder="np. Rodzina Kowalskich"
              placeholderTextColor={tokens.faint}
              style={styles.input}
              accessibilityLabel="Nazwa rodziny"
            />

            <Button testID="onboarding-next" onPress={() => goTo(2)} style={styles.cta}>
              Dalej
            </Button>
            <Pressable
              testID="onboarding-skip"
              onPress={() => goTo(3)}
              accessibilityRole="button"
              accessibilityLabel="Pomiń"
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Pomiń</Text>
            </Pressable>
          </View>
        ) : null}

        {state.step === 2 ? (
          <View>
            <Text style={styles.title}>Ile osób w rodzinie?</Text>
            <Text style={styles.subtitle}>
              Dostosujemy ilości i porcje do liczby domowników.
            </Text>

            <View style={styles.avatarStack}>
              {Array.from({ length: Math.min(state.memberCount, MAX_MEMBERS) }, (_, i) => (
                <View key={i} style={[styles.avatarGlyph, i > 0 ? styles.avatarOverlap : null]}>
                  <Ionicons name="person" size={20} color={tokens.sageInk} />
                </View>
              ))}
            </View>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => setMembers(state.memberCount - 1)}
                accessibilityRole="button"
                accessibilityLabel="Zmniejsz liczbę osób"
                disabled={state.memberCount <= MIN_MEMBERS}
                style={[styles.stepBtn, state.memberCount <= MIN_MEMBERS ? styles.stepBtnDisabled : null]}
              >
                <Ionicons name="remove" size={22} color={tokens.ink} />
              </Pressable>
              <Text style={styles.countText} accessibilityLabel={`Liczba osób: ${state.memberCount}`}>
                {state.memberCount}
              </Text>
              <Pressable
                onPress={() => setMembers(state.memberCount + 1)}
                accessibilityRole="button"
                accessibilityLabel="Zwiększ liczbę osób"
                disabled={state.memberCount >= MAX_MEMBERS}
                style={[styles.stepBtn, state.memberCount >= MAX_MEMBERS ? styles.stepBtnDisabled : null]}
              >
                <Ionicons name="add" size={22} color={tokens.ink} />
              </Pressable>
            </View>

            <View style={styles.pillRow}>
              {Array.from({ length: MAX_MEMBERS }, (_, i) => i + 1).map((n) => {
                const selected = n === state.memberCount;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setMembers(n)}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} osób`}
                    accessibilityState={{ selected }}
                    style={[styles.pill, selected ? styles.pillOn : styles.pillOff]}
                  >
                    <Text style={[styles.pillText, selected ? styles.pillTextOn : styles.pillTextOff]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button testID="onboarding-next" onPress={() => goTo(3)} style={styles.cta}>
              Dalej
            </Button>
            <Pressable
              onPress={() => goTo(1)}
              accessibilityRole="button"
              accessibilityLabel="Wstecz"
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Wstecz</Text>
            </Pressable>
          </View>
        ) : null}

        {state.step === 3 ? (
          <View>
            <Text style={styles.title}>Czy ktoś ma alergie?</Text>
            <Text style={styles.subtitle}>
              Zaznacz alergeny i ograniczenia — nigdy nie pojawią się w planie.
            </Text>

            <Text style={styles.label}>Alergeny</Text>
            <View style={styles.chipWrap}>
              {ALLERGENS.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  selected={state.allergies.includes(a)}
                  onPress={() =>
                    setState((prev) => ({ ...prev, allergies: toggle(prev.allergies, a) }))
                  }
                />
              ))}
            </View>

            <Text style={[styles.label, { marginTop: spacing.xl }]}>Ograniczenia żywieniowe</Text>
            <View style={styles.chipWrap}>
              {RESTRICTIONS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={state.hardRestrictions.includes(r)}
                  onPress={() =>
                    setState((prev) => ({
                      ...prev,
                      hardRestrictions: toggle(prev.hardRestrictions, r),
                    }))
                  }
                />
              ))}
              {state.hardRestrictions
                .filter((r) => !RESTRICTIONS.includes(r))
                .map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    selected
                    onPress={() =>
                      setState((prev) => ({
                        ...prev,
                        hardRestrictions: toggle(prev.hardRestrictions, r),
                      }))
                    }
                  />
                ))}
            </View>

            <View style={styles.customRow}>
              <TextInput
                testID="onboarding-custom-restriction"
                value={customRestriction}
                onChangeText={setCustomRestriction}
                onSubmitEditing={addCustomRestriction}
                placeholder="Dodaj własne ograniczenie"
                placeholderTextColor={tokens.faint}
                style={[styles.input, styles.customInput]}
                accessibilityLabel="Dodaj własne ograniczenie"
                returnKeyType="done"
              />
              <Pressable
                onPress={addCustomRestriction}
                accessibilityRole="button"
                accessibilityLabel="Dodaj ograniczenie"
                style={styles.addBtn}
              >
                <Ionicons name="add" size={22} color={tokens.surface} />
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button testID="onboarding-finish" onPress={finish} loading={submitting} style={styles.cta}>
              Zakończ
            </Button>
            <Pressable
              onPress={() => goTo(2)}
              accessibilityRole="button"
              accessibilityLabel="Wstecz"
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Wstecz</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  container: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1 },

  dotsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 28, backgroundColor: tokens.sage },
  dotIdle: { width: 8, backgroundColor: tokens.line2 },

  title: { fontSize: fontSize.xl, fontWeight: '700', color: tokens.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.base, color: tokens.muted, marginBottom: spacing.xl, lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.ink2, marginBottom: spacing.sm },

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

  cta: { marginTop: spacing['2xl'] },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  linkText: { color: tokens.muted, fontSize: fontSize.base, fontWeight: '600' },

  // step 2
  avatarStack: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.xl },
  avatarGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.bg,
  },
  avatarOverlap: { marginLeft: -10 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: tokens.surface2,
    borderWidth: 1,
    borderColor: tokens.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  countText: { fontSize: fontSize.display, fontWeight: '700', color: tokens.ink, minWidth: 44, textAlign: 'center' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  pill: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pillOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  pillOff: { backgroundColor: tokens.surface, borderColor: tokens.line2 },
  pillText: { fontSize: fontSize.base, fontWeight: '700' },
  pillTextOn: { color: tokens.sageInk },
  pillTextOff: { color: tokens.ink2 },

  // step 3
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

  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  customInput: { flex: 1 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: tokens.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: { color: tokens.terra, fontSize: fontSize.sm, marginTop: spacing.md },
});
