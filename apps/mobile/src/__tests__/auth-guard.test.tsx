import type { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Capture the href passed to <Redirect /> so we can assert where the guard sends
// the user. Stack/router are stubbed to no-ops.
const capturedHref: { value: string | null } = { value: null };

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }): null => {
    capturedHref.value = href;
    return null;
  },
  Stack: ({ children }: { children?: ReactNode }): ReactNode => children ?? null,
  router: { replace: jest.fn(), push: jest.fn() },
}));

// Stub the ui-native barrel: it eagerly loads RN-coupled components and, in the
// monorepo, can pull a second react-native copy with an uninitialised native
// bridge. The guard only needs a SkeletonBlock placeholder + token/scale values.
jest.mock('@meal-planner/ui-native', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  const ReactLib = require('react') as typeof import('react');
  return {
    SkeletonBlock: (): ReactNode => ReactLib.createElement(ReactNative.View, null),
    spacing: { md: 12, '2xl': 24 },
    tokens: { bg: '#FBF7F1' },
  };
});

// Mutable session state the mocked hook reads from, so each test controls it.
const sessionState: {
  data: { user: { id: string } } | null;
  isPending: boolean;
} = { data: null, isPending: false };

jest.mock('../lib/auth', () => ({
  useSession: (): { data: { user: { id: string } } | null; isPending: boolean } => ({
    data: sessionState.data,
    isPending: sessionState.isPending,
  }),
  signOut: jest.fn(),
}));

// Onboarding completion is read async by the entry redirect; control it per-test.
const onboardingState = { complete: true };
jest.mock('../lib/onboarding', () => ({
  isOnboardingComplete: (): Promise<boolean> => Promise.resolve(onboardingState.complete),
}));

import Index from '../../app/index';

describe('index auth guard', () => {
  beforeEach(() => {
    capturedHref.value = null;
    sessionState.data = null;
    sessionState.isPending = false;
    onboardingState.complete = true;
  });

  it('redirects to login when there is no session', () => {
    sessionState.data = null;
    render(<Index />);
    expect(capturedHref.value).toBe('/(auth)/login');
  });

  it('redirects to the plan tab when a session exists and onboarding is done', async () => {
    sessionState.data = { user: { id: 'u1' } };
    onboardingState.complete = true;
    render(<Index />);
    await waitFor(() => expect(capturedHref.value).toBe('/(tabs)/plan'));
  });

  it('sends a signed-in user who has not onboarded to onboarding', async () => {
    sessionState.data = { user: { id: 'u1' } };
    onboardingState.complete = false;
    render(<Index />);
    await waitFor(() => expect(capturedHref.value).toBe('/onboarding'));
  });

  it('does not redirect while the session is still loading', () => {
    sessionState.isPending = true;
    render(<Index />);
    expect(capturedHref.value).toBeNull();
  });
});
