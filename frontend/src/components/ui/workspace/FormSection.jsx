import React from 'react'

function FormSection({ title, subtitle, children, className = '' }) {
  return (
    <section className={`lf-form-section ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="lf-form-section__header">
          {title ? <h3 className="lf-form-section__title">{title}</h3> : null}
          {subtitle ? <p className="lf-form-section__subtitle">{subtitle}</p> : null}
        </header>
      )}
      <div className="lf-form-section__body">{children}</div>
    </section>
  )
}

export default FormSection
