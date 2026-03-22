import React from 'react'

function Toolbar({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={`lf-toolbar ${className}`.trim()}>
      <div className="lf-toolbar__intro">
        {title ? <h1 className="lf-toolbar__title">{title}</h1> : null}
        {subtitle ? <p className="lf-toolbar__subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="lf-toolbar__content">{children}</div> : null}
      {actions ? <div className="lf-toolbar__actions">{actions}</div> : null}
    </div>
  )
}

export default Toolbar
