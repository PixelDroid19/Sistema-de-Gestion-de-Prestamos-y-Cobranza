import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  className = '',
  wrapperClassName = '',
  id,
  ...props
}, ref) => {
  const inputId = id || Math.random().toString(36).substring(7);
  
  return (
    <div className={`field-group ${wrapperClassName}`}>
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`form-control ${className} ${error ? 'border-danger' : ''}`}
        {...props}
      />
      {error && (
        <span style={{ color: 'var(--danger, #f46a6a)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
