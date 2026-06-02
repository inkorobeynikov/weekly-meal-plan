import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonBlock, spacing, tokens } from '@meal-planner/ui-native';

import { useSession } from '../src/lib/auth';
import { isOnboardingComplete } from '../src/lib/onboarding';

// Entry redirect. Reads the better-auth session (mockable in tests) and routes:
//   no session            -> /(auth)/login
//   session, not onboarded -> /onboarding   (W06 family setup)
//   session, onboarded     -> /(tabs)/plan
export default function Index(): React.JSX.Element {
  const { data: session, isPending } = useSession();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isOnboardingComplete().then((done) => {
      if (active) setOnboarded(done);
    });
    return () => {
      active = false;
    };
  }, []);

  // Wait for the session AND (when signed in) the onboarding flag before routing.
  const resolvingOnboarding = Boolean(session) && onboarded === null;
  if (isPending || resolvingOnboarding) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing['2xl'],
          }}
        >
          <SkeletonBlock width={180} height={28} radius={14} />
          <SkeletonBlock width={240} height={16} />
          <SkeletonBlock width={200} height={16} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!onboarded) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/plan" />;
}
