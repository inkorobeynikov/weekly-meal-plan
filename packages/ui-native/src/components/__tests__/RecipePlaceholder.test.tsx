import { render, screen } from '@testing-library/react-native';

import { RecipePlaceholder } from '../RecipePlaceholder';

describe('RecipePlaceholder', () => {
  it('renders without crashing for a given seed', () => {
    render(<RecipePlaceholder seed="Makaron z kurczakiem" />);
    // The accessibility label must contain the seed text.
    expect(screen.getByLabelText(/Makaron z kurczakiem/)).toBeTruthy();
  });

  it('renders with a custom height prop', () => {
    render(<RecipePlaceholder seed="Zupa pomidorowa" height={240} />);
    expect(screen.getByLabelText(/Zupa pomidorowa/)).toBeTruthy();
  });

  it('is deterministic — same seed renders the same accessible label', () => {
    const { unmount } = render(<RecipePlaceholder seed="Schabowy" />);
    expect(screen.getByLabelText('Placeholder dla Schabowy')).toBeTruthy();
    unmount();
    render(<RecipePlaceholder seed="Schabowy" />);
    expect(screen.getByLabelText('Placeholder dla Schabowy')).toBeTruthy();
  });

  it('accepts an optional testID', () => {
    render(<RecipePlaceholder seed="Łosoś pieczony" testID="recipe-hero" />);
    expect(screen.getByTestId('recipe-hero')).toBeTruthy();
  });
});
