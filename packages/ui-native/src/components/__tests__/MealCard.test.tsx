import { fireEvent, render, screen } from '@testing-library/react-native';

import { MealCard } from '../MealCard';

describe('MealCard', () => {
  it('renders the dish name and cook-time / portions tags', () => {
    render(<MealCard name="Makaron z kurczakiem" cookTimeMinutes={30} portions={4} />);
    expect(screen.getByText('Makaron z kurczakiem')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('4 porcji')).toBeTruthy();
  });

  it('renders without crashing with only the required name', () => {
    render(<MealCard name="Schabowy" />);
    expect(screen.getByText('Schabowy')).toBeTruthy();
  });

  it('renders dietary badges', () => {
    render(
      <MealCard
        name="Sałatka"
        badges={[{ label: 'Wegetariańskie' }, { tone: 'amber', label: 'Bezglutenowe' }]}
      />,
    );
    expect(screen.getByText('Wegetariańskie')).toBeTruthy();
    expect(screen.getByText('Bezglutenowe')).toBeTruthy();
  });

  it('calls onSwap when the swap button is pressed', () => {
    const onSwap = jest.fn();
    render(<MealCard name="Żurek" onSwap={onSwap} />);
    fireEvent.press(screen.getByLabelText('Zamień posiłek'));
    expect(onSwap).toHaveBeenCalledTimes(1);
  });

  it('does not render the swap button when onSwap is absent', () => {
    render(<MealCard name="Żurek" />);
    expect(screen.queryByLabelText('Zamień posiłek')).toBeNull();
  });
});
