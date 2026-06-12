import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
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
  Card,
  SkeletonBlock,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { ItemStatus } from '@meal-planner/shared';
import { formatGroszeAsZl } from '@meal-planner/shared';

import {
  addShoppingItem,
  deleteShoppingItem,
  getShoppingList,
  getWeeklyPlan,
  updateShoppingItem,
  type ShoppingListItem,
  type ShoppingListWithItems,
} from '@/lib/api';
import { usePlanGeneration } from '@/lib/usePlanGeneration';

// ---------------------------------------------------------------------------
// Pricing (F4): the backend now returns a real `estimatedPriceGrosze` (integer
// minor units) on each shopping line. We read it directly — no more defensive
// duck-typing. Money is formatted via the shared grosze→zł helper.
// ---------------------------------------------------------------------------

function itemPriceGrosze(item: ShoppingListItem): number | null {
  return typeof item.estimatedPriceGrosze === 'number' ? item.estimatedPriceGrosze : null;
}

// ---------------------------------------------------------------------------
// Promo hint label (F4): map a matched promotion to a short "Biedronka/Lidl"
// chip. We read the first promo hint's retailer when present.
// ---------------------------------------------------------------------------

function promoLabel(item: ShoppingListItem): string | null {
  const hint = item.promoHints?.[0];
  if (!hint) return null;
  const retailer = hint.retailer.trim();
  return retailer.length > 0 ? `Promocja: ${retailer}` : null;
}

