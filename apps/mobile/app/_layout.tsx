import '../global.css';

import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setUnauthorizedHandler } from '../src/lib/api';
import { signOut } from '../src/lib/auth';
import { useNotificationObserver } from '../src/lib/push';

// Root layout. Registers the global 401 handler (so an expired/invalid token
// drops the session and bounces the user back to login) and renders the app's
// root Stack. All navigation chrome is owned by nested layouts.
export default function RootLayout(): React.JSX.Element {
  // Route notification taps to the relevant screen (plan ready -> plan tab,
  // feedback reminder -> feedback). Mounted at the root so it works app-wide.
  useNotificationObserver();

  useEffect(() => {
    // When the API rejects our token, clear the better-auth session and send the
    // user to the login screen. api.ts has already cleared the bearer token.
    setUnauthorizedHandler(() => {
      void signOut();
      router.replace('/(auth)/login');
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
