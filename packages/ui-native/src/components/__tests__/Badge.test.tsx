import { render, screen } from '@testing-library/react-native';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge label="Wegetariańskie" />);
    expect(screen.getByText('Wegetariańskie')).toBeTruthy();
  });

  it('exposes the label via accessibility', () => {
    render(<Badge tone="amber" label="Bezglutenowe" />);
    expect(screen.getByLabelText('Bezglutenowe')).toBeTruthy();
  });
});
