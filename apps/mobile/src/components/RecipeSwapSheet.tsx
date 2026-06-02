import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Badge,
  Button,
  MealCard,
  SkeletonBlock,
  fontSize,
  radii,
  shadowStyle,
  spacing,
  tokens,
} from '@meal-planner/ui-native';

import { apiFetch } from '../lib/api';

// W07 — Recipe Swap bottom sheet.
//
// Lets the user replace a single planned meal with an AI-proposed alternative.
// Alternatives are fetched lazily when the sheet opens and can be re-rolled via
// "Zaproponuj inne". Confirming a choice POSTs the replacement, then notifies
// the parent so it can refetch the plan.

export interface SwapMealRef {
  planId: string;
  mealId: string;
  recipeId: string;
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

// Local shape of an alternative proposal. `// TODO: backend route` — the
// alternatives endpoint is not yet exposed; this mirrors the expected payload.
interface Alternative {
  recipeId: string;
  name: string;
  imageUri?: string;
  cookTimeMinutes?: number;
  portions?: number;
  matchScore?: number; // 0..1 — rendered as a "% dopasowania" badge.
}

interface AlternativesResponse {
  alternatives: Alternative[];
}

export function RecipeSwapSheet({
  visible,
  meal,
  onClose,
  onSwapped,
}: RecipeSwapSheetProps): React.JSX.Element | null {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const planId = meal?.planId;
  const mealId = meal?.mealId;

  // Load (or re-load) alternatives whenever the sheet opens for a given meal.
  useEffect(() => {
    let active = true;
    if (!visible || planId === undefined || mealId === undefined) return;

    setLoading(true);
    setError(false);
    setAlternatives([]);

    apiFetch<AlternativesResponse>(
      // TODO: backend route — alternatives endpoint not implemented yet.
      `/api/plans/${planId}/meals/${mealId}/alternatives`,
    )
      .then((res) => {
        if (!active) return;
        setAlternatives(Array.isArray(res.alternatives) ? res.alternatives : []);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible, planId, mealId]);

  async function reroll(): Promise<void> {
    if (planId === undefined || mealId === undefined) return;
    setLoading(true);
    setError(false);
    setAlternatives([]);
    try {
      const res = await apiFetch<AlternativesResponse>(
        // TODO: backend route — alternatives endpoint not implemented yet.
        `/api/plans/${planId}/meals/${mealId}/alternatives`,
      );
      setAlternatives(Array.isArray(res.alternatives) ? res.alternatives : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function chooseAlternative(alt: Alternative): Promise<void> {
    if (!meal || submittingId !== null) return;
    setSubmittingId(alt.recipeId);
    try {
      await apiFetch(
        // TODO: backend route — replace endpoint accepting a chosen recipeId.
        `/api/plans/${meal.planId}/meals/${meal.mealId}/replace`,
        { method: 'POST', body: { recipeId: alt.recipeId } },
      );
      onSwapped(meal.mealId);
      onClose();
    } catch {
      setError(true);
    } finally {
      setSubmittingId(null);
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

        <View style={styles.sheet}>
          {/* Grab handle */}
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.header} accessibilityRole="header">
              {`Zamień ${meal.dayLabel} · ${meal.mealTypeLabel}`}
            </Text>
            <Pressable
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

          <View style={styles.altHeaderRow}>
            <Text style={styles.sectionLabel}>Propozycje</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zaproponuj inne"
              hitSlop={8}
              onPress={() => void reroll()}
              disabled={loading}
            >
              <Text style={[styles.reroll, loading && styles.rerollDisabled]}>
                Zaproponuj inne
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View
                accessibilityLabel="Ładowanie propozycji"
                style={styles.skeletonGroup}
              >
                <SkeletonBlock height={180} radius={radii.md} />
                <SkeletonBlock height={180} radius={radii.md} />
                <SkeletonBlock height={180} radius={radii.md} />
              </View>
            ) : error ? (
              <View style={styles.stateBox} accessibilityRole="alert">
                <Text style={styles.stateText}>Nie udało się pobrać propozycji</Text>
                <Button variant="secondary" onPress={() => void reroll()}>
                  Spróbuj ponownie
                </Button>
              </View>
            ) : alternatives.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateText}>Brak innych propozycji na teraz.</Text>
              </View>
            ) : (
              alternatives.map((alt) => {
                const pct =
                  alt.matchScore !== undefined
                    ? Math.round(alt.matchScore * 100)
                    : undefined;
                const isSubmitting = submittingId === alt.recipeId;
                return (
                  <MealCard
                    key={alt.recipeId}
                    name={isSubmitting ? `${alt.name} · Zamieniam…` : alt.name}
                    imageUri={alt.imageUri}
                    cookTimeMinutes={alt.cookTimeMinutes}
                    portions={alt.portions}
                    badges={
                      pct !== undefined
                        ? [{ tone: 'sage', label: `${pct}% dopasowania` }]
                        : undefined
                    }
                    onPress={
                      submittingId === null
                        ? () => void chooseAlternative(alt)
                        : undefined
                    }
                  />
                );
              })
            )}
          </ScrollView>
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
  altHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reroll: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.sage },
  rerollDisabled: { color: tokens.faint },
  scroll: { marginTop: spacing.sm },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
  skeletonGroup: { gap: spacing.md },
  stateBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  stateText: {
    fontSize: fontSize.base,
    color: tokens.muted,
    textAlign: 'center',
  },
});
