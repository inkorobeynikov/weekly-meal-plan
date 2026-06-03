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

import { signInEmail, signInSocial } from '../../src/lib/auth';

// better-auth returns a `{ data, error }` shape. We treat any truthy `error`
// (or a thrown exception) as a failed sign-in and surface a Polish message.
function hasAuthError(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    (result as { error: unknown }).error != null
  );
}

export default function LoginScreen(): React.JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Social sign-in is opt-in: only shown when OAuth is actually configured.
  // Without Google/Apple client ids the providers 500, so hide the buttons
  // unless EXPO_PUBLIC_ENABLE_SOCIAL=true.
  const socialEnabled = process.env.EXPO_PUBLIC_ENABLE_SOCIAL === 'true';

  async function handleEmailLogin(): Promise<void> {
    setError(null);
    if (email.trim().length === 0 || password.length === 0) {
      setError('Podaj e-mail i hasło.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signInEmail({ email: email.trim(), password });
      if (hasAuthError(result)) {
        setError('Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.');
        return;
      }
      // Route through the root index so it can send first-time users to
      // onboarding (W06) before the plan tab.
      router.replace('/');
    } catch {
      setError('Nie udało się zalogować. Spróbuj ponownie.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocial(provider: 'google' | 'apple'): Promise<void> {
    setError(null);
    try {
      await signInSocial(provider);
    } catch {
      setError('Nie udało się zalogować. Spróbuj ponownie.');
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
          {/* Wordmark + tagline */}
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Ionicons name="restaurant" size={32} color={tokens.surface} />
            </View>
            <Text style={styles.wordmark}>Plan Posiłków</Text>
            <Text style={styles.tagline}>Planuj posiłki dla całej rodziny</Text>
          </View>

          {socialEnabled ? (
            <>
              {/* Social sign-in */}
              <View style={styles.socialGroup}>
                <Pressable
                  testID="login-google"
                  accessibilityRole="button"
                  accessibilityLabel="Zaloguj przez Google"
                  onPress={() => void handleSocial('google')}
                  style={styles.socialButton}
                >
                  <Ionicons name="logo-google" size={20} color={tokens.ink} />
                  <Text style={styles.socialLabel}>Zaloguj przez Google</Text>
                </Pressable>

                {Platform.OS === 'ios' ? (
                  <Pressable
                    testID="login-apple"
                    accessibilityRole="button"
                    accessibilityLabel="Zaloguj przez Apple"
                    onPress={() => void handleSocial('apple')}
                    style={styles.socialButton}
                  >
                    <Ionicons name="logo-apple" size={20} color={tokens.ink} />
                    <Text style={styles.socialLabel}>Zaloguj przez Apple</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>lub</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

          {/* Email + password */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              testID="login-email"
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
              testID="login-password"
              accessibilityLabel="Hasło"
              value={password}
              onChangeText={setPassword}
              placeholder="Twoje hasło"
              placeholderTextColor={tokens.faint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
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
            onPress={() => void handleEmailLogin()}
            accessibilityLabel="Zaloguj się"
            testID="login-submit"
            style={styles.submit}
          >
            Zaloguj się
          </Button>

          <Pressable
            testID="login-register-link"
            accessibilityRole="link"
            accessibilityLabel="Nie masz konta? Zarejestruj się"
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkRow}
          >
            <Text style={styles.linkMuted}>Nie masz konta? </Text>
            <Text style={styles.linkAccent}>Zarejestruj się</Text>
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
  socialGroup: { gap: spacing.md },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line2,
  },
  socialLabel: { fontSize: fontSize.base, fontWeight: '600', color: tokens.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: tokens.line2 },
  dividerText: { fontSize: fontSize.sm, color: tokens.muted },
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
