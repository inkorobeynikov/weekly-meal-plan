import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../Card';

describe('Card', () => {
  it('renders its children', () => {
    render(
      <Card>
        <Text>Treść karty</Text>
      </Card>,
    );
    expect(screen.getByText('Treść karty')).toBeTruthy();
  });

  it('is pressable when onPress is provided', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress} accessibilityLabel="Karta">
        <Text>Treść</Text>
      </Card>,
    );
    fireEvent.press(screen.getByLabelText('Karta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
