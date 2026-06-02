import { fireEvent, render, screen } from '@testing-library/react-native';

import { SectionHeader } from '../SectionHeader';

describe('SectionHeader', () => {
  it('renders its title with the header role', () => {
    render(<SectionHeader title="Składniki" />);
    expect(screen.getByText('Składniki')).toBeTruthy();
    expect(screen.getByRole('header')).toBeTruthy();
  });

  it('renders an optional action and fires onActionPress', () => {
    const onActionPress = jest.fn();
    render(
      <SectionHeader title="Plan" actionLabel="Zobacz wszystko" onActionPress={onActionPress} />,
    );
    fireEvent.press(screen.getByText('Zobacz wszystko'));
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });
});
