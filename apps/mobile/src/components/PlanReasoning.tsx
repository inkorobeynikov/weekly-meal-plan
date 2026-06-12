import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radii, spacing, tokens } from '@meal-planner/ui-native';

// F4 "intelligent surface": the AI "why this plan" reasoning block surfaced on
// W01 (plan/index) and W04 (review). Renders nothing when there is no reasoning
// text so older plans (null aiReasoningSummary) degrade gracefully.
export interface PlanReasoningProps {
  reasoning: string | null | undefined;
  testID?: string;
}

export function PlanReasoning({
  reasoning,
  testID,
}: PlanReasoningProps): React.JSX.Element | null {
  const text = reasoning?.trim();
  if (!text) return null;
  return (
    <View testID={testID ?? 'plan-reasoning'} style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={16} color={tokens.sageInk} />
        <Text style={styles.heading}>Dlaczego ten plan</Text>
      </View>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.sageSoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heading: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.sageInk },
  body: { fontSize: fontSize.sm, color: tokens.ink2, lineHeight: 21 },
});
