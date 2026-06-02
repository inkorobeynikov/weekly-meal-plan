import { Stack } from 'expo-router';

// Auth flow (login / register). No header chrome — screens own their layout.
export default function AuthLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
