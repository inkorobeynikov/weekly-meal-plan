import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Button,
  MealCard,
  fontSize,
  radii,
  shadowStyle,
  spacing,
  tokens,
} from '@meal-planner/ui-native';

import { replaceMeal } from '../lib/api';

// W07 — Recipe Swap bottom sheet (A4 Variant 1: "reason → replace").
//
// Lets the user replace a single planned meal. They pick a quick reason chip
// (Prościej / Taniej / Zdrowiej / Dla dzieci / Inna kuchnia) and/or type a short
// reason, then confirm; the existing
// POST /api/plans/:planId/meals/:mealId/replace route performs the AI
// replacement server-side and returns the new meal. While it runs we show a
// "Zamieniam…" working state. On success we notify the parent so it can refetch.

// F4: quick reason chips. The `reason` value is the Polish phrase forwarded to
// the AI replacement route as the swap reason.
interface ReasonChip {
  readonly key: string;
  readonly label: string;
  readonly reason: string;
}

const REASON_CHIPS: readonly ReasonChip[] = [
  { key: 'simpler', label: 'Prościej', reason: 'Chcę coś prostszego do przygotowania.' },
  { key: 'cheaper', label: 'Taniej', reason: 'Chcę tańszą propozycję.' },
  { key: 'healthier', label: 'Zdrowiej', reason: 'Chcę zdrowszą propozycję.' },
  { key: 'kids', label: 'Dla dzieci', reason: 'Chcę danie bardziej przyjazne dzieciom.' },
  { key: 'cuisine', label: 'Inna kuchnia', reason: 'Chcę danie z innej kuchni.' },
];

export interface SwapMealRef {
  planId: string;
  mealId: string;
  name: string;
  dayLabel: string;
  mealTypeLabel: string;
  imageUri?: string;
}

export interface RecipeSwapSheetProps {
  visible: boolean;
  meal: SwapMealRef | null;
  onClose: () => void;
  onSwapped: (mealId: string) => void;
}

export function RecipeSwapSheet({
  visible,
  meal,
  onClose,
  onSwapped,
}: RecipeSwapSheetProps): React.JSX.Element | null {
  const [reason, setReason] = useState<string>('');
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  // Reset the form each time the sheet (re)opens for a meal.
  useEffect(() => {
    if (visible) {
      setReason('');
      setSelectedChip(null);
      setLoading(false);
      setError(false);
    }
  }, [visible, meal?.mealId]);

  // Combine the selected quick-reason chip with any free text the user typed.
  function buildReason(): string | undefined {
    const chip = REASON_CHIPS.find((c) => c.key === selectedChip);
    const trimmed = reason.trim();
    const parts = [chip?.reason, trimmed].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  async function confirm(): Promise<void> {
    if (!meal || loading) return;
    setLoading(true);
    setError(false);
    try {
      await replaceMeal(meal.planId, meal.mealId, buildReason());
      onSwapped(meal.mealId);
      onClose();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!meal) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTap}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          onPress={onClose}
        />

        <View testID="swap-sheet" style={styles.sheet}>
          {/* Grab handle */}
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.header} accessibilityRole="header">
              {`Zamień ${meal.dayLabel} · ${meal.mealTypeLabel}`}
            </Text>
            <Pressable
              testID="swap-close"
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
              hitSlop={8}
              onPress={onClose}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {/* Current meal — grayed out */}
          <Text style={styles.sectionLabel}>Obecny posiłek</Text>
          <View style={styles.currentWrap}>
            <MealCard name={meal.name} imageUri={meal.imageUri} />
          </View>

          {/* F4: quick reason chips. */}
          <Text style={styles.sectionLabel}>Szybki powód</Text>
          <View style={styles.chipRow}>
            {REASON_CHIPS.map((chip) => {
              const on = chip.key === selectedChip;
              return (
                <Pressable
                  key={chip.key}
                  testID={`swap-chip-${chip.key}`}
                  onPress={() => setSelectedChip(on ? null : chip.key)}
                  accessibilityRole="button"
                  accessibilityLabel={chip.label}
                  accessibilityState={{ selected: on }}
                  disabled={loading}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Reason → replace */}
          <Text style={styles.sectionLabel}>Dodatkowy powód (opcjonalnie)</Text>
          <TextInput
            testID="swap-reason"
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="np. za ciężkie, brak czasu, alergia…"
            placeholderTextColor={tokens.faint}
            editable={!loading}
            multiline
            accessibilityLabel="Powód zamiany"
          />

          {/* F4: "Zamieniam…" working/result-preview state while the AI runs. */}
          {loading ? (
            <View testID="swap-working" style={styles.working}>
              <ActivityIndicator size="small" color={tokens.sageInk} />
              <Text style={styles.workingText}>Zamieniam… dobieram nowe danie</Text>
            </View>
          ) : null}

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              Nie udało się zamienić posiłku
            </Text>
          ) : null}

          <Button
            testID="swap-confirm"
            variant="primary"
            loading={loading}
            disabled={loading}
            onPress={() => void confirm()}
            style={styles.confirm}
          >
            {loading ? 'Zamieniam…' : 'Zamień posiłek'}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 27, 22, 0.45)',
  },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: tokens.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
    maxHeight: '88%',
    ...shadowStyle.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: tokens.line2,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  header: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: tokens.ink,
  },
  close: { fontSize: fontSize.lg, color: tokens.muted },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: tokens.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  currentWrap: { opacity: 0.5 },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: tokens.line2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: tokens.ink,
    backgroundColor: tokens.surface,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: tokens.terra,
    marginTop: spacing.md,
  },
  confirm: { marginTop: spacing.lg },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line2,
    backgroundColor: tokens.surface,
  },
  chipOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  chipText: { fontSize: fontSize.sm, fontWeight: '600', color: tokens.muted },
  chipTextOn: { color: tokens.sageInk },
  working: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: tokens.sageSoft,
  },
  workingText: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.sageInk },
});
