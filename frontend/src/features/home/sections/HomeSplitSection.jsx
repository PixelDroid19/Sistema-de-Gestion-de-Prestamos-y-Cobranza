import React from 'react'
import { useTranslation } from 'react-i18next'

function HomeSplitSection({ points, workflowCards, sectionId }) {
  const { t } = useTranslation()

  return (
    <section id={sectionId} className="home-page__section home-page__section--split">
      <div className="home-page__split-layout">
        <div className="home-page__split-copy">
          <span className="section-eyebrow">{t('home.split.eyebrow')}</span>
          <h2>{t('home.split.title')}</h2>
          <p>{t('home.split.description')}</p>

          <div className="home-page__split-points">
            {points.map((point) => (
              <article key={point.title} className="home-page__split-point">
                <span className="home-page__split-point-mark" />
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="home-page__operations-card">
          <div className="home-page__operations-header">
            <span className="section-eyebrow">{t('home.split.boardEyebrow')}</span>
            <h3>{t('home.split.boardTitle')}</h3>
            <p>{t('home.split.boardDescription')}</p>
          </div>

          <div className="home-page__operations-grid">
            {workflowCards.map(({ icon: Icon, label, value, description }) => (
              <article key={label} className="home-page__operations-item">
                <div className="home-page__operations-icon">
                  <Icon size={18} />
                </div>
                <span className="home-page__operations-label">{label}</span>
                <strong>{value}</strong>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeSplitSection
