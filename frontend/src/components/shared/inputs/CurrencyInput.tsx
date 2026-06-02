import type React from 'react';
import { AppInput, type AppInputProps } from './AppInput';

const CURRENCY_PREFIX = '$' as const;

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
