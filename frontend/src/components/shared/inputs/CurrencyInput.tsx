import type React from 'react';
import { AppInput, type AppInputProps } from './AppInput';
import { BASE_CURRENCY_SYMBOL } from '../../../i18n/format';

// Single source of truth for the currency prefix: changing the base currency
// symbol centrally now propagates to every money input.
const CURRENCY_PREFIX = BASE_CURRENCY_SYMBOL;

export type CurrencyInputProps = Omit<
  AppInputProps,
  'variant' | 'prefix' | 'formatGroupedDecimals'
> & {
  /** When true, allows cents (decimal canonical). When false, whole pesos only. */
  allowCents?: boolean;
  prefix?: string;
};

export function CurrencyInput({
  allowCents = false,
  prefix = CURRENCY_PREFIX,
  maxDecimals = 2,
  placeholder,
  icon,
  ...rest
}: CurrencyInputProps) {
  const leadingIcon = prefix ? undefined : icon;

  if (allowCents) {
    return (
      <AppInput
        variant="decimal"
        prefix={prefix}
        icon={leadingIcon}
        maxDecimals={maxDecimals}
        formatGroupedDecimals
        placeholder={placeholder ?? '0,00'}
        {...rest}
      />
    );
  }

  return (
    <AppInput
      variant="money"
      prefix={prefix}
      icon={leadingIcon}
      placeholder={placeholder ?? '0'}
      {...rest}
    />
  );
}
