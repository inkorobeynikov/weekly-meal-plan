// Jest setup: mock native modules that have no implementation under node so
// tests can import the api/auth clients and screens without a device.

// ---- expo-secure-store: in-memory store ----
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: (key: string): Promise<string | null> =>
      Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItemAsync: (key: string, value: string): Promise<void> => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string): Promise<void> => {
      store.delete(key);
      return Promise.resolve();
    },
    getItem: (key: string): string | null => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    deleteItem: (key: string): void => {
      store.delete(key);
    },
  };
});

// ---- expo-notifications: no-op surface ----
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted', granted: true })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExpoPushToken[test]' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
}));

// ---- @better-auth/expo client plugin: avoid network + native deep links ----
jest.mock('@better-auth/expo/client', () => ({
  expoClient: () => ({ id: 'expo' }),
}));

// ---- better-auth react client: stub the surface the app calls ----
jest.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: {
      email: jest.fn(() => Promise.resolve({ data: null, error: null })),
      social: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    signUp: {
      email: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
    signOut: jest.fn(() => Promise.resolve({ data: null, error: null })),
  }),
}));

// ---- react-native-reanimated: official jest mock ----
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // The mock omits this method; calls in animated components would otherwise throw.
  Reanimated.default.call = () => undefined;
  return Reanimated;
});
