import * as SecureStore from 'expo-secure-store';

// Local-only onboarding gate. The `households` DB table has no
// `onboardingCompleted` column, so completion is tracked on-device via
// expo-secure-store. The web app is unaffected.

const ONBOARDING_KEY = 'onboarding_completed';
const ONBOARDING_DONE = '1';

// Returns true once the user has finished (or skipped to the end of) the W06
// onboarding wizard on this device.
export async function isOnboardingComplete(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === ONBOARDING_DONE;
}

// Marks onboarding as complete for this device.
export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, ONBOARDING_DONE);
}
