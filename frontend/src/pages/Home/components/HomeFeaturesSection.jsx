import React from 'react'
import { PiggyBank, ShieldCheck, TrendingUp } from 'lucide-react'

import HomeSectionHeading from '@/pages/Home/components/HomeSectionHeading'

import './HomeFeaturesSection.scss'

const FEATURE_ICON_MAP = {
  'shield-check': {
    Icon: ShieldCheck,
    iconColor: '#0284C7',
  },
  'piggy-bank': {
    Icon: PiggyBank,
    iconColor: '#D97706',
  },
  'trending-up': {
    Icon: TrendingUp,
    iconColor: '#EA580C',
  },
}

function HomeFeaturesSection({ t, featureCards }) {
  return (
    <section id="features" className="home-section home-section--white">
      <div className="home-section__container">
        <HomeSectionHeading
          t={t}
          titleKey="home.features.title1"
          highlightKey="home.features.titleHighlight"
          descriptionKey="home.features.description"
          descriptionClassName="home-section__description home-section__description--wide"
        />

        <div className="features-grid">
          {featureCards.map(({ key, icon, tone, titleKey, titleBreakKey }) => {
            const { Icon, iconColor } = FEATURE_ICON_MAP[icon] ?? FEATURE_ICON_MAP['shield-check']

            return (
              <article key={key} className={`feature-card feature-card--${tone}`}>
                <div className={`feature-card__icon-shell feature-card__icon-shell--${tone}`}>
                  <Icon size={36} color={iconColor} />
                </div>
                <h3 className={`feature-card__title feature-card__title--${tone}`}>
                  {t(titleKey)} <br />
                  {t(titleBreakKey)}
                </h3>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default HomeFeaturesSection
