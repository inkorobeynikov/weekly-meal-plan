import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Button,
  MealCard,
  SkeletonBlock,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { MealType } from '@meal-planner/shared';

import {
  approvePlan,
  generatePlan,
  getHousehold,
  getWeeklyPlan,
  type MealWithRecipe,
  type PlanWithMealsAndRecipes,
} from '../../../src/lib/api';
import {
  findPlanAllergyConflicts,
  type PlanAllergyConflict,
} from '../../../src/lib/allergies';
import {
  RecipeSwapSheet,
  type SwapMealRef,
} from '../../../src/components/RecipeSwapSheet';

// W04 — Plan Review.
//
// Shows the AI-generated draft plan grouped by weekday and lets the user
// approve it, regenerate it, or swap individual meals. Approval is HARD-BLOCKED
// whenever any planned meal collides with a household allergy.

// --- weekday helpers ---------------------------------------------------------

const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'] as const;

// JS getDay(): 0=Sun..6=Sat. Map to Mon-first index 0..6.
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast_template: 'Śniadanie',
  lunch: 'Obiad',
  lunch_leftover: 'Obiad (z resztek)',
  dinner: 'Kolacja',
};

// Natural day order: breakfast -> lunch (obiad) -> dinner (kolacja).
const MEAL_TYPE_ORDER: readonly MealType[] = [
  'breakfast_template',
  'lunch',
  'lunch_leftover',
  'dinner',
];

function mealTypeLabel(type: MealType): string {
  return MEAL_TYPE_LABEL[type];
}

interface DayGroup {
  label: string;
  meals: MealWithRecipe[];
}

