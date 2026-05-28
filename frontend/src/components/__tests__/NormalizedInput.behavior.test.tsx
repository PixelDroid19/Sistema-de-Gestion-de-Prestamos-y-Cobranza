import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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

  it('restores the focused numeric value when exponent-like text is typed mid-edit', () => {
    function DecimalHarness() {
      const [value, setValue] = useState('1250000');

      return (
        <NormalizedInput
          aria-label="Monto decimal"
          variant="decimal"
          value={value}
          maxDecimals={2}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<DecimalHarness />);

    const input = screen.getByLabelText('Monto decimal') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, input.value.length);

    fireEvent.change(input, { target: { value: '1' } });
    expect(input).toHaveValue('1');

    fireEvent.keyDown(input, { key: 'e' });
    expect(input).toHaveValue('1250000');

    fireEvent.change(input, { target: { value: '5' } });
    expect(input).toHaveValue('1250000');
  });

  it('allows sequential typing for small decimal values that start with zero', () => {
    function DecimalHarness() {
      const [value, setValue] = useState('');

      return (
        <NormalizedInput
          aria-label="Tasa pequeña"
          variant="decimal"
          value={value}
          maxDecimals={2}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<DecimalHarness />);

    const input = screen.getByLabelText('Tasa pequeña');

    fireEvent.change(input, { target: { value: '0' } });
    expect(input).toHaveValue('0');

    fireEvent.change(input, { target: { value: '0.' } });
    expect(input).toHaveValue('0.');

    fireEvent.change(input, { target: { value: '0.25' } });
    expect(input).toHaveValue('0.25');
  });

  it('supports reusable text behavior with max length', () => {
    const onValueChange = vi.fn();

    render(<NormalizedInput aria-label="Nombre" variant="text" value="" maxLength={4} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'abcdef' } });

    expect(onValueChange).toHaveBeenCalledWith('abcd', expect.any(Object));
  });
});
