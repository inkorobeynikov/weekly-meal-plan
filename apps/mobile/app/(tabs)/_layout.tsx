import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { tokens } from '@meal-planner/ui-native';

import { useSession } from '../../src/lib/auth';
import { usePushRegistration } from '../../src/lib/push';

// Bottom tab navigator. Guards the whole authenticated area: if there is no
// session, redirect to login. (While the session is still resolving we render
// nothing rather than flashing the tabs.)
export default function TabsLayout(): React.JSX.Element | null {
  const { data: session, isPending } = useSession();

  // Once authenticated, request notification permission and register this
  // device's Expo push token with the backend (replaces the Telegram channel).
  usePushRegistration(Boolean(session));

  if (isPending) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.sage,
        tabBarInactiveTintColor: tokens.muted,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.line,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Przepisy',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Zakupy',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'cart' : 'cart-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Rodzina',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
