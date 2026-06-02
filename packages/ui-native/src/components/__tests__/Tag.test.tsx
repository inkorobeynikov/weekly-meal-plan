import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Tag } from '../Tag';

describe('Tag', () => {
  it('renders its label', () => {
    render(<Tag label="30 min" />);
    expect(screen.getByText('30 min')).toBeTruthy();
  });

  it('renders an optional icon node alongside the label', () => {
    render(<Tag icon={<Text>⏱</Text>} label="4 porcji" />);
    expect(screen.getByText('⏱')).toBeTruthy();
    expect(screen.getByText('4 porcji')).toBeTruthy();
  });
});
