import * as SecureStore from 'expo-secure-store';

import { getHousehold } from './api';

// Onboarding gate. Completion is tracked BOTH on-device (expo-secure-store, the
// fast path) AND server-side (households.onboardingCompletedAt). The server
// marker is the durable source of truth: it lets a returning user who reinstalls
// the app — wiping the local flag — still skip onboarding based on backend
// state. The local flag is a cache so the common case avoids a network round-trip.

const ONBOARDING_KEY = 'onboarding_completed';
const ONBOARDING_DONE = '1';

// Returns true once the user has finished (or skipped to the end of) the W06
// onboarding wizard. Checks the local flag first; if it's unset (e.g. a fresh
// install of a returning user), falls back to server state and back-fills the
// local flag so subsequent checks are instant. A network failure is treated as
// "not complete" so we never strand a genuinely new user past onboarding.
export async function isOnboardingComplete(): Promise<boolean> {
  const local = await SecureStore.getItemAsync(ONBOARDING_KEY);
  if (local === ONBOARDING_DONE) return true;

  try {
    const family = await getHousehold();
    if (family.household.onboardingCompletedAt !== null) {
      // Back-fill the local cache so we don't hit the network again next launch.
      await SecureStore.setItemAsync(ONBOARDING_KEY, ONBOARDING_DONE);
      return true;
    }
  } catch {
    // Offline / no household yet — fall through to "not complete".
  }
  return false;
}

// Marks onboarding as complete for this device (local cache). The server marker
// is set separately by the onboarding finish() call to PATCH /api/family.
export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, ONBOARDING_DONE);
}
