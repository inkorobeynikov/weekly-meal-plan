module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!((jest-)?react-native|@react-native|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|nativewind|react-native-css-interop|react-native-worklets|@gorhom|better-auth|@better-auth|@meal-planner))'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Force a SINGLE react / react-native instance for every import (including
    // those coming from @meal-planner/ui-native). Without this, pnpm's per-peer
    // virtual store can hand out two physical react-native copies, and jest-expo
    // only initializes the native bridge for one — the other throws
    // "__fbBatchedBridgeConfig is not set".
    '^react-native$': require.resolve('react-native'),
    '^react$': require.resolve('react')
  }
};
