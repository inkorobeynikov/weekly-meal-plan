import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { registerPushToken } from './api';

// Foreground behavior: show the banner + list entry and play a sound even when
// the app is open. Set once at module load (importing this module registers it).
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

// Resolve the EAS project id getExpoPushTokenAsync needs in dev/standalone
// builds. Returns undefined when not configured (e.g. plain Expo Go), in which
// case we let the SDK attempt its own resolution.
function getProjectId(): string | undefined {
  const easProjectId = Constants.easConfig?.projectId;
  if (typeof easProjectId === 'string' && easProjectId.length > 0) {
    return easProjectId;
  }
  const extra = Constants.expoConfig?.extra;
  const eas =
    extra && typeof extra === 'object'
      ? (extra as { eas?: { projectId?: unknown } }).eas
      : undefined;
  const projectId = eas?.projectId;
  return typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined;
}

// The push-register endpoint accepts only these reporting platforms.
function currentPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Request notification permission, fetch this device's Expo push token, and
 * register it with the backend for the authenticated household. Returns the
 * token on success, or null if permission was denied / no token is available.
 * Safe to call repeatedly — the backend upserts on the token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Android requires a channel before notifications can be displayed.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResponse.data;

  await registerPushToken(token, currentPlatform());
  return token;
}

/**
 * Register for push once the user is authenticated. Failures (permission
 * denied, simulator without push support, missing projectId) are non-fatal —
 * the app works without push, it just won't receive notifications.
 */
export function usePushRegistration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void registerForPushNotificationsAsync().catch(() => {
      // Non-fatal: continue without push.
    });
  }, [enabled]);
}

type NotificationData = Record<string, unknown>;

// Map a notification's data payload to an in-app destination. The senders set
// `data.screen` (and, for feedback, `planId`) — see the Inngest functions.
function routeFromNotification(data: NotificationData | null | undefined): void {
  if (!data) return;
  const screen = typeof data.screen === 'string' ? data.screen : undefined;

  if (screen === 'feedback') {
    const planId = typeof data.planId === 'string' ? data.planId : undefined;
    if (planId) {
      router.push({ pathname: '/feedback/[planId]', params: { planId } });
      return;
    }
  }

  // Default (including the "plan ready" / retention nudge): open the plan tab.
  router.push('/(tabs)/plan');
}

/**
 * Route notification taps to the right screen. Handles both the cold start
 * (app launched by tapping a notification) and warm taps while running.
 */
export function useNotificationObserver(): void {
  useEffect(() => {
    let isMounted = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!isMounted || !response) return;
      routeFromNotification(
        response.notification.request.content.data as NotificationData,
      );
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        routeFromNotification(
          response.notification.request.content.data as NotificationData,
        );
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);
}
