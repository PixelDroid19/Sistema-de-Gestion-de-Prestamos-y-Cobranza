import React from 'react';

import styles from './Card.module.scss';

export const Card = ({ children, className = '', hero = false }) => {
  return (
    <div className={`surface-card ${styles.card} ${hero ? 'surface-card--hero' : ''} ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, eyebrow, compact = false, action }) => {
  return (
    <div className={`surface-card__header ${styles.header} ${compact ? 'surface-card__header--compact' : ''}`}>
      <div>
        {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
        {title && <h3 className="section-title">{title}</h3>}
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return (
    <div className={`surface-card__body ${styles.body} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
