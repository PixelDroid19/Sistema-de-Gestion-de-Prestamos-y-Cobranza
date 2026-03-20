import React, { forwardRef } from 'react';

import styles from './IconButton.module.scss';

const IconButton = forwardRef(({ 
  icon: Icon, 
  badge, 
  title, 
  className = '', 
  size = 20,
  ...props 
}, ref) => {
  return (
    <button 
      ref={ref}
      className={`${styles.button} ${className}`}
      title={title}
      aria-label={title}
      {...props}
    >
      <Icon size={size} strokeWidth={2.5} />
      {badge > 0 && (
        <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
});

IconButton.displayName = 'IconButton';
export default IconButton;
