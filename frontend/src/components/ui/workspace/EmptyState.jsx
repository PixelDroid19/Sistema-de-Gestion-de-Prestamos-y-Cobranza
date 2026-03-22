import React from 'react'

function EmptyState({ title, description, action, icon = '•' }) {
  return (
    <div className="lf-empty-state">
      <span className="lf-empty-state__icon" aria-hidden="true">{icon}</span>
      <strong className="lf-empty-state__title">{title}</strong>
      {description ? <p className="lf-empty-state__description">{description}</p> : null}
      {action ? <div className="lf-empty-state__action">{action}</div> : null}
    </div>
  )
}

export default EmptyState
