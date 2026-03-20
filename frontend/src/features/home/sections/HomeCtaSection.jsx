import React from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'

function HomeCtaSection({ actions, onPrimaryClick, onSecondaryClick, sectionId }) {
  const { t } = useTranslation()

  return (
    <section id={sectionId} className="home-page__section home-page__section--cta">
      <div className="home-page__cta-card">
        <div className="home-page__cta-copy">
          <span className="section-eyebrow">{t('home.cta.eyebrow')}</span>
          <h2>{t('home.cta.title')}</h2>
          <p>{t('home.cta.description')}</p>
        </div>

        <div className="home-page__cta-actions">
          <Button type="button" onClick={onPrimaryClick} icon={ArrowRight}>
            {actions.primary}
          </Button>
          <Button type="button" variant="outline" onClick={onSecondaryClick}>
            {actions.secondary}
          </Button>
        </div>
      </div>
    </section>
  )
}

export default HomeCtaSection
