import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button, fontSize, radii, spacing, tokens } from '@meal-planner/ui-native';

import { signUpEmail } from '../../src/lib/auth';

// better-auth returns a `{ data, error }` shape. Any truthy `error` (or a thrown
// exception) is treated as a failed sign-up.
function hasAuthError(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    (result as { error: unknown }).error != null
  );
}

export default function RegisterScreen(): React.JSX.Element {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(): Promise<void> {
    setError(null);
    if (name.trim().length === 0 || email.trim().length === 0 || password.length === 0) {
      setError('Wypełnij wszystkie pola.');
      return;
    }
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (hasAuthError(result)) {
        setError('Nie udało się utworzyć konta. Spróbuj ponownie.');
        return;
      }
      // Route through the root index so a brand-new account lands in onboarding
      // (W06) to set up the family before the plan tab.
      router.replace('/');
    } catch {
      setError('Nie udało się utworzyć konta. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  }

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
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Ionicons name="restaurant" size={32} color={tokens.surface} />
            </View>
            <Text style={styles.wordmark}>Utwórz konto</Text>
            <Text style={styles.tagline}>Zacznij planować posiłki dla rodziny</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Imię</Text>
            <TextInput
              testID="register-name"
              accessibilityLabel="Imię"
              value={name}
              onChangeText={setName}
              placeholder="np. Jan"
              placeholderTextColor={tokens.faint}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              testID="register-email"
              accessibilityLabel="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="np. jan@przyklad.pl"
              placeholderTextColor={tokens.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Hasło</Text>
            <TextInput
              testID="register-password"
              accessibilityLabel="Hasło"
              value={password}
              onChangeText={setPassword}
              placeholder="Co najmniej 8 znaków"
              placeholderTextColor={tokens.faint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              style={styles.input}
            />
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            size="lg"
            loading={submitting}
            onPress={() => void handleRegister()}
            accessibilityLabel="Zarejestruj się"
            testID="register-submit"
            style={styles.submit}
          >
            Zarejestruj się
          </Button>

          <Pressable
            testID="register-login-link"
            accessibilityRole="link"
            accessibilityLabel="Masz już konto? Zaloguj się"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.linkRow}
          >
            <Text style={styles.linkMuted}>Masz już konto? </Text>
            <Text style={styles.linkAccent}>Zaloguj się</Text>
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
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
    gap: spacing.lg,
  },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: tokens.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  wordmark: { fontSize: fontSize.display, fontWeight: '700', color: tokens.ink },
  tagline: { fontSize: fontSize.base, color: tokens.muted, textAlign: 'center' },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: tokens.ink2 },
  input: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: tokens.ink,
  },
  error: { fontSize: fontSize.sm, color: tokens.terra },
  submit: { marginTop: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  linkMuted: { fontSize: fontSize.sm, color: tokens.muted },
  linkAccent: { fontSize: fontSize.sm, fontWeight: '700', color: tokens.sage },
});
