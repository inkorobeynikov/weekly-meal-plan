import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, fontSize, spacing, tokens } from '@meal-planner/ui-native';

// Recipes tab entry. Real-ish empty state for now; Phase 3 wires in saved
// recipes + search.
export default function RecipesScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <SectionHeader title="Przepisy" />
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Ionicons name="restaurant-outline" size={36} color={tokens.sageInk} />
          </View>
          <Text style={styles.emptyTitle}>Brak zapisanych przepisów</Text>
          <Text style={styles.emptyBody}>
            Przepisy z Twoich planów posiłków pojawią się tutaj.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  container: { flex: 1, padding: spacing['2xl'], gap: spacing.lg },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tokens.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: tokens.ink },
  emptyBody: {
    fontSize: fontSize.base,
    color: tokens.muted,
    textAlign: 'center',
  },
});