// Parse a YYYY-MM-DD string into a local midnight Date (avoids the UTC shift of
// `new Date('YYYY-MM-DD')`).
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((p) => Number.parseInt(p, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// Group by the actual calendar date, NOT by weekday — the plan window is
// variable (7..14 days), so two dates can share a weekday. Each group is
// labelled "<weekday> <day-number>" (e.g. "Śr 3") and ordered chronologically.
function groupMealsByDay(meals: readonly MealWithRecipe[]): DayGroup[] {
  const byDate = new Map<string, MealWithRecipe[]>();
  for (const m of meals) {
    const iso = m.meal.date.slice(0, 10);
    const arr = byDate.get(iso) ?? [];
    arr.push(m);
    byDate.set(iso, arr);
  }
  return [...byDate.keys()].sort().map((iso) => {
    const d = parseIsoDate(iso);
    return {
      label: `${DAY_LABELS[mondayIndex(d)] ?? ''} ${d.getDate()}`,
      meals: (byDate.get(iso) ?? []).slice().sort(
        (a, b) =>
          MEAL_TYPE_ORDER.indexOf(a.meal.mealType) - MEAL_TYPE_ORDER.indexOf(b.meal.mealType),
      ),
    };
  });
}

// --- screen ------------------------------------------------------------------

export default function PlanReviewScreen(): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [plan, setPlan] = useState<PlanWithMealsAndRecipes | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [approving, setApproving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [swapMeal, setSwapMeal] = useState<SwapMealRef | null>(null);
  const [swapVisible, setSwapVisible] = useState<boolean>(false);

  const loadPlan = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [planRes, family] = await Promise.all([
        getWeeklyPlan().catch(() => null),
        getHousehold().catch(() => null),
      ]);
      // A plan with no meals is treated as "no plan" for the empty state.
      setPlan(planRes && planRes.meals.length > 0 ? planRes : null);
      setAllergies(family?.preferences?.allergies ?? []);
    } catch {
      setError('Nie udało się wczytać planu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  // ⚠️ HARD CONSTRAINT: allergies are non-negotiable. Any conflict blocks
  // approval and surfaces a prominent warning banner.
  const conflicts: PlanAllergyConflict[] = useMemo(
    () => (plan ? findPlanAllergyConflicts(plan.meals, allergies) : []),
    [plan, allergies],
  );
  const hasConflict = conflicts.length > 0;

  const days = useMemo(
    () => (plan ? groupMealsByDay(plan.meals) : []),
    [plan],
  );

  async function handleApprove(): Promise<void> {
    // HARD CONSTRAINT: never approve a plan that violates an allergy.
    if (!plan || hasConflict || approving) return;
    setApproving(true);
    setError(null);
    try {
      await approvePlan(plan.plan.id);
      router.replace('/(tabs)/plan');
    } catch {
      setError('Nie udało się zatwierdzić planu.');
    } finally {
      setApproving(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      await generatePlan();
      // Re-fetch after enqueueing; the new draft may not be ready instantly,
      // but reload reflects whatever the backend currently has.
      await loadPlan();
    } catch {
      setError('Nie udało się wygenerować planu.');
    } finally {
      setGenerating(false);
    }
  }

  function openSwap(planId: string, m: MealWithRecipe, dayLabel: string): void {
    setSwapMeal({
      planId,
      mealId: m.meal.id,
      recipeId: m.recipe.id,
      name: m.recipe.title,
      dayLabel,
      mealTypeLabel: mealTypeLabel(m.meal.mealType),
    });
    setSwapVisible(true);
  }

  function handleSwapped(): void {
    setSwapVisible(false);
    setSwapMeal(null);
    void loadPlan();
  }

  // --- render ----------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerBlock}>
        <Text style={styles.title} accessibilityRole="header">
          Przejrzyj plan
        </Text>
        <View style={styles.aiRow}>
          <Ionicons name="sparkles" size={14} color={tokens.sage} />
          <Text style={styles.aiText}>
            Plan wygenerowany przez AI · Sprawdź przed zatwierdzeniem
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View accessibilityLabel="Ładowanie planu" style={styles.skeletonGroup}>
            <SkeletonBlock width="40%" height={20} />
            <SkeletonBlock height={120} radius={radii.md} />
            <SkeletonBlock width="40%" height={20} />
            <SkeletonBlock height={120} radius={radii.md} />
            <SkeletonBlock width="40%" height={20} />
            <SkeletonBlock height={120} radius={radii.md} />
          </View>
        ) : plan === null ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="restaurant-outline" size={36} color={tokens.sage} />
            </View>
            <Text style={styles.emptyTitle}>
              Brak planu — wygeneruj pierwszy plan
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Button
              loading={generating}
              onPress={() => void handleGenerate()}
              accessibilityLabel="Wygeneruj plan"
              testID="review-generate-empty"
            >
              Wygeneruj plan
            </Button>
          </View>
        ) : (
          <>
            {/* ⚠️ HARD CONSTRAINT warning banner — allergies must never pass. */}
            {hasConflict ? (
              <View
                testID="review-allergy-banner"
                style={styles.warningBanner}
                accessibilityRole="alert"
                accessibilityLabel="Ostrzeżenie o alergii"
              >
                <View style={styles.warningHeaderRow}>
                  <Ionicons name="warning" size={18} color={tokens.terraInk} />
                  <Text style={styles.warningTitle}>
                    Wykryto alergeny — nie można zatwierdzić
                  </Text>
                </View>
                {conflicts.map((c) => (
                  <Text key={c.mealId} style={styles.warningItem}>
                    • {c.recipeName}: {c.matched.join(', ')}
                  </Text>
                ))}
                <Text style={styles.warningHint}>
                  Zamień te posiłki, aby kontynuować.
                </Text>
              </View>
            ) : null}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {days.map((day) =>
              day.meals.length > 0 ? (
                <View key={day.label} style={styles.dayBlock}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <View style={styles.dayMeals}>
                    {day.meals.map((m) => (
                      <View key={m.meal.id} style={styles.mealItem}>
                        <Text style={styles.mealType}>
                          {mealTypeLabel(m.meal.mealType)}
                        </Text>
                        <MealCard
                          testID={`review-meal-${m.meal.mealType}`}
                          swapTestID={`review-swap-${m.meal.mealType}`}
                          name={m.recipe.title}
                          cookTimeMinutes={m.recipe.timeMinutes}
                          portions={m.meal.servings}
                          onSwap={() => openSwap(plan.plan.id, m, day.label)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null,
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky bottom actions — only meaningful when a plan exists. */}
      {!loading && plan !== null ? (
        <View style={styles.footer}>
          <Button
            loading={approving}
            disabled={hasConflict}
            onPress={() => void handleApprove()}
            accessibilityLabel="Zatwierdź plan"
            testID="review-approve"
            style={styles.footerBtn}
          >
            Zatwierdź plan
          </Button>
          <Button
            variant="secondary"
            loading={generating}
            onPress={() => void handleGenerate()}
            accessibilityLabel="Wygeneruj nowy"
            testID="review-generate"
            style={styles.footerBtn}
          >
            Wygeneruj nowy
          </Button>
        </View>
      ) : null}

      <RecipeSwapSheet
        visible={swapVisible}
        meal={swapMeal}
        onClose={() => setSwapVisible(false)}
        onSwapped={handleSwapped}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  headerBlock: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.display, fontWeight: '700', color: tokens.ink },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  aiText: { fontSize: fontSize.sm, color: tokens.muted },
  scroll: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  skeletonGroup: { gap: spacing.md },
  emptyWrap: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing['3xl'],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: tokens.ink2,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: tokens.terraSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tokens.terra,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  warningTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '700',
    color: tokens.terraInk,
  },
  warningItem: { fontSize: fontSize.sm, color: tokens.terraInk },
  warningHint: {
    fontSize: fontSize.sm,
    color: tokens.terraInk,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  dayBlock: { gap: spacing.sm },
  dayLabel: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
  },
  dayMeals: { gap: spacing.md },
  mealItem: { gap: spacing.xs },
  mealType: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: tokens.muted,
    textTransform: 'uppercase',
  },
  error: { fontSize: fontSize.sm, color: tokens.terra },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.line2,
    backgroundColor: tokens.bg,
  },
  footerBtn: { flex: 1 },
});
