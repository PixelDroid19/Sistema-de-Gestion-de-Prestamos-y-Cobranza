import React from 'react'

function WorkspaceCard({ eyebrow, title, subtitle, actions, children, className = '', compact = false, ...props }) {
  return (
    <section className={`lf-workspace-card${compact ? ' lf-workspace-card--compact' : ''} ${className}`.trim()} {...props}>
      {(eyebrow || title || subtitle || actions) && (
        <header className="lf-workspace-card__header">
          <div>
            {eyebrow ? <div className="lf-eyebrow">{eyebrow}</div> : null}
            {title ? <h2 className="lf-workspace-card__title">{title}</h2> : null}
            {subtitle ? <p className="lf-workspace-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="lf-workspace-card__actions">{actions}</div> : null}
        </header>
      )}
      <div className="lf-workspace-card__body">{children}</div>
    </section>
  )
}

export default WorkspaceCard
