import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OperationalInput, parseMoneyInput, parseNumericInput } from '../shared/FormControls';

describe('FormControls numeric parsing', () => {
  it('parses formatted money while rejecting exponent and mixed text', () => {
    expect(parseMoneyInput('$ 2.000.000')).toBe(2000000);
    expect(parseMoneyInput('2,000,000')).toBe(2000000);
    expect(parseMoneyInput('1e2')).toBeNull();
    expect(parseMoneyInput('100abc')).toBeNull();
    expect(parseMoneyInput('-100')).toBeNull();
    expect(parseMoneyInput('100-200')).toBeNull();
  });

  it('parses plain numeric input while rejecting exponent and mixed text', () => {
    expect(parseNumericInput('18')).toBe(18);
    expect(parseNumericInput('2.5')).toBe(2.5);
    expect(parseNumericInput('1e2')).toBeNull();
    expect(parseNumericInput('12abc')).toBeNull();
  });

  it('does not propagate invalid money text to financial input handlers', () => {
    const onValueChange = vi.fn();

    render(
      <OperationalInput
        aria-label="Monto"
        variant="money"
        value={2000000}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '100-200' } });

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
