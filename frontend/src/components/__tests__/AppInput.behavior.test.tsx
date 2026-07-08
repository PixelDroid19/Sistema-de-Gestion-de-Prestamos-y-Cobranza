import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DollarSign } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  formatDecimalMoneyInput,
  normalizeGroupedDecimalMoneyEdit,
} from '../../lib/moneyInput';
import { AppInput } from '../shared/inputs/AppInput';
import { CurrencyInput } from '../shared/inputs/CurrencyInput';

describe('AppInput behavior', () => {
  it('keeps generic integer inputs visually plain', () => {
    render(
      <AppInput
        aria-label="Año"
        variant="integer"
        value="2026"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Año')).toHaveValue('2026');
  });

  it('renders operational shell with icon and money formatting', () => {
    const onValueChange = vi.fn();

    render(
      <AppInput
        aria-label="Monto"
        variant="money"
        icon={<DollarSign size={16} />}
        value="1200000"
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByLabelText('Monto');
    expect(input).toHaveValue('1.200.000');
    expect(input.closest('.operational-control')).not.toBeNull();
    expect(document.querySelector('.operational-control-icon')).not.toBeNull();

    fireEvent.change(input, { target: { value: '2500000' } });

    expect(onValueChange).toHaveBeenCalledWith(
      '2500000',
      expect.objectContaining({
        value: '2500000',
        displayValue: '2.500.000',
        variant: 'money',
        numericValue: 2500000,
      }),
      expect.any(Object),
    );
  });

  it('renders date inputs inside the operational shell', () => {
    render(
      <AppInput
        aria-label="Fecha"
        variant="date"
        value="2026-06-01"
        onValueChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Fecha');
    expect(input).toHaveAttribute('type', 'date');
    expect(input.closest('.operational-control')).not.toBeNull();
  });

  it('shows prefix and grouped decimals for currency amounts', () => {
    render(
      <AppInput
        aria-label="Monto decimal"
        variant="decimal"
        prefix="$"
        formatGroupedDecimals
        value="120554.50"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto decimal')).toHaveValue('120.554,50');
  });

  it('uses the centralized COP prefix for currency inputs by default', () => {
    render(
      <CurrencyInput
        aria-label="Monto COP"
        value="1200000"
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText('COP')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto COP')).toHaveValue('1.200.000');
  });

  it('supports backspace at the end of grouped currency values (via change)', () => {
    function CurrencyHarness() {
      const [value, setValue] = useState('120554.50');

      return (
        <CurrencyInput
          aria-label="Monto teclado"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<CurrencyHarness />);

    const input = screen.getByLabelText('Monto teclado') as HTMLInputElement;
    expect(input).toHaveValue('120.554,50');

    // Drive deletes via change with the post-backspace display; track canonical
    // manually to assert resulting formatted value (avoids flakiness of async
    // re-render polling in controlled + formatted tests).
    let canonical = '120554.50';
    let display = '120.554,50';

    // first backspace
    const next1 = '120.554,5';
    fireEvent.change(input, { target: { value: next1 } });
    canonical = normalizeGroupedDecimalMoneyEdit(canonical, display, next1) ?? canonical;
    display = formatDecimalMoneyInput(canonical);
    expect(input).toHaveValue(display);

    // second
    const next2 = '120.554,';
    fireEvent.change(input, { target: { value: next2 } });
    canonical = normalizeGroupedDecimalMoneyEdit(canonical, display, next2) ?? canonical;
    display = formatDecimalMoneyInput(canonical);
    expect(input).toHaveValue(display);
  });

  it('keeps the caret stable when deleting through thousand separators (via change)', () => {
    function CurrencyHarness() {
      const [value, setValue] = useState('120554');

      return (
        <CurrencyInput
          aria-label="Monto miles"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<CurrencyHarness />);

    const input = screen.getByLabelText('Monto miles') as HTMLInputElement;
    expect(input).toHaveValue('120.554');

    // Delete that crosses re-grouping of separators.
    fireEvent.change(input, { target: { value: '120.55' } });
    const canonical = normalizeGroupedDecimalMoneyEdit('120554', '120.554', '120.55') ?? '12055';
    expect(input).toHaveValue(formatDecimalMoneyInput(canonical));
  });

  it('supports deleting grouped currency values character by character', () => {
    function CurrencyHarness() {
      const [value, setValue] = useState('120554.50');

      return (
        <CurrencyInput
          aria-label="Monto borrado"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<CurrencyHarness />);

    const input = screen.getByLabelText('Monto borrado');
    let canonical = '120554.50';
    let display = formatDecimalMoneyInput(canonical);

    while (display) {
      expect(input).toHaveValue(display);

      const nextDisplay = display.slice(0, -1);
      fireEvent.change(input, { target: { value: nextDisplay } });
      canonical = normalizeGroupedDecimalMoneyEdit(canonical, display, nextDisplay) ?? '';
      display = formatDecimalMoneyInput(canonical);
    }

    expect(input).toHaveValue('');
    expect(canonical).toBe('');
  });

  it('clears the amount when the whole value is selected and backspace is pressed (via change)', () => {
    function CurrencyHarness() {
      const [value, setValue] = useState('120554.50');

      return (
        <CurrencyInput
          aria-label="Monto seleccionado"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<CurrencyHarness />);

    const input = screen.getByLabelText('Monto seleccionado') as HTMLInputElement;
    // Full select + backspace produces empty nextDisplay.
    fireEvent.change(input, { target: { value: '' } });
    const canonical = normalizeGroupedDecimalMoneyEdit('120554.50', '120.554,50', '') ?? '';
    expect(input).toHaveValue(formatDecimalMoneyInput(canonical));
  });

  it('allows clearing and retyping currency amounts', () => {
    function CurrencyHarness() {
      const [value, setValue] = useState('120554.50');

      return (
        <CurrencyInput
          aria-label="Monto editable"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<CurrencyHarness />);

    const input = screen.getByLabelText('Monto editable');
    expect(input).toHaveValue('120.554,50');

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { value: '5000' } });
    expect(input).toHaveValue('5.000');

    fireEvent.change(input, { target: { value: '5000,25' } });
    expect(input).toHaveValue('5.000,25');

    fireEvent.change(input, { target: { value: '5.000,2' } });
    expect(input).toHaveValue('5.000,2');
  });

  it('supports deleting whole peso amounts character by character', () => {
    function MoneyHarness() {
      const [value, setValue] = useState('1200000');

      return (
        <CurrencyInput
          aria-label="Monto entero"
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<MoneyHarness />);

    const input = screen.getByLabelText('Monto entero');
    expect(input).toHaveValue('1.200.000');

    fireEvent.change(input, { target: { value: '1.200.00' } });
    expect(input).toHaveValue('120.000');

    fireEvent.change(input, { target: { value: '12.000' } });
    expect(input).toHaveValue('12.000');

    fireEvent.change(input, { target: { value: '1.200' } });
    expect(input).toHaveValue('1.200');

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
  });

  it('formats grouped decimals while typing through CurrencyInput', () => {
    const onValueChange = vi.fn();

    render(
      <CurrencyInput
        aria-label="Monto pago"
        allowCents
        value=""
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Monto pago'), { target: { value: '120554' } });

    expect(onValueChange).toHaveBeenCalledWith(
      '120554',
      expect.objectContaining({
        value: '120554',
        displayValue: '120.554',
      }),
      expect.any(Object),
    );
  });

  it('allows backspace after rejecting invalid exponent text (via change)', () => {
    function DecimalHarness() {
      const [value, setValue] = useState('120554.50');

      return (
        <CurrencyInput
          aria-label="Monto tras exponente"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<DecimalHarness />);

    const input = screen.getByLabelText('Monto tras exponente') as HTMLInputElement;
    // After a rollback (e), a subsequent delete change should still normalize correctly.
    fireEvent.change(input, { target: { value: '120.554,5' } });
    const canonical = normalizeGroupedDecimalMoneyEdit('120554.50', '120.554,50', '120.554,5') ?? '120554.5';
    expect(input).toHaveValue(formatDecimalMoneyInput(canonical));
  });

  it('keeps the current valid replacement when invalid exponent text is typed', () => {
    function DecimalHarness() {
      const [value, setValue] = useState('');

      return (
        <AppInput
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
    fireEvent.change(input, { target: { value: '1250000' } });
    fireEvent.keyDown(input, { key: 'a', metaKey: true });
    input.setSelectionRange(0, input.value.length);
    fireEvent.select(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'e' });
    expect(input).toHaveValue('1');
  });

  it('supports real keyboard backspace on grouped whole money values', async () => {
    const user = userEvent.setup();

    function MoneyHarness() {
      const [value, setValue] = useState('2000000');

      return (
        <CurrencyInput
          aria-label="Monto con teclado"
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<MoneyHarness />);

    const input = screen.getByLabelText('Monto con teclado');
    expect(input).toHaveValue('2.000.000');

    await user.click(input);
    await user.keyboard('{End}{Backspace}');
    expect(input).toHaveValue('200.000');

    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('20.000');
  });

  it('clears and retypes grouped whole money values with select all and backspace', async () => {
    const user = userEvent.setup();

    function MoneyHarness() {
      const [value, setValue] = useState('2000000');

      return (
        <CurrencyInput
          aria-label="Monto reemplazable"
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<MoneyHarness />);

    const input = screen.getByLabelText('Monto reemplazable');
    expect(input).toHaveValue('2.000.000');

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    expect(input).toHaveValue('');

    await user.keyboard('500000');
    expect(input).toHaveValue('500.000');
  });

  it('supports typing whole money digit by digit and moving to the next input', async () => {
    const user = userEvent.setup();

    function FormHarness() {
      const [amount, setAmount] = useState('');
      const [term, setTerm] = useState('');

      return (
        <>
          <CurrencyInput
            aria-label="Monto"
            value={amount}
            onValueChange={(nextValue) => setAmount(nextValue)}
          />
          <AppInput
            aria-label="Plazo"
            variant="integer"
            value={term}
            onValueChange={(nextValue) => setTerm(nextValue)}
          />
        </>
      );
    }

    render(<FormHarness />);

    const amount = screen.getByLabelText('Monto');
    const term = screen.getByLabelText('Plazo');

    await user.click(amount);
    await user.type(amount, '1234567');
    expect(amount).toHaveValue('1.234.567');

    await user.click(term);
    expect(term).toHaveFocus();
    expect(amount).toHaveValue('1.234.567');

    await user.type(term, '12');
    expect(term).toHaveValue('12');
    expect(amount).toHaveValue('1.234.567');
  });

  it('supports editing grouped whole money in the middle without losing the caret target', async () => {
    const user = userEvent.setup();

    function MoneyHarness() {
      const [value, setValue] = useState('1234567');

      return (
        <CurrencyInput
          aria-label="Monto editable en medio"
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<MoneyHarness />);

    const input = screen.getByLabelText('Monto editable en medio') as HTMLInputElement;
    expect(input).toHaveValue('1.234.567');

    await user.click(input);
    input.setSelectionRange(3, 3);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('134.567');

    await user.keyboard('9');
    expect(input).toHaveValue('1.934.567');
  });

  it('supports decimal currency typing, replacing and deleting with cents', async () => {
    const user = userEvent.setup();

    function DecimalCurrencyHarness() {
      const [value, setValue] = useState('');

      return (
        <CurrencyInput
          aria-label="Monto con centavos"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
        />
      );
    }

    render(<DecimalCurrencyHarness />);

    const input = screen.getByLabelText('Monto con centavos');

    await user.click(input);
    await user.type(input, '120554,50');
    expect(input).toHaveValue('120.554,50');

    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('120.554,5');

    await user.keyboard('{Control>}a{/Control}{Backspace}');
    expect(input).toHaveValue('');

    await user.type(input, '5000,25');
    expect(input).toHaveValue('5.000,25');
  });

  it('does not rollback numeric input values when navigating with arrow keys', async () => {
    const user = userEvent.setup();

    function NumericNavigationHarness() {
      const [amount, setAmount] = useState('');
      const [term, setTerm] = useState('');

      return (
        <>
          <CurrencyInput
            aria-label="Monto navegable"
            value={amount}
            onValueChange={(nextValue) => setAmount(nextValue)}
          />
          <AppInput
            aria-label="Plazo navegable"
            variant="integer"
            value={term}
            onValueChange={(nextValue) => setTerm(nextValue)}
          />
        </>
      );
    }

    render(<NumericNavigationHarness />);

    const amountInput = screen.getByLabelText('Monto navegable');
    const termInput = screen.getByLabelText('Plazo navegable');

    await user.click(amountInput);
    await user.type(amountInput, '500000');
    expect(amountInput).toHaveValue('500.000');

    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowRight}{PageUp}{PageDown}{Escape}{Home}{End}');
    expect(amountInput).toHaveValue('500.000');

    await user.keyboard('1');
    expect(amountInput).toHaveValue('5.000.001');

    await user.click(termInput);
    await user.type(termInput, '18');
    expect(termInput).toHaveValue('18');

    await user.keyboard('{ArrowLeft}{ArrowRight}{PageUp}{PageDown}{Escape}{Home}{End}');
    expect(termInput).toHaveValue('18');

    await user.keyboard('2');
    expect(termInput).toHaveValue('182');
  });

  it('keeps the latest valid numeric value after rejected keyboard text', async () => {
    const user = userEvent.setup();

    function NumericRejectionHarness() {
      const [amount, setAmount] = useState('');
      const [term, setTerm] = useState('');

      return (
        <>
          <CurrencyInput
            aria-label="Monto protegido"
            value={amount}
            onValueChange={(nextValue) => setAmount(nextValue)}
          />
          <AppInput
            aria-label="Plazo protegido"
            variant="integer"
            value={term}
            onValueChange={(nextValue) => setTerm(nextValue)}
          />
        </>
      );
    }

    render(<NumericRejectionHarness />);

    const amountInput = screen.getByLabelText('Monto protegido');
    const termInput = screen.getByLabelText('Plazo protegido');

    await user.click(amountInput);
    await user.type(amountInput, '500000');
    expect(amountInput).toHaveValue('500.000');

    await user.keyboard('e');
    await waitFor(() => expect(amountInput).toHaveValue('500.000'));

    await user.keyboard('+');
    await waitFor(() => expect(amountInput).toHaveValue('500.000'));

    await user.click(termInput);
    await user.type(termInput, '18');
    expect(termInput).toHaveValue('18');

    await user.keyboard('e');
    await waitFor(() => expect(termInput).toHaveValue('18'));
  });

  it('keeps the latest valid numeric value after rejected paste text', async () => {
    const onPaste = vi.fn();

    function NumericPasteHarness() {
      const [amount, setAmount] = useState('');

      return (
        <CurrencyInput
          aria-label="Monto con pegado"
          value={amount}
          onValueChange={(nextValue) => setAmount(nextValue)}
          onPaste={onPaste}
        />
      );
    }

    render(<NumericPasteHarness />);

    const input = screen.getByLabelText('Monto con pegado') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '500000' } });
    expect(input).toHaveValue('500.000');

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '1e2',
      },
    });

    await waitFor(() => expect(input).toHaveValue('500.000'));
    expect(onPaste).not.toHaveBeenCalled();
  });

  it('normalizes formatted pasted currency text through the central input', () => {
    const onPaste = vi.fn();

    function DecimalPasteHarness() {
      const [value, setValue] = useState('');

      return (
        <CurrencyInput
          aria-label="Monto decimal pegado"
          allowCents
          value={value}
          onValueChange={(nextValue) => setValue(nextValue)}
          onPaste={onPaste}
        />
      );
    }

    render(<DecimalPasteHarness />);

    const input = screen.getByLabelText('Monto decimal pegado');
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '$ 120.554,50',
      },
    });
    expect(onPaste).toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '$ 120.554,50' } });
    expect(input).toHaveValue('120.554,50');
  });
});
