import React from 'react'
import { useTranslation } from 'react-i18next'

function HomeExperienceSection({ cards, sectionId }) {
  const { t } = useTranslation()

  return (
    <section id={sectionId} className="home-page__section home-page__section--experience">
      <div className="home-page__section-header home-page__section-header--wide">
        <span className="section-eyebrow">{t('home.experience.eyebrow')}</span>
        <h2>{t('home.experience.title')}</h2>
        <p>{t('home.experience.description')}</p>
      </div>

      <div className="home-page__bento-grid">
        {cards.map((card) => (
          <article key={card.title} className={`home-page__bento-card home-page__bento-card--${card.tone}`}>
            <span className="home-page__bento-value">{card.value}</span>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default HomeExperienceSection
