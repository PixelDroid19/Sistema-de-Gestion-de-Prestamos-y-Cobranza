import React from 'react';

type OperationalInputVariant = 'text' | 'money' | 'number' | 'percent' | 'date';

type OperationalInputValue = string | number | undefined;

type OperationalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: OperationalInputValue;
  variant?: OperationalInputVariant;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  invalid?: boolean;
  onValueChange?: (value: string | number, event: React.ChangeEvent<HTMLInputElement>) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  inputClassName?: string;
};

type OperationalSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: React.ReactNode;
  invalid?: boolean;
  children: React.ReactNode;
  selectClassName?: string;
};

export const parseNumericInput = (raw: string) => {
  const normalized = raw.replace(/[^\d.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseMoneyInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatIntegerInput = (value: OperationalInputValue) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }
  const numericValue = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const getInputType = (variant: OperationalInputVariant, type?: string) => {
  if (type) return type;
  if (variant === 'date') return 'date';
  if (variant === 'number' || variant === 'percent') return 'number';
  return 'text';
};

const getInputMode = (variant: OperationalInputVariant, inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']) => {
  if (inputMode) return inputMode;
  if (variant === 'money' || variant === 'number') return 'numeric';
  if (variant === 'percent') return 'decimal';
  return undefined;
};

const getDisplayValue = (variant: OperationalInputVariant, value: OperationalInputValue) => {
  if (variant === 'money') return formatIntegerInput(value);
  return value ?? '';
};

export function OperationalInput({
  value,
  variant = 'text',
  icon,
  suffix,
  invalid = false,
  onValueChange,
  onChange,
  className = '',
  inputClassName = '',
  type,
  inputMode,
  ...rest
}: OperationalInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);

    if (!onValueChange) return;

    if (variant === 'money') {
      onValueChange(parseMoneyInput(event.target.value), event);
      return;
    }

    if (variant === 'number' || variant === 'percent') {
      onValueChange(parseNumericInput(event.target.value), event);
      return;
    }

    onValueChange(event.target.value, event);
  };

  return (
    <div className={`operational-control ${invalid ? 'operational-control--invalid' : ''} ${className}`}>
      {icon ? <span className="operational-control-icon" aria-hidden="true">{icon}</span> : null}
      <input
        className={`operational-control-input ${inputClassName}`}
        value={getDisplayValue(variant, value)}
        onChange={handleChange}
        type={getInputType(variant, type)}
        inputMode={getInputMode(variant, inputMode)}
        aria-invalid={invalid || rest['aria-invalid']}
        {...rest}
      />
      {suffix ? <span className="operational-control-suffix">{suffix}</span> : null}
    </div>
  );
}

export function OperationalSelect({
  icon,
  invalid = false,
  children,
  className = '',
  selectClassName = '',
  ...rest
}: OperationalSelectProps) {
  return (
    <div className={`operational-control ${invalid ? 'operational-control--invalid' : ''} ${className}`}>
      {icon ? <span className="operational-control-icon" aria-hidden="true">{icon}</span> : null}
      <select
        className={`operational-control-select ${selectClassName}`}
        aria-invalid={invalid || rest['aria-invalid']}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
