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
import { useLocalSearchParams } from 'expo-router';

import {
  Button,
  Card,
  SectionHeader,
  SkeletonBlock,
  fontSize,
  radii,
  spacing,
  tokens,
} from '@meal-planner/ui-native';
import type { FeedbackReaction } from '@meal-planner/shared';

import {
  getWeeklyPlan,
  submitFeedback,
  type MealWithRecipe,
  type PlanWithMealsAndRecipes,
  type SubmitFeedbackInput,
} from '../../src/lib/api';

// ---------------------------------------------------------------------------
// W09 — Weekly Feedback. The user reacts to each dish of the past week and may
// leave a free-text note. Reactions are submitted per reacted meal via
// submitFeedback (the POST /api/feedback body takes one recipeId + reaction).
// ---------------------------------------------------------------------------

interface ReactionOption {
  readonly value: FeedbackReaction;
  readonly emoji: string;
  readonly label: string;
}

// Four-step emoji scale mapped onto the FeedbackReaction enum.
const REACTIONS: readonly ReactionOption[] = [
  { value: 'favorite', emoji: '😍', label: 'Ulubione' },
  { value: 'liked', emoji: '👍', label: 'Smakowało' },
  { value: 'kids_didnt_eat', emoji: '😐', label: 'Średnio' },
  { value: 'dont_repeat', emoji: '👎', label: 'Nie powtarzać' },
];

type ReactionMap = Readonly<Record<string, FeedbackReaction>>;

function ReactionPicker({
  selected,
  onSelect,
}: {
  selected: FeedbackReaction | undefined;
  onSelect: (value: FeedbackReaction) => void;
}): React.JSX.Element {
  return (
    <View style={styles.reactionRow}>
      {REACTIONS.map((r) => {
        const isOn = selected === r.value;
        return (
          <Pressable
            key={r.value}
            onPress={() => onSelect(r.value)}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            accessibilityState={{ selected: isOn }}
            style={[styles.reactionBtn, isOn ? styles.reactionOn : styles.reactionOff]}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FeedbackScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ planId: string }>();
  const planId = typeof params.planId === 'string' ? params.planId : null;

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [meals, setMeals] = useState<MealWithRecipe[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data: PlanWithMealsAndRecipes = await getWeeklyPlan();
        if (cancelled) return;
        // Only real cooked dishes get a reaction (skip leftover placeholders).
        setMeals(data.meals.filter((m) => m.meal.mealType !== 'lunch_leftover'));
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

  const selectReaction = useCallback((mealId: string, value: FeedbackReaction) => {
    setReactions((prev) => ({ ...prev, [mealId]: value }));
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const trimmedNote = note.trim();
      // One feedback row per reacted meal. The free-text note is attached to the
      // first reacted dish (the API body has a single freeText field).
      const reactedMeals = meals.filter((m) => reactions[m.meal.id] !== undefined);

      const requests: Promise<unknown>[] = reactedMeals.map((m, index) => {
        const reaction = reactions[m.meal.id];
        if (reaction === undefined) return Promise.resolve();
        const payload: SubmitFeedbackInput = {
          recipeId: m.recipe.id,
          reaction,
          ...(index === 0 && trimmedNote.length > 0 ? { freeText: trimmedNote } : {}),
        };
        return submitFeedback(planId, payload);
      });

      await Promise.all(requests);
      setDone(true);
    } catch {
      setSubmitError('Nie udało się zapisać opinii. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  }, [meals, reactions, note, planId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <SkeletonBlock width="70%" height={28} style={{ marginBottom: spacing.xl }} />
          <SkeletonBlock width="100%" height={88} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock width="100%" height={88} style={{ marginBottom: spacing.md }} />
          <SkeletonBlock width="100%" height={88} />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-circle" size={56} color={tokens.sage} />
          <Text style={styles.emptyTitle}>Dzięki! Zapamiętam na przyszły tydzień 🙌</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Ionicons name="sad-outline" size={48} color={tokens.faint} />
          <Text style={styles.emptyTitle}>Nie udało się wczytać planu</Text>
          <Text style={styles.emptyText}>Spróbuj ponownie za chwilę.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Jak minął ten tydzień?" />
        <Text style={styles.subtitle}>
          Oceń dania — dzięki temu kolejny plan będzie jeszcze lepszy.
        </Text>

        {meals.length === 0 ? (
          <Text style={styles.emptyText}>Brak dań do oceny w tym tygodniu.</Text>
        ) : (
          meals.map((m) => (
            <Card key={m.meal.id} style={styles.mealCard}>
              <Text style={styles.mealTitle}>{m.recipe.title}</Text>
              <ReactionPicker
                selected={reactions[m.meal.id]}
                onSelect={(value) => selectReaction(m.meal.id, value)}
              />
            </Card>
          ))
        )}

        <Text style={styles.label}>Uwagi na następny tydzień?</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="np. więcej dań jednogarnkowych, mniej ryb…"
          placeholderTextColor={tokens.faint}
          style={styles.noteInput}
          accessibilityLabel="Uwagi na następny tydzień"
          multiline
          textAlignVertical="top"
        />

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Button onPress={submit} loading={submitting} style={styles.cta}>
          Zapisz opinię
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },

  subtitle: { fontSize: fontSize.base, color: tokens.muted, lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.ink2, marginTop: spacing.sm },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: tokens.ink, textAlign: 'center' },
  emptyText: { fontSize: fontSize.base, color: tokens.muted, textAlign: 'center', lineHeight: 22 },

  mealCard: { gap: spacing.md },
  mealTitle: { fontSize: fontSize.base, fontWeight: '700', color: tokens.ink },

  reactionRow: { flexDirection: 'row', gap: spacing.sm },
  reactionBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionOn: { backgroundColor: tokens.sageSoft, borderColor: tokens.sage },
  reactionOff: { backgroundColor: tokens.surface, borderColor: tokens.line2 },
  reactionEmoji: { fontSize: fontSize.xl },

  noteInput: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line2,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.base,
    color: tokens.ink,
    minHeight: 96,
  },

  errorText: { color: tokens.terra, fontSize: fontSize.sm },
  cta: { marginTop: spacing.sm },
});
