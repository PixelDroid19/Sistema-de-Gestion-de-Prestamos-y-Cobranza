import React, { forwardRef, useId } from 'react';

import styles from './Input.module.scss';

const Input = forwardRef(({
  label,
  error,
  className = '',
  wrapperClassName = '',
  id,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  
  return (
    <div className={`field-group ${wrapperClassName}`}>
      {label && (
        <label className={`field-label ${styles.label}`} htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`form-control ${styles.input} ${className} ${error ? styles.error : ''}`}
        {...props}
      />
      {error && (
        <span className={styles.message}>
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
