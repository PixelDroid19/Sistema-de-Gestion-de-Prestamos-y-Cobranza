import type React from 'react';
import { AppInput, type AppInputProps } from './AppInput';

export type PercentInputProps = Omit<AppInputProps, 'variant' | 'suffix'> & {
  /** Optional override; defaults to the percent sign. */
  suffix?: React.ReactNode;
};

/**
 * Rate/percentage control with a stable trailing "%" and 0–100 bounds.
 * Canonical value stays a plain decimal string (e.g. "2.5"); the suffix is display-only.
 */
export function PercentInput({
  allowZero = true,
  maxDecimals = 2,
  minValue = 0,
  maxValue = 100,
  maxDigits = 3,
  placeholder = '0',
  suffix = '%',
  inputMode = 'decimal',
  ...rest
}: PercentInputProps) {
  return (
    <AppInput
      variant="percent"
      allowZero={allowZero}
      maxDecimals={maxDecimals}
      minValue={minValue}
      maxValue={maxValue}
      maxDigits={maxDigits}
      placeholder={placeholder}
      suffix={suffix}
      inputMode={inputMode}
      {...rest}
    />
  );
}