// Format an ISO date as a short Polish "potrzebne do <dzień>" weekday+day label.
const WEEKDAY_SHORT = ['Nd', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'] as const;

function neededByLabel(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  const wd = WEEKDAY_SHORT[date.getDay()] ?? '';
  return `potrzebne do ${wd} ${date.getDate()}`;
}

// ---------------------------------------------------------------------------
// Category grouping. Item categories arrive as free-ish strings; we bucket them
// into a fixed set of Polish section headers, with anything unrecognised under
// "Inne".
// ---------------------------------------------------------------------------

type GroupKey = 'Warzywa' | 'Nabiał' | 'Mięso' | 'Pieczywo' | 'Inne';

const GROUP_ORDER: readonly GroupKey[] = ['Warzywa', 'Nabiał', 'Mięso', 'Pieczywo', 'Inne'];

function groupForCategory(category: string): GroupKey {
  const c = category.trim().toLowerCase();
  if (
    c.includes('warz') ||
    c.includes('owoc') ||
    c.includes('vegetable') ||
    c.includes('fruit') ||
    c.includes('produce')
  ) {
    return 'Warzywa';
  }
  if (c.includes('nabia') || c.includes('dairy') || c.includes('mlek') || c.includes('ser')) {
    return 'Nabiał';
  }
  if (
    c.includes('mię') ||
    c.includes('mie') ||
    c.includes('meat') ||
    c.includes('ryb') ||
    c.includes('fish') ||
    c.includes('drob')
  ) {
    return 'Mięso';
  }
  if (
    c.includes('piecz') ||
    c.includes('bread') ||
    c.includes('bakery') ||
    c.includes('bułk') ||
    c.includes('bulk')
  ) {
    return 'Pieczywo';
  }
  return 'Inne';
}

interface Group {
  key: GroupKey;
  items: ShoppingListItem[];
}

function groupItems(items: ShoppingListItem[]): Group[] {
  const buckets = new Map<GroupKey, ShoppingListItem[]>();
  for (const item of items) {
    const key = groupForCategory(item.category);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }
  return GROUP_ORDER.flatMap((key) => {
    const groupItemsForKey = buckets.get(key);
    return groupItemsForKey && groupItemsForKey.length > 0
      ? [{ key, items: groupItemsForKey }]
      : [];
  });
}

// ---------------------------------------------------------------------------
// Confetti — loaded lazily and guarded so jest (which mocks the module) and
// any environment lacking the native bits never hard-crash on import.
// ---------------------------------------------------------------------------

type ConfettiComponent = (props: {
  count: number;
  origin: { x: number; y: number };
  fadeOut: boolean;
  autoStart: boolean;
}) => React.JSX.Element | null;

function loadConfetti(): ConfettiComponent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-confetti-cannon') as
      | { default?: ConfettiComponent }
      | ConfettiComponent;
    const Component = (mod as { default?: ConfettiComponent }).default ?? (mod as ConfettiComponent);
    return typeof Component === 'function' ? Component : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type LoadState = 'loading' | 'ready' | 'error' | 'empty';

export default function ShoppingScreen(): React.JSX.Element {
  const [state, setState] = useState<LoadState>('loading');
  const [list, setList] = useState<ShoppingListWithItems | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [rowError, setRowError] = useState<string | null>(null);
  // F4: recipeId → title map so each shopping line can name its source recipe.
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  // Category chosen for a manually added item (defaults to "Inne").
  const [draftCategory, setDraftCategory] = useState<GroupKey>('Inne');

  // Shared async generation pattern for "Rozpocznij nowy tydzień" (F1 item 3).
  const generation = usePlanGeneration();

  const fetchList = useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      // Load the list and the current plan in parallel; the plan gives us recipe
      // titles so each line can name its source recipe (F4). A plan fetch failure
      // is non-fatal — the list still renders, just without source labels.
      const [data, plan] = await Promise.all([
        getShoppingList(),
        getWeeklyPlan().catch(() => null),
      ]);
      if (plan) {
        const map: Record<string, string> = {};
        for (const m of plan.meals) map[m.recipe.id] = m.recipe.title;
        setRecipeTitles(map);
      }
      if (!data || data.items.length === 0) {
        setList(data);
        setItems(data ? data.items : []);
        setState('empty');
        return;
      }
      setList(data);
      setItems(data.items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const setItemStatus = useCallback((id: string, status: ItemStatus): void => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  }, []);

  // Optimistic toggle bought ⇄ pending; revert on failure. The checkbox works
  // both ways so a mistakenly checked item can be un-checked.
  const handleCheck = useCallback(
    async (item: ShoppingListItem): Promise<void> => {
      const previous = item.status;
      const next: ItemStatus = item.status === 'bought' ? 'pending' : 'bought';
      setRowError(null);
      setItemStatus(item.id, next);
      try {
        await updateShoppingItem(item.id, next);
      } catch {
        setItemStatus(item.id, previous);
        setRowError('Nie udało się zaktualizować produktu. Spróbuj ponownie.');
      }
    },
    [setItemStatus],
  );

  // Optimistic mark → 'not_found'; revert on failure.
  const handleNotFound = useCallback(
    async (item: ShoppingListItem): Promise<void> => {
      const previous = item.status;
      const next: ItemStatus = item.status === 'not_found' ? 'pending' : 'not_found';
      setRowError(null);
      setItemStatus(item.id, next);
      try {
        await updateShoppingItem(item.id, next);
      } catch {
        setItemStatus(item.id, previous);
        setRowError('Nie udało się zaktualizować produktu. Spróbuj ponownie.');
      }
    },
    [setItemStatus],
  );

  const handleAdd = useCallback(async (): Promise<void> => {
    const name = draftName.trim();
    if (!name || !list) return;

    const category = draftCategory;
    // Optimistic local append with a temporary id.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ShoppingListItem = {
      id: tempId,
      shoppingListId: list.list.id,
      name,
      normalizedName: name.toLowerCase(),
      category,
      quantity: '1',
      unit: null,
      neededByDate: null,
      buyTiming: 'main_shop',
      relatedRecipeIds: [],
      status: 'pending',
      replacementText: null,
      promoHintId: null,
      estimatedPriceGrosze: null,
    };
    setItems((prev) => [...prev, optimistic]);
    setDraftName('');
    setDraftCategory('Inne');
    setAdding(false);
    setRowError(null);

    try {
      const created = await addShoppingItem(list.list.id, { name, category });
      setItems((prev) => prev.map((it) => (it.id === tempId ? created : it)));
    } catch {
      // Revert the optimistic append.
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      setRowError('Nie udało się dodać produktu. Spróbuj ponownie.');
    }
  }, [draftName, draftCategory, list]);

  // Optimistic delete; revert on failure. Used to remove a row (e.g. a
  // manually added item that is no longer needed).
  const handleDelete = useCallback(
    async (item: ShoppingListItem): Promise<void> => {
      setRowError(null);
      // Skip server call for optimistic-only temp rows (not yet persisted).
      if (item.id.startsWith('temp-')) {
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        return;
      }
      const snapshot = items;
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      try {
        await deleteShoppingItem(item.id);
      } catch {
        setItems(snapshot);
        setRowError('Nie udało się usunąć produktu. Spróbuj ponownie.');
      }
    },
    [items],
  );

  // "Rozpocznij nowy tydzień": close the loop properly. First send the user to
  // the weekly feedback screen (W09) for the finishing plan, THEN kick off
  // generation of the next plan via the shared poll pattern, surfacing any error
  // (no silent swallow). The new plan is picked up on the Plan screen's poll.
  const handleStartNewWeek = useCallback(async (): Promise<void> => {
    const finishingPlanId = list?.list.weeklyPlanId ?? null;
    if (finishingPlanId) {
      router.push({
        pathname: '/feedback/[planId]',
        params: { planId: finishingPlanId },
      });
    }
    setRowError(null);
    generation.reset();
    await generation.start();
  }, [list, generation]);

  const groups = useMemo(() => groupItems(items), [items]);
  const boughtCount = useMemo(() => items.filter((it) => it.status === 'bought').length, [items]);
  const totalCount = items.length;
  const allBought = totalCount > 0 && boughtCount === totalCount;

  // F4: total estimated cost summed in grosze (integer minor units), formatted
  // once at the end. null when no line carries an estimate.
  const totalGrosze = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const it of items) {
      const price = itemPriceGrosze(it);
      if (price !== null) {
        sum += price;
        any = true;
      }
    }
    return any ? sum : null;
  }, [items]);

  const handleShare = useCallback(async (): Promise<void> => {
    const lines = items.map((it) => `• ${it.name}${it.quantity ? ` — ${it.quantity}` : ''}`);
    try {
      await Share.share({
        message: `Lista zakupów:\n${lines.join('\n')}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }, [items]);

  // ----- loading -----------------------------------------------------------
  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <Text style={styles.title}>Zakupy</Text>
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <SkeletonBlock width={24} height={24} radius={radii.sm} />
                <View style={styles.skeletonRowText}>
                  <SkeletonBlock width="60%" height={14} />
                  <SkeletonBlock width="35%" height={11} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----- error / empty -----------------------------------------------------
  if (state === 'error' || state === 'empty') {
    const isError = state === 'error';
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <View style={styles.emptyCircle}>
            <Ionicons
              name={isError ? 'cloud-offline-outline' : 'cart-outline'}
              size={32}
              color={tokens.sageInk}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {isError ? 'Nie udało się wczytać listy' : 'Brak listy zakupów'}
          </Text>
          <Text style={styles.emptyBody}>
            {isError
              ? 'Sprawdź połączenie i spróbuj ponownie.'
              : 'Brak listy zakupów — zatwierdź plan, aby ją wygenerować.'}
          </Text>
          {isError ? (
            <View style={styles.emptyAction}>
              <Button variant="secondary" onPress={() => void fetchList()}>
                Spróbuj ponownie
              </Button>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // ----- W08 celebration ---------------------------------------------------
  if (allBought) {
    return (
      <Celebration
        onShare={handleShare}
        onNewWeek={() => void handleStartNewWeek()}
        starting={generation.generating}
        error={generation.error}
      />
    );
  }

  // ----- W03 list ----------------------------------------------------------
  const progressPct = totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.container}>
          <Text style={styles.title}>Zakupy</Text>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {boughtCount} z {totalCount} produktów kupionych
              </Text>
              <Text style={styles.progressPct}>{progressPct}%</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: totalCount, now: boughtCount }}
              style={styles.progressTrack}
            >
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>

          {rowError ? <Text style={styles.rowError}>{rowError}</Text> : null}
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollBody}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeader}>{group.key}</Text>
                <Text style={styles.groupCount}>
                  {group.items.filter((it) => it.status === 'bought').length}/{group.items.length}
                </Text>
              </View>
              <Card style={styles.groupCard}>
                {group.items.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    recipeTitles={recipeTitles}
                    last={idx === group.items.length - 1}
                    onCheck={() => void handleCheck(item)}
                    onNotFound={() => void handleNotFound(item)}
                    onDelete={() => void handleDelete(item)}
                  />
                ))}
              </Card>
            </View>
          ))}

          {/* inline add */}
          {adding ? (
            <View style={styles.addBlock}>
              <View style={styles.addRow}>
                <TextInput
                  testID="shopping-add-input"
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Nazwa produktu"
                  placeholderTextColor={tokens.faint}
                  style={styles.addInput}
                  autoFocus
                  accessibilityLabel="Nazwa produktu"
                  onSubmitEditing={() => void handleAdd()}
                  returnKeyType="done"
                />
                <Button testID="shopping-add-confirm" size="sm" onPress={() => void handleAdd()}>
                  Dodaj
                </Button>
              </View>
              <View style={styles.categoryRow}>
                {GROUP_ORDER.map((cat) => {
                  const on = cat === draftCategory;
                  return (
                    <Pressable
                      key={cat}
                      testID={`shopping-category-${cat}`}
                      onPress={() => setDraftCategory(cat)}
                      accessibilityRole="button"
                      accessibilityLabel={`Kategoria: ${cat}`}
                      accessibilityState={{ selected: on }}
                      style={[styles.categoryChip, on && styles.categoryChipOn]}
                    >
                      <Text
                        style={[styles.categoryChipText, on && styles.categoryChipTextOn]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Szacowany koszt:</Text>
          <Text style={styles.footerValue}>{formatGroszeAsZl(totalGrosze) ?? '—'}</Text>
        </View>

        {/* FAB */}
        {!adding ? (
          <Pressable
            testID="shopping-add-fab"
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel="Dodaj ręcznie"
            style={styles.fab}
          >
            <Ionicons name="add" size={26} color={tokens.surface} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: ShoppingListItem;
  recipeTitles: Record<string, string>;
  last: boolean;
  onCheck: () => void;
  onNotFound: () => void;
  onDelete: () => void;
}

function ItemRow({
  item,
  recipeTitles,
  last,
  onCheck,
  onNotFound,
  onDelete,
}: ItemRowProps): React.JSX.Element {
  const checked = item.status === 'bought';
  const notFound = item.status === 'not_found';
  const priceText = formatGroszeAsZl(itemPriceGrosze(item));
  const qtyText = item.unit ? `${item.quantity} ${item.unit}` : item.quantity;

  // F4: source recipe(s) for this line, "potrzebne do <dzień>", and any promo.
  const sources = item.relatedRecipeIds
    .map((id) => recipeTitles[id])
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
  const sourceText = sources.length > 0 ? sources.join(', ') : null;
  const neededBy = neededByLabel(item.neededByDate);
  const promo = promoLabel(item);

  return (
    <View style={[styles.itemRow, !last && styles.itemRowBorder, checked && styles.itemRowDone]}>
      <Pressable
        testID={`shopping-check-${item.id}`}
        onPress={onCheck}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={item.name}
        style={[styles.checkbox, checked && styles.checkboxChecked]}
      >
        {checked ? <Ionicons name="checkmark" size={15} color={tokens.surface} /> : null}
      </Pressable>

      <View style={styles.itemBody}>
        <View style={styles.itemNameRow}>
          <Text
            style={[
              styles.itemName,
              (checked || notFound) && styles.itemNameStruck,
            ]}
          >
            {item.name}
          </Text>
          {qtyText ? <Text style={styles.itemQty}>{qtyText}</Text> : null}
        </View>

        {/* F4: source recipe + needed-by day. */}
        {sourceText ? (
          <Text testID={`shopping-source-${item.id}`} style={styles.itemSource} numberOfLines={1}>
            {sourceText}
          </Text>
        ) : null}

        <View style={styles.itemMetaRow}>
          {priceText !== null ? <Text style={styles.itemPrice}>{priceText}</Text> : null}
          {neededBy ? (
            <View testID={`shopping-neededby-${item.id}`} style={styles.neededByChip}>
              <Ionicons name="calendar-outline" size={11} color={tokens.muted} />
              <Text style={styles.neededByText}>{neededBy}</Text>
            </View>
          ) : null}
          {promo ? (
            <View testID={`shopping-promo-${item.id}`} style={styles.promoChip}>
              <Ionicons name="pricetag-outline" size={11} color={tokens.amberInk} />
              <Text style={styles.promoText}>{promo}</Text>
            </View>
          ) : null}
          {notFound ? (
            <View style={styles.notFoundBadge}>
              <Text style={styles.notFoundBadgeText}>Nie znaleziono</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        testID={`shopping-notfound-${item.id}`}
        onPress={onNotFound}
        accessibilityRole="button"
        accessibilityLabel={`Nie znaleziono: ${item.name}`}
        style={styles.notFoundBtn}
      >
        <Ionicons
          name={notFound ? 'arrow-undo-outline' : 'close-circle-outline'}
          size={20}
          color={notFound ? tokens.muted : tokens.terra}
        />
      </Pressable>

      <Pressable
        testID={`shopping-delete-${item.id}`}
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Usuń: ${item.name}`}
        hitSlop={6}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={18} color={tokens.muted} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// W08 — Celebration
// ---------------------------------------------------------------------------

interface CelebrationProps {
  onShare: () => void;
  onNewWeek: () => void;
  starting: boolean;
  error: string | null;
}

function Celebration({ onShare, onNewWeek, starting, error }: CelebrationProps): React.JSX.Element {
  const Confetti = useRef<ConfettiComponent | null>(loadConfetti()).current;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View testID="shopping-celebration" style={styles.celebrate}>
        <View style={styles.celebrateCircle}>
          <Ionicons name="checkmark-done" size={40} color={tokens.surface} />
        </View>
        <Text style={styles.celebrateHeading}>Wszystko kupione! 🎉</Text>
        <Text style={styles.celebrateBody}>
          Świetna robota — cała lista odhaczona. Czas gotować!
        </Text>

        {error ? (
          <Text testID="shopping-new-week-error" style={styles.rowError}>
            {error}
          </Text>
        ) : null}

        <View style={styles.celebrateActions}>
          <Button testID="shopping-share" onPress={onShare}>Udostępnij listę</Button>
          <Button
            testID="shopping-new-week"
            variant="secondary"
            loading={starting}
            onPress={onNewWeek}
          >
            {starting ? 'Rozpoczynam…' : 'Rozpocznij nowy tydzień'}
          </Button>
        </View>
      </View>

      {Confetti ? (
        <View style={styles.confettiLayer} pointerEvents="none">
          <Confetti count={120} origin={{ x: 0, y: 0 }} fadeOut autoStart />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  flex: { flex: 1 },
  container: { paddingHorizontal: spacing['2xl'], paddingTop: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.display, fontWeight: '700', color: tokens.ink },

  // skeleton
  skeletonWrap: { gap: spacing.md, marginTop: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonRowText: { flex: 1, gap: spacing.xs },

  // empty / error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
    gap: spacing.md,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: tokens.ink, textAlign: 'center' },
  emptyBody: { fontSize: fontSize.sm, color: tokens.muted, textAlign: 'center' },
  emptyAction: { marginTop: spacing.md, alignSelf: 'stretch' },

  // progress
  progressWrap: { gap: spacing.sm },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: fontSize.sm, fontWeight: '600', color: tokens.ink2 },
  progressPct: { fontSize: fontSize.sm, color: tokens.muted },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.surface2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: tokens.sage },

  rowError: { fontSize: fontSize.xs, color: tokens.terraInk, fontWeight: '600' },

  // list
  listScroll: { flex: 1 },
  listScrollBody: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  group: { gap: spacing.sm },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  groupHeader: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.ink },
  groupCount: { fontSize: fontSize.xs, fontWeight: '600', color: tokens.muted },
  groupCard: { padding: 0 },

  // item row
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: tokens.line },
  itemRowDone: { opacity: 0.6 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm - 3,
    borderWidth: 1.6,
    borderColor: tokens.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: tokens.sage, borderColor: tokens.sage },
  itemBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  itemNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  itemName: { fontSize: fontSize.base, fontWeight: '600', color: tokens.ink },
  itemNameStruck: { textDecorationLine: 'line-through', color: tokens.muted },
  itemQty: { fontSize: fontSize.xs, color: tokens.muted, fontWeight: '500' },
  itemSource: { fontSize: fontSize.xs, color: tokens.muted },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  itemPrice: { fontSize: fontSize.xs, color: tokens.ink2, fontWeight: '700' },
  neededByChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  neededByText: { fontSize: fontSize.xs, color: tokens.muted, fontWeight: '500' },
  promoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: tokens.amberSoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  promoText: { fontSize: fontSize.xs, color: tokens.amberInk, fontWeight: '700' },
  notFoundBadge: {
    backgroundColor: tokens.terraSoft,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  notFoundBadgeText: { fontSize: fontSize.xs, color: tokens.terraInk, fontWeight: '700' },
  notFoundBtn: { padding: spacing.xs },
  deleteBtn: { padding: spacing.xs },

  // add
  addBlock: { gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.line2,
    backgroundColor: tokens.surface,
  },
  categoryChipOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  categoryChipText: { fontSize: fontSize.xs, fontWeight: '600', color: tokens.muted },
  categoryChipTextOn: { color: tokens.sageInk },
  addInput: {
    flex: 1,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line2,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
    color: tokens.ink,
  },

  // footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.line,
    backgroundColor: tokens.surface,
  },
  footerLabel: { fontSize: fontSize.sm, color: tokens.ink2, fontWeight: '600' },
  footerValue: { fontSize: fontSize.lg, color: tokens.ink, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // celebration
  celebrate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
    gap: spacing.md,
  },
  celebrateCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tokens.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  celebrateHeading: { fontSize: fontSize.xl, fontWeight: '700', color: tokens.ink, textAlign: 'center' },
  celebrateBody: { fontSize: fontSize.sm, color: tokens.muted, textAlign: 'center' },
  celebrateActions: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md },
  confettiLayer: { ...StyleSheet.absoluteFillObject },
});
