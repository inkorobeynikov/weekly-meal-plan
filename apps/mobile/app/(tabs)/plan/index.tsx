import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
  SectionHeader,
  SkeletonBlock,
  fontSize,
  radii,
  shadowStyle,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { MealType } from '@meal-planner/shared';

import {
  ApiError,
  generatePlan,
  getWeeklyPlan,
  resetPlan,
  type MealWithRecipe,
  type PlanWithMealsAndRecipes,
} from '@/lib/api';

// Dev-only affordances (e.g. the plan reset button) — hidden in production builds.
const IS_DEV = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Date helpers — no external libs. Plan `weekStartDate` is an ISO date string
// (YYYY-MM-DD). We derive the 7 day cells from it and flag "today".
// ---------------------------------------------------------------------------

const WEEKDAY_ABBREVIATIONS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'] as const;

interface DayCell {
  /** ISO date (YYYY-MM-DD) used to match planned meals. */
  isoDate: string;
  /** Polish weekday abbreviation (Monday-first). */
  weekday: string;
  /** Day-of-month number. */
  dayNumber: number;
  /** True when this cell is the device's current day. */
  isToday: boolean;
}

// Parse a YYYY-MM-DD string into a local Date at midnight (avoids TZ shifting
// that `new Date('YYYY-MM-DD')` would cause by treating it as UTC).
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Monday-first weekday index (Mon=0 ... Sun=6).
function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// Build one cell per calendar day from the plan's start through its last day
// with a meal. The plan window is variable (7..14 days), so this must NOT assume
// a fixed 7-day week — otherwise two dates sharing a weekday would collide.
function buildDayCells(weekStartDate: string, meals: readonly MealWithRecipe[], today: Date): DayCell[] {
  const startIso = weekStartDate.slice(0, 10);
  const lastIso = meals.reduce(
    (max, m) => (m.meal.date.slice(0, 10) > max ? m.meal.date.slice(0, 10) : max),
    startIso,
  );
  const todayIso = toIsoDate(today);
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(lastIso);
  const cells: DayCell[] = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const isoDate = toIsoDate(date);
    cells.push({
      isoDate,
      weekday: WEEKDAY_ABBREVIATIONS[mondayFirstIndex(date)] ?? '',
      dayNumber: date.getDate(),
      isToday: isoDate === todayIso,
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Meal helpers
// ---------------------------------------------------------------------------

// Natural day order: breakfast -> lunch (obiad, fresh or leftovers) -> dinner (kolacja).
const MEAL_TYPE_ORDER: readonly MealType[] = [
  'breakfast_template',
  'lunch',
  'lunch_leftover',
  'dinner',
];

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast_template: 'Śniadanie',
  lunch: 'Obiad',
  lunch_leftover: 'Obiad (z resztek)',
  dinner: 'Kolacja',
};

// Group meals by their planned ISO date so the day strip can show the right set.
function mealsForDay(meals: MealWithRecipe[], isoDate: string): MealWithRecipe[] {
  const matching = meals.filter((m) => m.meal.date.slice(0, 10) === isoDate);
  return [...matching].sort(
    (a, b) =>
      MEAL_TYPE_ORDER.indexOf(a.meal.mealType) - MEAL_TYPE_ORDER.indexOf(b.meal.mealType),
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; plan: PlanWithMealsAndRecipes }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

export default function PlanScreen(): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  // Stays true from the moment generation is requested until a plan appears, so
  // the UI shows a persistent "generating" state (the POST itself returns fast —
  // it only enqueues the background job).
  const [generationStarted, setGenerationStarted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Set when the user just triggered generation, so we can jump straight to the
  // review screen the moment the freshly generated draft arrives.
  const pendingReviewRef = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const plan = await getWeeklyPlan();
      // Treat an approved plan (or any plan that actually has meals) as real.
      // A 404 from the backend means there is no plan yet.
      if (plan.meals.length === 0) {
        setState({ kind: 'empty' });
        return;
      }
      setState({ kind: 'ready', plan });
      // A plan arrived — clear the generating banner/state.
      setGenerationStarted(false);
      setNotice(null);
      // If this plan is the one we just generated, open the review screen so the
      // user can check & approve it (rather than landing on the day view).
      if (pendingReviewRef.current && plan.plan.status === 'draft') {
        pendingReviewRef.current = false;
        router.push('/(tabs)/plan/review');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ kind: 'empty' });
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Nie udało się wczytać planu.';
      setState({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onGenerate = useCallback(async (): Promise<void> => {
    setGenerating(true);
    setNotice(null);
    try {
      await generatePlan();
      // The job is now queued; keep a persistent generating state until the
      // finished plan is picked up by the poll/refresh below, then jump to review.
      pendingReviewRef.current = true;
      setGenerationStarted(true);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Nie udało się rozpocząć generowania.',
      );
    } finally {
      setGenerating(false);
    }
  }, []);

  // While a generation is in flight and no plan has arrived yet, poll for it so
  // the screen flips to the plan automatically once the background job finishes.
  useEffect(() => {
    if (!generationStarted || state.kind === 'ready') return;
    const id = setInterval(() => {
      void load();
    }, 8000);
    return () => clearInterval(id);
  }, [generationStarted, state.kind, load]);

  // Week cells derived from the loaded plan; today computed in app code.
  const weekCells = useMemo<DayCell[]>(() => {
    if (state.kind !== 'ready') return [];
    return buildDayCells(state.plan.plan.weekStartDate, state.plan.meals, new Date());
  }, [state]);

  // Default the selected day to "today" if it is inside the plan week,
  // otherwise the first day of the week.
  const activeIso = useMemo<string | null>(() => {
    if (weekCells.length === 0) return null;
    if (selectedIso && weekCells.some((c) => c.isoDate === selectedIso)) {
      return selectedIso;
    }
    const todayCell = weekCells.find((c) => c.isToday);
    return todayCell?.isoDate ?? weekCells[0]?.isoDate ?? null;
  }, [weekCells, selectedIso]);

  const dayMeals = useMemo<MealWithRecipe[]>(() => {
    if (state.kind !== 'ready' || !activeIso) return [];
    return mealsForDay(state.plan.meals, activeIso);
  }, [state, activeIso]);

  const openRecipe = useCallback((recipeId: string): void => {
    router.push({
      pathname: '/(tabs)/plan/recipe/[id]',
      params: { id: recipeId },
    });
  }, []);

  // Dev/testing: wipe the household's plan so generation can be re-run from scratch.
  const onReset = useCallback(async (): Promise<void> => {
    try {
      await resetPlan();
    } catch {
      // Non-fatal in dev — fall through to reload either way.
    }
    setGenerationStarted(false);
    setNotice(null);
    setSelectedIso(null);
    setState({ kind: 'loading' });
    await load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <SectionHeader
          title="Plan tygodnia"
          actionLabel={IS_DEV ? 'Reset' : undefined}
          onActionPress={IS_DEV ? () => void onReset() : undefined}
        />
      </View>

      {state.kind === 'loading' ? (
        <LoadingState />
      ) : state.kind === 'error' ? (
        <ErrorState message={state.message} onRetry={() => void load()} />
      ) : state.kind === 'empty' ? (
        generationStarted ? (
          <GeneratingState />
        ) : (
          <EmptyState
            errorNotice={notice}
            generating={generating}
            onGenerate={() => void onGenerate()}
          />
        )
      ) : (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollBody}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={tokens.sage}
              />
            }
          >
            {state.plan.plan.status === 'draft' ? (
              <Pressable
                testID="plan-review-cta"
                onPress={() => router.push('/(tabs)/plan/review')}
                accessibilityRole="button"
                accessibilityLabel="Przejrzyj i zatwierdź plan"
                style={styles.reviewCta}
              >
                <Ionicons name="checkmark-circle" size={20} color={tokens.surface} />
                <Text style={styles.reviewCtaText}>Przejrzyj i zatwierdź plan</Text>
                <Ionicons name="chevron-forward" size={18} color={tokens.surface} />
              </Pressable>
            ) : state.plan.plan.status === 'approved' ? (
              <View testID="plan-approved-badge" style={styles.approvedChip}>
                <Ionicons name="checkmark-circle" size={16} color={tokens.sageInk} />
                <Text style={styles.approvedChipText}>Plan zatwierdzony</Text>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {weekCells.map((cell) => {
                const selected = cell.isoDate === activeIso;
                return (
                  <Pressable
                    key={cell.isoDate}
                    testID={`plan-day-${cell.isoDate}`}
                    onPress={() => setSelectedIso(cell.isoDate)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${cell.weekday} ${cell.dayNumber}`}
                    style={[styles.dayCell, selected && styles.dayCellSelected]}
                  >
                    <Text style={[styles.dayWeekday, selected && styles.dayTextSelected]}>
                      {cell.weekday}
                    </Text>
                    <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>
                      {cell.dayNumber}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {generationStarted ? (
              <View style={styles.banner}>
                <ActivityIndicator size="small" color={tokens.sageInk} />
                <Text style={styles.bannerText}>Generujemy nowy plan…</Text>
              </View>
            ) : notice ? (
              <Text style={styles.errorNotice}>{notice}</Text>
            ) : null}

            <View style={styles.meals}>
              {dayMeals.length === 0 ? (
                <Text style={styles.noMeals}>Brak posiłków na ten dzień.</Text>
              ) : (
                dayMeals.map(({ meal, recipe }) => (
                  <View key={meal.id} style={styles.mealGroup}>
                    <Text style={styles.mealTypeLabel}>
                      {MEAL_TYPE_LABELS[meal.mealType]}
                    </Text>
                    <MealCard
                      testID={`plan-meal-${meal.mealType}`}
                      name={recipe.title}
                      placeholderSeed={recipe.title}
                      cookTimeMinutes={recipe.timeMinutes}
                      portions={meal.servings}
                      onPress={() => openRecipe(recipe.id)}
                    />
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <Pressable
            testID="plan-fab"
            onPress={() => void onGenerate()}
            disabled={generating || generationStarted}
            accessibilityRole="button"
            accessibilityLabel="Wygeneruj nowy plan"
            style={[styles.fab, (generating || generationStarted) && styles.fabDisabled]}
          >
            {generationStarted ? (
              <ActivityIndicator size="small" color={tokens.surface} />
            ) : (
              <Ionicons name="sparkles" size={18} color={tokens.surface} />
            )}
            <Text style={styles.fabLabel}>
              {generationStarted ? 'Generowanie…' : 'Wygeneruj nowy plan'}
            </Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBlock height={140} radius={radii.md} />
          <SkeletonBlock width="70%" height={20} />
          <SkeletonBlock width="40%" height={14} />
        </View>
      ))}
    </View>
  );
}

interface EmptyStateProps {
  errorNotice: string | null;
  generating: boolean;
  onGenerate: () => void;
}

function EmptyState({ errorNotice, generating, onGenerate }: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="restaurant-outline" size={40} color={tokens.sageInk} />
      </View>
      <Text style={styles.emptyTitle}>Nie masz jeszcze planu</Text>
      <Text style={styles.emptyBody}>
        Wygeneruj swój pierwszy tygodniowy plan posiłków dla rodziny.
      </Text>
      {errorNotice ? <Text style={styles.errorNotice}>{errorNotice}</Text> : null}
      <Button
        variant="primary"
        loading={generating}
        onPress={onGenerate}
        accessibilityLabel="Wygeneruj pierwszy plan"
        testID="plan-generate-first"
        style={styles.emptyButton}
      >
        Wygeneruj pierwszy plan
      </Button>
    </View>
  );
}

// Shown after generation has been requested and we're waiting for the background
// job to finish. Clear, high-contrast copy + spinner; no action button (the work
// is already running, and the screen auto-refreshes when the plan is ready).
function GeneratingState(): React.JSX.Element {
  return (
    <View testID="plan-generating-state" style={styles.centered}>
      <View style={styles.generatingIcon}>
        <ActivityIndicator size="large" color={tokens.sageInk} />
      </View>
      <Text style={styles.emptyTitle}>Generujemy Twój plan…</Text>
      <Text style={styles.emptyBody}>
        Przygotowujemy tygodniowy plan i przepisy dla Twojej rodziny. To potrwa
        kilka chwil — ekran odświeży się automatycznie, gdy plan będzie gotowy.
      </Text>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="warning-outline" size={40} color={tokens.terraInk} />
      </View>
      <Text style={styles.emptyTitle}>Coś poszło nie tak</Text>
      <Text style={styles.emptyBody}>{message}</Text>
      <Button
        variant="secondary"
        onPress={onRetry}
        accessibilityLabel="Spróbuj ponownie"
        style={styles.emptyButton}
      >
        Spróbuj ponownie
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.md },
  scrollBody: { paddingBottom: 120 },

  strip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  dayCell: {
    width: 52,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: 2,
    backgroundColor: tokens.surface,
  },
  dayCellSelected: {
    backgroundColor: tokens.sage,
  },
  dayWeekday: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: tokens.muted,
  },
  dayNumber: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
  },
  dayTextSelected: {
    color: tokens.surface,
  },

  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing['2xl'],
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: tokens.sage,
    ...shadowStyle.card,
  },
  reviewCtaText: {
    flex: 1,
    color: tokens.surface,
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  approvedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginHorizontal: spacing['2xl'],
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: tokens.sageSoft,
  },
  approvedChipText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.sageInk,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    marginHorizontal: spacing['2xl'],
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: tokens.sageSoft,
  },
  bannerText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.sageInk,
  },
  errorNotice: {
    marginHorizontal: spacing['2xl'],
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
    color: tokens.terraInk,
    fontWeight: '600',
    textAlign: 'center',
  },

  meals: {
    paddingHorizontal: spacing['2xl'],
    gap: spacing.xl,
  },
  mealGroup: {
    gap: spacing.sm,
  },
  mealTypeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noMeals: {
    fontSize: fontSize.base,
    color: tokens.muted,
  },

  skeletonWrap: {
    padding: spacing['2xl'],
    gap: spacing.xl,
  },
  skeletonCard: {
    gap: spacing.sm,
    backgroundColor: tokens.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadowStyle.card,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.sageSoft,
    marginBottom: spacing.sm,
  },
  generatingIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.sageSoft,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: fontSize.base,
    color: tokens.muted,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },

  fab: {
    position: 'absolute',
    right: spacing['2xl'],
    bottom: spacing['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: tokens.sage,
    ...shadowStyle.fab,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  fabLabel: {
    color: tokens.surface,
    fontSize: fontSize.base,
    fontWeight: '700',
  },
});
