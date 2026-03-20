import React from 'react';

function StatePanel({ icon, title, message, action = null, loadingState = false }) {
  return (
    <div className={`state-panel${loadingState ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );
}

export default StatePanel;
