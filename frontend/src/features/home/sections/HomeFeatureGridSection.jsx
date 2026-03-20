import React from 'react'
import { useTranslation } from 'react-i18next'

function HomeFeatureGridSection({ features }) {
  const { t } = useTranslation()

  return (
    <section className="home-page__section">
      <div className="home-page__section-header">
        <span className="section-eyebrow">{t('home.brand')}</span>
        <h2>{t('home.featureTitle')}</h2>
        <p>{t('home.featureDescription')}</p>
      </div>

      <div className="home-page__feature-grid">
        {features.map(({ icon: Icon, title, description }, index) => (
          <article key={title} className="home-page__feature-card">
            <div className="home-page__feature-card-top">
              <div className="home-page__feature-icon">
                <Icon size={22} />
              </div>
              <span className="home-page__feature-index">0{index + 1}</span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default HomeFeatureGridSection
