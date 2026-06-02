import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Button,
  SkeletonBlock,
  Tag,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { Difficulty } from '@meal-planner/shared';

import { getHousehold, getRecipe, type Recipe } from '@/lib/api';
import { recipeAllergens, mealViolatesAllergies } from '@/lib/allergies';
import {
  RecipeSwapSheet,
  type SwapMealRef,
} from '@/components/RecipeSwapSheet';

// Blurhash placeholder for the hero image while the real photo loads.
const HERO_BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Łatwe',
  medium: 'Średnie',
  hard: 'Trudne',
};

type Tab = 'ingredients' | 'steps' | 'substitutions';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'ingredients', label: 'Składniki' },
  { key: 'steps', label: 'Kroki' },
  { key: 'substitutions', label: 'Zamienniki' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; recipe: Recipe; householdAllergies: string[] }
  | { kind: 'error'; message: string };

export default function RecipeDetailScreen(): React.JSX.Element {
  // Plan context is optional. When the user arrives from a plan meal, the
  // caller passes planId/mealId/day/meal-type labels so we can wire the swap
  // sheet. When arriving from the recipe library (no plan context), the swap
  // CTA is disabled. id is always present.
  const params = useLocalSearchParams<{
    id: string;
    planId?: string;
    mealId?: string;
    dayLabel?: string;
    mealTypeLabel?: string;
    imageUri?: string;
  }>();
  const recipeId = typeof params.id === 'string' ? params.id : '';

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('ingredients');
  const [swapOpen, setSwapOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      const [recipe, family] = await Promise.all([
        getRecipe(recipeId),
        getHousehold(),
      ]);
      const householdAllergies = family.preferences?.allergies ?? [];
      setState({ kind: 'ready', recipe, householdAllergies });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Nie udało się wczytać przepisu.';
      setState({ kind: 'error', message });
    }
  }, [recipeId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Allergy evaluation (HARD CONSTRAINT surfacing). matchedAllergens lists the
  // household allergens that this recipe actually contains.
  const matchedAllergens = useMemo<string[]>(() => {
    if (state.kind !== 'ready') return [];
    const allergens = recipeAllergens(state.recipe);
    const household = state.householdAllergies;
    if (!mealViolatesAllergies(allergens, household)) return [];
    const lowered = new Set(allergens.map((a) => a.toLowerCase()));
    return household.filter((a) => lowered.has(a.toLowerCase()));
  }, [state]);

  // Build the swap reference only when we have plan context.
  const swapMeal = useMemo<SwapMealRef | null>(() => {
    if (state.kind !== 'ready') return null;
    const planId = typeof params.planId === 'string' ? params.planId : '';
    const mealId = typeof params.mealId === 'string' ? params.mealId : '';
    if (!planId || !mealId) return null;
    return {
      planId,
      mealId,
      recipeId: state.recipe.id,
      name: state.recipe.title,
      dayLabel: typeof params.dayLabel === 'string' ? params.dayLabel : '',
      mealTypeLabel: typeof params.mealTypeLabel === 'string' ? params.mealTypeLabel : '',
      imageUri: typeof params.imageUri === 'string' ? params.imageUri : undefined,
    };
  }, [state, params.planId, params.mealId, params.dayLabel, params.mealTypeLabel, params.imageUri]);

  if (state.kind === 'loading') {
    return <LoadingState />;
  }

  if (state.kind === 'error') {
    return <ErrorState message={state.message} onRetry={() => void load()} />;
  }

  const { recipe } = state;
  const heroUri = typeof params.imageUri === 'string' ? params.imageUri : undefined;
  const isSafe = matchedAllergens.length === 0;
  const canSwap = swapMeal !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Image
          source={heroUri ? { uri: heroUri } : undefined}
          style={styles.hero}
          contentFit="cover"
          placeholder={{ blurhash: HERO_BLURHASH }}
          transition={250}
          accessibilityIgnoresInvertColors
        />

        <View style={styles.content}>
          <Text style={styles.title}>{recipe.title}</Text>

          <View style={styles.metaRow}>
            <Tag label={`${recipe.timeMinutes} min`} />
            <Tag label={`${recipe.servings} porcji`} />
            <Badge tone="plum" label={DIFFICULTY_LABELS[recipe.difficulty]} />
          </View>

          {/* Allergy badge — HARD CONSTRAINT surfacing. Red warning always wins
              when the recipe contains a household allergen. */}
          {isSafe ? (
            <Badge tone="sage" label="Bezpieczne dla rodziny ✓" style={styles.allergyBadge} />
          ) : (
            <View style={styles.allergyWarning}>
              <Ionicons name="alert-circle" size={18} color={tokens.terraInk} />
              <Text style={styles.allergyWarningText}>
                Uwaga na alergeny: {matchedAllergens.join(', ')}
              </Text>
            </View>
          )}

          {/* Segmented tabs */}
          <View style={styles.tabBar}>
            {TABS.map(({ key, label }) => {
              const active = tab === key;
              return (
                <Text
                  key={key}
                  onPress={() => setTab(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  {label}
                </Text>
              );
            })}
          </View>

          <View style={styles.tabContent}>
            {tab === 'ingredients' ? (
              <IngredientsTab recipe={recipe} />
            ) : tab === 'steps' ? (
              <StepsTab recipe={recipe} />
            ) : (
              <SubstitutionsTab recipe={recipe} />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom CTA. Disabled when there is no plan context to swap. */}
      <View style={styles.ctaBar}>
        <Button
          variant="primary"
          disabled={!canSwap}
          onPress={() => setSwapOpen(true)}
          accessibilityLabel="Zamień w planie"
        >
          Zamień w planie
        </Button>
      </View>

      <RecipeSwapSheet
        visible={swapOpen}
        meal={swapMeal}
        onClose={() => setSwapOpen(false)}
        onSwapped={() => setSwapOpen(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

function IngredientsTab({ recipe }: { recipe: Recipe }): React.JSX.Element {
  if (recipe.ingredientsJson.length === 0) {
    return <Text style={styles.emptyTab}>Brak składników.</Text>;
  }
  return (
    <View style={styles.list}>
      {recipe.ingredientsJson.map((ing, i) => (
        <View key={`${ing.name}-${i}`} style={styles.ingredientRow}>
          <Text style={styles.ingredientName}>{ing.name}</Text>
          <Text style={styles.ingredientQty}>
            {ing.quantity} {ing.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StepsTab({ recipe }: { recipe: Recipe }): React.JSX.Element {
  if (recipe.stepsJson.length === 0) {
    return <Text style={styles.emptyTab}>Brak kroków.</Text>;
  }
  return (
    <View style={styles.list}>
      {recipe.stepsJson.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function SubstitutionsTab({ recipe }: { recipe: Recipe }): React.JSX.Element {
  if (recipe.substitutionsJson.length === 0) {
    return <Text style={styles.emptyTab}>Brak zamienników dla tego przepisu.</Text>;
  }
  return (
    <View style={styles.chipWrap}>
      {recipe.substitutionsJson.map((sub, i) => (
        <View key={`${sub.original}-${i}`} style={styles.chip}>
          <Text style={styles.chipText}>
            {sub.original} → {sub.substitute}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingState(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SkeletonBlock height={240} radius={0} />
      <View style={styles.content}>
        <SkeletonBlock width="80%" height={28} />
        <View style={styles.metaRow}>
          <SkeletonBlock width={70} height={26} radius={radii.sm} />
          <SkeletonBlock width={70} height={26} radius={radii.sm} />
        </View>
        <SkeletonBlock width="100%" height={120} radius={radii.md} />
      </View>
    </SafeAreaView>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.errorWrap}>
        <View style={styles.errorIcon}>
          <Ionicons name="warning-outline" size={40} color={tokens.terraInk} />
        </View>
        <Text style={styles.errorTitle}>Nie udało się wczytać przepisu</Text>
        <Text style={styles.errorBody}>{message}</Text>
        <Button
          variant="secondary"
          onPress={onRetry}
          accessibilityLabel="Spróbuj ponownie"
          style={styles.errorButton}
        >
          Spróbuj ponownie
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  body: { paddingBottom: 120 },

  hero: {
    width: '100%',
    height: 240,
    backgroundColor: tokens.surface2,
  },

  content: {
    padding: spacing['2xl'],
    gap: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: tokens.ink,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },

  allergyBadge: {
    alignSelf: 'flex-start',
  },
  allergyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: tokens.terraSoft,
  },
  allergyWarningText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.terraInk,
  },

  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: tokens.surface2,
    borderRadius: radii.md,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: tokens.muted,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: tokens.surface,
    color: tokens.ink,
  },

  tabContent: {
    minHeight: 80,
  },
  list: {
    gap: spacing.md,
  },

  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.line,
  },
  ingredientName: {
    flex: 1,
    fontSize: fontSize.base,
    color: tokens.ink,
  },
  ingredientQty: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: tokens.ink2,
  },

  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.sageSoft,
  },
  stepNumberText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.sageInk,
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.base,
    color: tokens.ink2,
    lineHeight: 22,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: tokens.surface2,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: tokens.ink2,
  },

  emptyTab: {
    fontSize: fontSize.base,
    color: tokens.muted,
  },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: tokens.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.line,
  },

  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  errorIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.terraSoft,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: tokens.ink,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: fontSize.base,
    color: tokens.muted,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
