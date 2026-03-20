import React from 'react'
import { useTranslation } from 'react-i18next'

function HomeProcessSection({ steps }) {
  const { t } = useTranslation()

  return (
    <section className="home-page__section home-page__section--process">
      <div className="home-page__section-header">
        <span className="section-eyebrow">{t('home.workflow')}</span>
        <h2>{t('home.processTitle')}</h2>
        <p>{t('home.processDescription')}</p>
      </div>

      <div className="home-page__timeline">
        {steps.map((step, index) => (
          <article key={step.title} className="home-page__timeline-step">
            <span>{`0${index + 1}`}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default HomeProcessSection
