import { render, screen } from '@testing-library/react-native';

import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('renders initials fallback and labels itself with the name', () => {
    render(<Avatar name="Piotr Kowalski" />);
    expect(screen.getByText('PK')).toBeTruthy();
    expect(screen.getByLabelText('Piotr Kowalski')).toBeTruthy();
  });

  it('renders without crashing for a single-word name', () => {
    render(<Avatar name="Ania" size="sm" />);
    expect(screen.getByText('A')).toBeTruthy();
  });
});
