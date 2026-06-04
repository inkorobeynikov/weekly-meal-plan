import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radii, spacing, tokens } from '@meal-planner/ui-native';

// F4 W02: a self-contained collapsible disclosure section used for the recipe
// detail "storage / for-kids / swaps" blocks. Expanded state is local; the
// header is a button that toggles the body.
export interface CollapsibleSectionProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  testID?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = false,
  children,
  testID,
}: CollapsibleSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  return (
    <View testID={testID} style={styles.section}>
      <Pressable
        testID={testID ? `${testID}-header` : undefined}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          {icon ? <Ionicons name={icon} size={18} color={tokens.sageInk} /> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={tokens.muted}
        />
      </Pressable>
      {expanded ? (
        <View testID={testID ? `${testID}-body` : undefined} style={styles.body}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: tokens.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tokens.line,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  title: { fontSize: fontSize.base, fontWeight: '700', color: tokens.ink },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
});
