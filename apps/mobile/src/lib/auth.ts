import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000';

// BetterAuth client wired for Expo. The expo plugin persists the session via
// SecureStore and handles the deep-link callback using the app scheme.
export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    expoClient({
      scheme: 'mealplanner',
      storagePrefix: 'mealplanner',
      storage: {
        getItem: (key: string): string | null => SecureStore.getItem(key),
        setItem: (key: string, value: string): void => {
          SecureStore.setItem(key, value);
        },
      },
    }),
  ],
});

// Re-export the session hook for screens/components.
export const useSession = authClient.useSession;

export type SocialProvider = 'google' | 'apple';

export interface EmailCredentials {
  email: string;
  password: string;
}

export interface EmailSignUpCredentials extends EmailCredentials {
  name: string;
}

// Convenience wrappers. better-auth returns a `{ data, error }` shape; we keep
// the raw return as `unknown` and narrow in callers rather than reaching for
// `any`, since the plugin's exact result type can shift between versions.
export async function signInEmail(credentials: EmailCredentials): Promise<unknown> {
  return authClient.signIn.email({
    email: credentials.email,
    password: credentials.password,
  });
}

export async function signUpEmail(credentials: EmailSignUpCredentials): Promise<unknown> {
  return authClient.signUp.email({
    email: credentials.email,
    password: credentials.password,
    name: credentials.name,
  });
}

export async function signInSocial(provider: SocialProvider): Promise<unknown> {
  return authClient.signIn.social({ provider });
}

export async function signOut(): Promise<unknown> {
  return authClient.signOut();
}
