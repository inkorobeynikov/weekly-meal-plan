import { Stack } from 'expo-router';

// Wraps the recipes tab in a Stack so the route resolves to a single `recipes`
// screen (matching <Tabs.Screen name="recipes">). Without this layout Expo
// Router exposes the raw `recipes/index` route and mislabels the tab.
export default function RecipesLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
