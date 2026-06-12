import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import {
  Badge,
  Button,
  RecipePlaceholder,
  SkeletonBlock,
  Tag,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { Difficulty } from '@meal-planner/shared';
import { costLevelLabel, deriveMealBadges, formatGroszeAsZl } from '@meal-planner/shared';
import { toMealCardBadges } from '@/lib/badges';

import {
  getHousehold,
  getRecipe,
  markMealCooked,
  requestRecipeForNextPlan,
  setRecipeFavorite,
  type Recipe,
} from '@/lib/api';
import { recipeAllergens, mealViolatesAllergies } from '@/lib/allergies';
import {
  RecipeSwapSheet,
  type SwapMealRef,
} from '@/components/RecipeSwapSheet';
import { CollapsibleSection } from '@/components/CollapsibleSection';

// Blurhash placeholder for the hero image while the real photo loads (used only
// when an actual imageUri is present — otherwise RecipePlaceholder is shown).
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
  // PR-4 cookbook actions — favorite heart + "add to next plan" request. Both
  // work with or without plan context (the recipe library reaches W02 too).
  const [favorite, setFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  // F4 "mark cooked": local cooked flag + in-flight guard. Requires plan context
  // (planId) — the button is hidden otherwise.
  const [cooked, setCooked] = useState(false);
  const [cookingPending, setCookingPending] = useState(false);
  const planId = typeof params.planId === 'string' ? params.planId : '';

  const onToggleCooked = useCallback(async (): Promise<void> => {
    if (!planId || state.kind !== 'ready' || cookingPending) return;
    const next = !cooked;
    setCookingPending(true);
    setCooked(next);
    try {
      await markMealCooked(planId, state.recipe.id, next);
    } catch {
      // Revert on failure so the toggle reflects the server truth.
      setCooked(!next);
    } finally {
      setCookingPending(false);
    }
  }, [planId, state, cooked, cookingPending]);

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    try {
      const [ctx, family] = await Promise.all([
        getRecipe(recipeId),
        getHousehold(),
      ]);
      const householdAllergies = family.preferences?.allergies ?? [];
      setFavorite(ctx.isFavorite);
      setRequested(ctx.isRequested);
      setState({ kind: 'ready', recipe: ctx.recipe, householdAllergies });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Nie udało się wczytać przepisu.';
      setState({ kind: 'error', message });
    }
  }, [recipeId]);

  // Optimistic favorite toggle — reverts on failure so the heart reflects the
  // server truth. Idempotent server-side (one favorite row per household+recipe).
  const onToggleFavorite = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready' || favoritePending) return;
    const next = !favorite;
    setFavoritePending(true);
    setFavorite(next);
    try {
      await setRecipeFavorite(state.recipe.id, next);
    } catch {
      setFavorite(!next);
    } finally {
      setFavoritePending(false);
    }
  }, [state, favorite, favoritePending]);

  // Queue this dish for the next generated plan. Idempotent — once requested it
  // stays requested until a plan fulfills it.
  const onAddToPlan = useCallback(async (): Promise<void> => {
    if (state.kind !== 'ready' || requestPending || requested) return;
    setRequestPending(true);
    try {
      await requestRecipeForNextPlan(state.recipe.id);
      setRequested(true);
    } catch {
      // Leave it un-requested so the user can retry.
    } finally {
      setRequestPending(false);
    }
  }, [state, requested, requestPending]);

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
  const canMarkCooked = planId.length > 0;

  // F4: derive the per-dish badges for the detail view. The recipe row persists
  // isTryNew directly; isKidFriendly/isGoodForLeftovers aren't stored on the
  // recipe, so we approximate them from the presence of their guidance notes
  // (childFriendlyNotes / leftoversNotes). A recipe is never itself a leftover
  // serving, so isLeftoverMeal is false here.
  const dishBadges = toMealCardBadges(
    deriveMealBadges({
      isKidFriendly: recipe.childFriendlyNotes !== null,
      isGoodForLeftovers: recipe.leftoversNotes !== null,
      isTryNew: recipe.isTryNew,
      isLeftoverMeal: false,
    }),
  );

  // F4 price: prefer the precise grosze estimate, fall back to the qualitative
  // cost level label.
  const priceLabel =
    formatGroszeAsZl(recipe.priceEstimateGrosze) ?? costLevelLabel(recipe.costLevel);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        {heroUri ? (
          <Image
            source={{ uri: heroUri }}
            style={styles.hero}
            contentFit="cover"
            placeholder={{ blurhash: HERO_BLURHASH }}
            transition={250}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <RecipePlaceholder
            seed={recipe.title}
            height={240}
            style={styles.heroPlaceholder}
          />
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Pressable
              testID="recipe-favorite"
              onPress={() => void onToggleFavorite()}
              disabled={favoritePending}
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              accessibilityState={{ selected: favorite }}
              hitSlop={10}
              style={styles.heart}
            >
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={favorite ? tokens.terraInk : tokens.muted}
              />
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <Tag label={`${recipe.timeMinutes} min`} />
            <Tag label={`${recipe.servings} porcji`} />
            <Badge tone="plum" label={DIFFICULTY_LABELS[recipe.difficulty]} />
            {/* F4 price indicator: precise AI estimate when present, else the
                qualitative cost level. */}
            {priceLabel ? <Badge tone="amber" label={priceLabel} /> : null}
          </View>

          {/* F4 per-dish badges (Kid-ok / Leftovers / Try-new), derived from the
              recipe flags so detail matches the day cards. */}
          {dishBadges.length > 0 ? (
            <View testID="recipe-badges" style={styles.badgeRow}>
              {dishBadges.map((b, i) => (
                <Badge key={`${b.label}-${i}`} tone={b.tone} label={b.label} />
              ))}
            </View>
          ) : null}

          {/* Allergy badge — HARD CONSTRAINT surfacing. Red warning always wins
              when the recipe contains a household allergen. */}
          {isSafe ? (
            <Badge tone="sage" label="Bezpieczne dla rodziny ✓" style={styles.allergyBadge} />
          ) : (
            <View testID="recipe-allergy-warning" style={styles.allergyWarning}>
              <Ionicons name="alert-circle" size={18} color={tokens.terraInk} />
              <Text style={styles.allergyWarningText}>
                Uwaga na alergeny: {matchedAllergens.join(', ')}
              </Text>
            </View>
          )}

          {/* PR-4: queue this dish for the next generated plan. Available with
              or without plan context (reached from the cookbook too). */}
          <Button
            variant={requested ? 'secondary' : 'primary'}
            loading={requestPending}
            disabled={requested}
            onPress={() => void onAddToPlan()}
            accessibilityLabel="Dodaj do następnego planu"
            testID="recipe-add-to-plan"
          >
            {requested ? 'Dodano do następnego planu ✓' : 'Dodaj do następnego planu'}
          </Button>

          {/* Segmented tabs — real Pressables for a proper hit-area + press feedback */}
          <View style={styles.tabBar}>
            {TABS.map(({ key, label }) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  testID={`recipe-tab-${key}`}
                  onPress={() => setTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActive,
                    pressed && styles.tabPressed,
                  ]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {label}
                  </Text>
                </Pressable>
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

          {/* F4 W02: collapsible storage / for-kids / swaps sections. Each is
              shown only when the recipe actually carries that guidance. */}
          <View style={styles.sections}>
            {recipe.storageNotes ? (
              <CollapsibleSection
                testID="recipe-section-storage"
                title="Przechowywanie"
                icon="snow-outline"
              >
                <Text style={styles.sectionText}>{recipe.storageNotes}</Text>
              </CollapsibleSection>
            ) : null}

            {recipe.childFriendlyNotes ? (
              <CollapsibleSection
                testID="recipe-section-kids"
                title="Dla dzieci"
                icon="happy-outline"
              >
                <Text style={styles.sectionText}>{recipe.childFriendlyNotes}</Text>
              </CollapsibleSection>
            ) : null}

            {recipe.substitutionsJson.length > 0 ? (
              <CollapsibleSection
                testID="recipe-section-swaps"
                title="Zamienniki składników"
                icon="swap-horizontal-outline"
              >
                <View style={styles.swapList}>
                  {recipe.substitutionsJson.map((sub, i) => (
                    <Text key={`${sub.original}-${i}`} style={styles.sectionText}>
                      • {sub.original} → {sub.substitute}
                      {sub.note ? ` (${sub.note})` : ''}
                    </Text>
                  ))}
                </View>
              </CollapsibleSection>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom CTA. Hidden entirely when there is no plan context
          (arriving from the recipe library). With plan context we offer the
          "mark cooked" action (F4 W02) and, when a meal is wired, the swap CTA. */}
      {canMarkCooked || canSwap ? (
        <View style={styles.ctaBar}>
          {canMarkCooked ? (
            <Button
              variant={cooked ? 'secondary' : 'primary'}
              loading={cookingPending}
              onPress={() => void onToggleCooked()}
              accessibilityLabel={cooked ? 'Oznacz jako nieugotowane' : 'Oznacz jako ugotowane'}
              testID="recipe-mark-cooked"
              style={styles.ctaBtn}
            >
              {cooked ? 'Ugotowane ✓' : 'Oznacz jako ugotowane'}
            </Button>
          ) : null}
          {canSwap ? (
            <Button
              variant={canMarkCooked ? 'ghost' : 'primary'}
              onPress={() => setSwapOpen(true)}
              accessibilityLabel="Zamień w planie"
              testID="recipe-swap-cta"
              style={styles.ctaBtn}
            >
              Zamień w planie
            </Button>
          ) : null}
        </View>
      ) : null}

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
  // RecipePlaceholder hero — same dimensions, no extra background needed because
  // the component fills its own background.
  heroPlaceholder: {
    borderRadius: 0,
  },

  content: {
    padding: spacing['2xl'],
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: tokens.ink,
  },
  heart: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sections: {
    gap: spacing.md,
  },
  sectionText: {
    fontSize: fontSize.base,
    color: tokens.ink2,
    lineHeight: 22,
  },
  swapList: {
    gap: spacing.xs,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: tokens.surface,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: tokens.muted,
    textAlign: 'center',
  },
  tabTextActive: {
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
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: tokens.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.line,
  },
  ctaBtn: { flex: 1 },

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
