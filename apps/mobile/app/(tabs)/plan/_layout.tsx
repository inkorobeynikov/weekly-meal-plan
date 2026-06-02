import { Stack } from 'expo-router';

// Plan tab stack: index (weekly plan) + review + recipe/[id] detail.
// Phase 3 fills in the screen content; routes are registered implicitly by file.
export default function PlanStackLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
