import type React from 'react';
import { HelpTooltip } from '../HelpSupport';
import './FormField.css';

export type FormFieldProps = Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  label: React.ReactNode;
  tooltip?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
};

export function FormField({
  label,
  tooltip,
  helper,
  error,
  children,
  className = '',
  ...rest
}: FormFieldProps) {
  return (
    <label className={`form-field ${className}`.trim()} {...rest}>
      <span className="form-field-label">
        <span>{label}</span>
        {tooltip ? <HelpTooltip text={tooltip} align="right" iconSize={12} /> : null}
      </span>
      {children}
      {error ? (
        <span className="form-field-error">{error}</span>
      ) : helper ? (
        <span className="form-field-helper">{helper}</span>
      ) : null}
    </label>
  );
}
