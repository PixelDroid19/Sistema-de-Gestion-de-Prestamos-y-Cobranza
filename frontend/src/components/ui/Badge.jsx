import React from 'react';

const Badge = ({ children, variant = 'neutral', className = '' }) => {
  return (
    <span className={`status-badge status-badge--${variant} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
