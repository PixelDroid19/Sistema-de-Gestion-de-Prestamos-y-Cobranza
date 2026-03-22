import React from 'react'

function StatCard({ label, value, caption, trend, tone = 'brand' }) {
  return (
    <article className={`lf-stat-card lf-stat-card--${tone}`}>
      <span className="lf-stat-card__label">{label}</span>
      <strong className="lf-stat-card__value">{value}</strong>
      <div className="lf-stat-card__footer">
        {caption ? <span className="lf-stat-card__caption">{caption}</span> : <span />}
        {trend ? <span className="lf-stat-card__trend">{trend}</span> : null}
      </div>
    </article>
  )
}

export default StatCard
