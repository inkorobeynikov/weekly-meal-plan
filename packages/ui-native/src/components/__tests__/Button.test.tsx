import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('renders its label and exposes the button role', () => {
    render(<Button onPress={() => {}}>Zapisz</Button>);
    expect(screen.getByText('Zapisz')).toBeTruthy();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Zatwierdź</Button>);
    fireEvent.press(screen.getByText('Zatwierdź'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a busy indicator and does not fire onPress while loading', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} loading accessibilityLabel="Ładowanie">
        Zapisz
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} disabled>
        Zapisz
      </Button>,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
