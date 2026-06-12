import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fontSize, radii, spacing, tokens } from '@meal-planner/ui-native';

// Password-reset screen — stub until the backend reset endpoint is implemented.
// Explains to the user how to recover their account and provides a back link.
export default function ForgotPasswordScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={32} color={tokens.sage} />
          </View>

          <Text style={styles.title}>Nie pamiętasz hasła?</Text>

          <Text style={styles.body}>
            Resetowanie hasła przez e-mail jest w przygotowaniu. W tej chwili skontaktuj się z
            administratorem aplikacji, podając swój adres e-mail, a hasło zostanie zresetowane
            ręcznie.
          </Text>

          <Pressable
            testID="forgot-password-back"
            accessibilityRole="link"
            accessibilityLabel="Wróć do logowania"
            onPress={() => router.back()}
            style={styles.backRow}
          >
            <Ionicons name="arrow-back-outline" size={16} color={tokens.sage} />
            <Text style={styles.backLabel}>Wróć do logowania</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
    gap: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: tokens.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.ink,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.base,
    color: tokens.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  backLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: tokens.sage,
  },
});
