import React, { forwardRef } from 'react';

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
      className={`icon-btn ${className}`}
      title={title}
      {...props}
    >
      <Icon size={size} strokeWidth={2.5} />
      {badge > 0 && (
        <span className="badge">{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
});

IconButton.displayName = 'IconButton';
export default IconButton;
