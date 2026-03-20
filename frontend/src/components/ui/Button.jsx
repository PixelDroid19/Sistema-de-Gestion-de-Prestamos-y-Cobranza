import React, { forwardRef } from 'react';

import styles from './Button.module.scss';

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  icon: Icon,
  ...props 
}, ref) => {
  const variantClass = variant === 'outline' ? styles.outline : styles[variant] || styles.primary;
  const sizeClass = size === 'sm' ? styles.sm : styles.md;
  
  return (
    <button 
      ref={ref}
      className={`${styles.button} ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 18} />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
