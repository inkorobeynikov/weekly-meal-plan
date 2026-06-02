import type { ReactNode } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

// --- expo-router: capture <Redirect href> and the imperative router calls. ----
const capturedHref: { value: string | null } = { value: null };
const mockReplace: jest.Mock<void, [string]> = jest.fn();
const mockPush: jest.Mock<void, [string]> = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }): null => {
    capturedHref.value = href;
    return null;
  },
  router: {
    replace: (path: string): void => mockReplace(path),
    push: (path: string): void => mockPush(path),
  },
}));

// Stub the ui-native barrel exactly as the auth-guard test does: it eagerly
// loads RN-coupled components which can pull a second react-native copy in the
// monorepo. The entry redirect only needs SkeletonBlock + token/scale values.
jest.mock('@meal-planner/ui-native', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  const ReactLib = require('react') as typeof import('react');
  return {
    SkeletonBlock: (): ReactNode => ReactLib.createElement(ReactNative.View, null),
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, '2xl': 24, '3xl': 32 },
    tokens: {
      bg: '#FBF7F1',
      surface: '#FFFFFF',
      ink: '#2B2B2B',
      ink2: '#3A3A3A',
      muted: '#7A6F62',
      faint: '#B8AFA3',
      sage: '#6E8C5A',
      terra: '#C0573B',
      line2: 'rgba(0,0,0,0.08)',
    },
    fontSize: { sm: 13, base: 16, display: 28 },
    radii: { md: 12, lg: 16 },
    Button: (props: {
      children?: ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }): ReactNode =>
      ReactLib.createElement(
        ReactNative.Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: props.accessibilityLabel,
          onPress: props.onPress,
        },
        ReactLib.createElement(ReactNative.Text, null, props.children),
      ),
  };
});

// Mutable session state + a signInEmail mock the login screen awaits. The
// wrapper returns better-auth's `{ data, error }` shape; success === no error.
const sessionState: {
  data: { user: { id: string } } | null;
  isPending: boolean;
} = { data: null, isPending: false };

const mockSignInEmail: jest.Mock<
  Promise<{ data: { user: { id: string } } | null; error: unknown }>,
  [{ email: string; password: string }]
> = jest.fn();

jest.mock('../lib/auth', () => ({
  useSession: (): { data: { user: { id: string } } | null; isPending: boolean } => ({
    data: sessionState.data,
    isPending: sessionState.isPending,
  }),
  signInEmail: (credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: { id: string } } | null; error: unknown }> =>
    mockSignInEmail(credentials),
  signInSocial: jest.fn(() => Promise.resolve({ data: null, error: null })),
  signOut: jest.fn(),
}));

jest.mock('../lib/onboarding', () => ({
  isOnboardingComplete: (): Promise<boolean> => Promise.resolve(true),
}));

import Index from '../../app/index';
import LoginScreen from '../../app/(auth)/login';

beforeEach(() => {
  capturedHref.value = null;
  mockReplace.mockReset();
  mockPush.mockReset();
  sessionState.data = null;
  sessionState.isPending = false;
  mockSignInEmail.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

describe('Auth flow: unauthenticated -> authenticated', () => {
  it('sends an unauthenticated user to the login screen', () => {
    sessionState.data = null;
    render(<Index />);
    expect(capturedHref.value).toBe('/(auth)/login');
  });

  it('logs in with email/password and routes through the entry redirect on success', async () => {
    const { getByLabelText } = render(<LoginScreen />);

    fireEvent.changeText(getByLabelText('E-mail'), 'jan@przyklad.pl');
    fireEvent.changeText(getByLabelText('Hasło'), 'sekret123');
    fireEvent.press(getByLabelText('Zaloguj się'));

    await waitFor(() =>
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: 'jan@przyklad.pl',
        password: 'sekret123',
      }),
    );
    // Login routes to the root index, which then decides onboarding vs. plan tab.
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('does not navigate when sign-in returns an error', async () => {
    mockSignInEmail.mockResolvedValue({ data: null, error: { message: 'bad creds' } });

    const { getByLabelText } = render(<LoginScreen />);
    fireEvent.changeText(getByLabelText('E-mail'), 'jan@przyklad.pl');
    fireEvent.changeText(getByLabelText('Hasło'), 'wrong');
    fireEvent.press(getByLabelText('Zaloguj się'));

    await waitFor(() => expect(mockSignInEmail).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
