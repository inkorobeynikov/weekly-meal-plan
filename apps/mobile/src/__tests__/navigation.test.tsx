import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

// --- Mock expo-router: Tabs renders each child's `title` as a label so we can
// assert the tab set without the real navigator. Redirect is captured too. ---
interface TabScreenProps {
  name: string;
  options?: { title?: string };
}

interface TabsComponent {
  ({ children }: { children: ReactNode }): ReactElement;
  Screen: (props: TabScreenProps) => null;
}

jest.mock('expo-router', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  const ReactLib = require('react') as typeof import('react');

  const Tabs = (({ children }: { children: ReactNode }): ReactElement => {
    const labels: string[] = [];
    ReactLib.Children.forEach(children, (child) => {
      if (ReactLib.isValidElement<TabScreenProps>(child)) {
        const title = child.props.options?.title;
        if (typeof title === 'string') labels.push(title);
      }
    });
    return ReactLib.createElement(
      ReactNative.View,
      null,
      labels.map((label) =>
        ReactLib.createElement(ReactNative.Text, { key: label }, label),
      ),
    );
  }) as unknown as TabsComponent;
  Tabs.Screen = (_props: TabScreenProps): null => null;

  return {
    Tabs,
    Redirect: (): null => null,
    Stack: ({ children }: { children?: ReactNode }): ReactNode => children ?? null,
    router: { replace: jest.fn(), push: jest.fn() },
  };
});

// The ui-native barrel eagerly loads RN-coupled components (StyleSheet at
// module load). In the monorepo that can resolve a second react-native copy
// whose native bridge jest-expo did not initialise, so we stub the only token
// the layout reads.
jest.mock('@meal-planner/ui-native', () => ({
  tokens: { sage: '#6E8C5A', muted: '#7A6F62', surface: '#FFFFFF', line: 'rgba(0,0,0,0.08)' },
}));

// Keep a session present so the guard renders the Tabs (not a Redirect).
jest.mock('../lib/auth', () => ({
  useSession: (): { data: { user: { id: string } }; isPending: boolean } => ({
    data: { user: { id: 'u1' } },
    isPending: false,
  }),
  signOut: jest.fn(),
}));

// Reference the imports so the linter does not flag them as unused when the
// mock factory captures the real modules instead.
void Children;
void isValidElement;
void View;
void Text;

import TabsLayout from '../../app/(tabs)/_layout';

describe('tab navigation', () => {
  it('renders the four tab labels', () => {
    const { getByText } = render(<TabsLayout />);
    expect(getByText('Plan')).toBeTruthy();
    expect(getByText('Przepisy')).toBeTruthy();
    expect(getByText('Zakupy')).toBeTruthy();
    expect(getByText('Rodzina')).toBeTruthy();
  });
});
