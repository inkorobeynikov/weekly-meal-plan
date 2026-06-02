module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!((jest-)?react-native|@react-native|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|nativewind|react-native-css-interop|react-native-worklets|@gorhom|@meal-planner))'
  ]
};
