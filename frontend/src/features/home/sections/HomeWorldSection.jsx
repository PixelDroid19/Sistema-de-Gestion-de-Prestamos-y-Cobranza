import React from 'react'
import { useTranslation } from 'react-i18next'

function HomeWorldSection({ stats, regions }) {
  const { t } = useTranslation()

  return (
    <section className="home-page__section home-page__section--world">
      <div className="home-page__world-layout">
        <div className="home-page__world-panel">
          <span className="section-eyebrow">{t('home.world.eyebrow')}</span>
          <h2>{t('home.world.title')}</h2>
          <p>{t('home.world.description')}</p>

          <div className="home-page__map-card" aria-hidden="true">
            <div className="home-page__map-orbit home-page__map-orbit--primary" />
            <div className="home-page__map-orbit home-page__map-orbit--secondary" />
            <div className="home-page__map-core" />
          </div>

          <div className="home-page__region-list">
            {regions.map((region) => (
              <article key={region.city} className="home-page__region-card">
                <strong>{region.city}</strong>
                <span>{region.detail}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="home-page__world-stats">
          {stats.map((stat) => (
            <article key={stat.label} className="home-page__world-stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomeWorldSection
