import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
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
  Badge,
  Button,
  RecipePlaceholder,
  SectionHeader,
  SkeletonBlock,
  Tag,
  fontSize,
  radii,
  shadowStyle,
  spacing,
  tokens,
} from '@meal-planner/ui-native';

import {
  getFamilyCookbook,
  requestRecipeForNextPlan,
  setRecipeFavorite,
  type CookbookEntry,
  type FamilyCookbook,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Date helper — lastCookedAt is an ISO timestamp; show a compact DD.MM label.
// ---------------------------------------------------------------------------

function formatCookedDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; cookbook: FamilyCookbook }
  | { kind: 'error'; message: string };

export default function RecipesScreen(): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // Optimistic per-recipe overrides so heart / add-to-plan reflect instantly
  // across every section the recipe appears in, without a full refetch.
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [requestedOverrides, setRequestedOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const load = useCallback(async (): Promise<void> => {
    try {
      const cookbook = await getFamilyCookbook();
      setFavoriteOverrides({});
      setRequestedOverrides({});
      setState({ kind: 'ready', cookbook });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Nie udało się wczytać przepisów.';
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

  const isFavorite = useCallback(
    (entry: CookbookEntry): boolean =>
      favoriteOverrides[entry.recipe.id] ?? entry.isFavorite,
    [favoriteOverrides],
  );
  const isRequested = useCallback(
    (entry: CookbookEntry): boolean =>
      requestedOverrides[entry.recipe.id] ?? entry.isRequested,
    [requestedOverrides],
  );

  const onToggleFavorite = useCallback(
    async (recipeId: string, current: boolean): Promise<void> => {
      if (pending[recipeId]) return;
      const next = !current;
      setPending((p) => ({ ...p, [recipeId]: true }));
      setFavoriteOverrides((o) => ({ ...o, [recipeId]: next }));
      try {
        await setRecipeFavorite(recipeId, next);
      } catch {
        setFavoriteOverrides((o) => ({ ...o, [recipeId]: current }));
      } finally {
        setPending((p) => ({ ...p, [recipeId]: false }));
      }
    },
    [pending],
  );

  const onAddToPlan = useCallback(
    async (recipeId: string): Promise<void> => {
      if (pending[recipeId]) return;
      setPending((p) => ({ ...p, [recipeId]: true }));
      setRequestedOverrides((o) => ({ ...o, [recipeId]: true }));
      try {
        await requestRecipeForNextPlan(recipeId);
      } catch {
        setRequestedOverrides((o) => ({ ...o, [recipeId]: false }));
      } finally {
        setPending((p) => ({ ...p, [recipeId]: false }));
      }
    },
    [pending],
  );

  const openRecipe = useCallback((recipeId: string): void => {
    router.push({
      pathname: '/(tabs)/recipes/recipe/[id]',
      params: { id: recipeId },
    });
  }, []);

  // Search filters the family's own recipes by title (PR-4: search WITHIN the
  // cookbook, never the full pool).
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = useMemo<CookbookEntry[]>(() => {
    if (state.kind !== 'ready' || normalizedQuery.length === 0) return [];
    return state.cookbook.all.filter((e) =>
      e.recipe.title.toLowerCase().includes(normalizedQuery),
    );
  }, [state, normalizedQuery]);

  const renderCard = useCallback(
    (entry: CookbookEntry): React.JSX.Element => (
      <CookbookCard
        key={entry.recipe.id}
        entry={entry}
        favorite={isFavorite(entry)}
        requested={isRequested(entry)}
        busy={pending[entry.recipe.id] ?? false}
        onOpen={() => openRecipe(entry.recipe.id)}
        onToggleFavorite={() =>
          void onToggleFavorite(entry.recipe.id, isFavorite(entry))
        }
        onAddToPlan={() => void onAddToPlan(entry.recipe.id)}
      />
    ),
    [isFavorite, isRequested, pending, openRecipe, onToggleFavorite, onAddToPlan],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <SectionHeader title="Przepisy" />
      </View>

      {state.kind === 'loading' ? (
        <LoadingState />
      ) : state.kind === 'error' ? (
        <ErrorState message={state.message} onRetry={() => void load()} />
      ) : state.cookbook.all.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={tokens.sage}
            />
          }
        >
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={tokens.muted} />
            <TextInput
              testID="recipes-search"
              value={query}
              onChangeText={setQuery}
              placeholder="Szukaj w waszych daniach"
              placeholderTextColor={tokens.muted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityLabel="Wyczyść wyszukiwanie"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={tokens.muted} />
              </Pressable>
            ) : null}
          </View>

          {normalizedQuery.length > 0 ? (
            <Section title="Wyniki">
              {searchResults.length === 0 ? (
                <Text style={styles.noResults}>
                  Brak dań pasujących do „{query.trim()}”.
                </Text>
              ) : (
                searchResults.map(renderCard)
              )}
            </Section>
          ) : (
            <>
              {state.cookbook.favorites.length > 0 ? (
                <Section title="Ulubione">
                  {state.cookbook.favorites.map(renderCard)}
                </Section>
              ) : null}

              {state.cookbook.recentlyCooked.length > 0 ? (
                <Section title="Ostatnio gotowane">
                  {state.cookbook.recentlyCooked.map(renderCard)}
                </Section>
              ) : null}

              <Section title="Wszystkie wasze dania">
                {state.cookbook.all.map(renderCard)}
              </Section>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Cookbook card
// ---------------------------------------------------------------------------

interface CookbookCardProps {
  entry: CookbookEntry;
  favorite: boolean;
  requested: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onAddToPlan: () => void;
}

function CookbookCard({
  entry,
  favorite,
  requested,
  busy,
  onOpen,
  onToggleFavorite,
  onAddToPlan,
}: CookbookCardProps): React.JSX.Element {
  const { recipe, lastCookedAt, timesPlanned } = entry;
  return (
    <View testID={`cookbook-card-${recipe.id}`} style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        style={styles.cardTop}
      >
        <RecipePlaceholder seed={recipe.title} height={64} style={styles.thumb} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
          <View style={styles.metaRow}>
            <Tag label={`${recipe.timeMinutes} min`} />
            {lastCookedAt ? (
              <Badge tone="sage" label={`Gotowane ${formatCookedDate(lastCookedAt)}`} />
            ) : timesPlanned > 0 ? (
              <Badge tone="blue" label={`Zaplanowane ${timesPlanned}×`} />
            ) : null}
          </View>
        </View>
        <Pressable
          testID={`cookbook-favorite-${recipe.id}`}
          onPress={onToggleFavorite}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          style={styles.heart}
        >
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={22}
            color={favorite ? tokens.terraInk : tokens.muted}
          />
        </Pressable>
      </Pressable>

      <Button
        variant={requested ? 'secondary' : 'ghost'}
        size="sm"
        loading={busy && !requested}
        disabled={requested || busy}
        onPress={onAddToPlan}
        accessibilityLabel="Dodaj do następnego planu"
        testID={`cookbook-add-${recipe.id}`}
      >
        {requested ? 'W następnym planie ✓' : 'Dodaj do następnego planu'}
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBlock height={64} radius={radii.md} />
          <SkeletonBlock width="70%" height={18} />
          <SkeletonBlock width="40%" height={14} />
        </View>
      ))}
    </View>
  );
}

// Empty state for brand-new households — nothing cooked or rated yet.
function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name="restaurant-outline" size={40} color={tokens.sageInk} />
      </View>
      <Text style={styles.emptyTitle}>Wasza książka kucharska jest pusta</Text>
      <Text style={styles.emptyBody}>
        Twoje dania pojawią się tu po pierwszym planie.
      </Text>
    </View>
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
    <View style={styles.centered}>
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <Ionicons name="warning-outline" size={40} color={tokens.terraInk} />
      </View>
      <Text style={styles.emptyTitle}>Coś poszło nie tak</Text>
      <Text style={styles.emptyBody}>{message}</Text>
      <Button
        variant="secondary"
        onPress={onRetry}
        accessibilityLabel="Spróbuj ponownie"
        style={styles.retryButton}
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
  scrollBody: { paddingBottom: 120, gap: spacing.xl },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing['2xl'],
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: tokens.ink,
    padding: 0,
  },

  section: {
    gap: spacing.md,
    paddingHorizontal: spacing['2xl'],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: tokens.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    gap: spacing.md,
  },
  noResults: {
    fontSize: fontSize.base,
    color: tokens.muted,
  },

  card: {
    backgroundColor: tokens.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadowStyle.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  cardInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: tokens.ink,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface2,
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
  errorIcon: {
    backgroundColor: tokens.terraSoft,
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
  retryButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
