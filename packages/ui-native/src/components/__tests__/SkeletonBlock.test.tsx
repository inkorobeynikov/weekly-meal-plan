import { render, screen } from '@testing-library/react-native';

import { SkeletonBlock } from '../SkeletonBlock';

describe('SkeletonBlock', () => {
  it('renders with the Polish loading accessibility label', () => {
    render(<SkeletonBlock />);
    expect(screen.getByLabelText('Ładowanie')).toBeTruthy();
  });

  it('renders without crashing with custom dimensions', () => {
    render(<SkeletonBlock width={120} height={40} radius={8} />);
    expect(screen.getByLabelText('Ładowanie')).toBeTruthy();
  });
});
