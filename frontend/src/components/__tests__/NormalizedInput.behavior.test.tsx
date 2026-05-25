import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NormalizedInput } from '../shared/Surfaces';

describe('NormalizedInput behavior', () => {
  it('normalizes money display while emitting canonical digits', () => {
    const onValueChange = vi.fn();
    const onNormalizedChange = vi.fn();

    render(
      <NormalizedInput
        aria-label="Monto"
        variant="money"
        value="1200000"
        onValueChange={onValueChange}
        onNormalizedChange={onNormalizedChange}
      />,
    );

    const input = screen.getByLabelText('Monto');
    expect(input).toHaveValue('1.200.000');

    fireEvent.change(input, { target: { value: '2500000' } });

    expect(onValueChange).toHaveBeenCalledWith('2500000', expect.any(Object));
    expect(onNormalizedChange).toHaveBeenCalledWith({
      value: '2500000',
      displayValue: '2.500.000',
      variant: 'money',
      numericValue: 2500000,
    }, expect.any(Object));
  });

  it('reports large unsafe money values without forcing a lossy number', () => {
    const onNormalizedChange = vi.fn();

    render(
      <NormalizedInput
        aria-label="Monto grande"
        variant="money"
        value=""
        onValueChange={vi.fn()}
        onNormalizedChange={onNormalizedChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Monto grande'), { target: { value: '123456789012345678901234' } });

    expect(onNormalizedChange).toHaveBeenCalledWith({
      value: '123456789012345678901234',
      displayValue: '123.456.789.012.345.678.901.234',
      variant: 'money',
      numericValue: null,
    }, expect.any(Object));
  });

  it('keeps very large money values readable without precision loss', () => {
    render(<NormalizedInput aria-label="Monto grande" variant="money" value="123456789012345678901234" onValueChange={vi.fn()} />);

    expect(screen.getByLabelText('Monto grande')).toHaveValue('123.456.789.012.345.678.901.234');
  });

  it('rejects invalid money text without calling change handlers', () => {
    const onValueChange = vi.fn();

    render(<NormalizedInput aria-label="Monto" variant="money" value="" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '100e2' } });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('supports integer ranges for day-like fields', () => {
    const onValueChange = vi.fn();

    render(<NormalizedInput aria-label="Dia" variant="integer" value="" minValue={1} maxValue={28} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: '08' } });
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: '29' } });

    expect(onValueChange).toHaveBeenCalledWith('8', expect.any(Object));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('supports decimal and percent precision rules', () => {
    const onDecimalChange = vi.fn();
    const onPercentChange = vi.fn();

    render(
      <>
        <NormalizedInput aria-label="Decimal" variant="decimal" value="" maxDecimals={2} onValueChange={onDecimalChange} />
        <NormalizedInput aria-label="Porcentaje" variant="percent" value="" maxDecimals={4} onValueChange={onPercentChange} />
      </>,
    );

    fireEvent.change(screen.getByLabelText('Decimal'), { target: { value: '0,25' } });
    fireEvent.change(screen.getByLabelText('Decimal'), { target: { value: '0.123' } });
    fireEvent.change(screen.getByLabelText('Porcentaje'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Porcentaje'), { target: { value: '101' } });

    expect(onDecimalChange).toHaveBeenCalledWith('0.25', expect.any(Object));
    expect(onDecimalChange).toHaveBeenCalledTimes(1);
    expect(onPercentChange).toHaveBeenCalledWith('2.5', expect.any(Object));
    expect(onPercentChange).toHaveBeenCalledTimes(1);
  });

  it('supports reusable text behavior with max length', () => {
    const onValueChange = vi.fn();

    render(<NormalizedInput aria-label="Nombre" variant="text" value="" maxLength={4} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'abcdef' } });

    expect(onValueChange).toHaveBeenCalledWith('abcd', expect.any(Object));
  });
});
