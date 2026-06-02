import type React from 'react';

export type OperationalSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: React.ReactNode;
  invalid?: boolean;
  children: React.ReactNode;
  selectClassName?: string;
};

export function OperationalSelect({
  icon,
  invalid = false,
  children,
  className = '',
  selectClassName = '',
  ...rest
}: OperationalSelectProps) {
  return (
    <div className={`operational-control ${invalid ? 'operational-control--invalid' : ''} ${className}`.trim()}>
      {icon ? <span className="operational-control-icon" aria-hidden="true">{icon}</span> : null}
      <select
        className={`operational-control-select ${selectClassName}`.trim()}
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
        aria-invalid={invalid || rest['aria-invalid']}
        {...rest}
      >
        {children}
      </select>
      <span className="operational-control-select-arrow" aria-hidden="true" />
    </div>
  );
}
