import React from 'react'
import { Award, MousePointerClick, ShieldCheck } from 'lucide-react'

import HomeSectionHeading from '@/pages/Home/components/HomeSectionHeading'

import './HomeBentoSection.scss'

function HomeBentoSection({ t, stats }) {
  return (
    <section className="home-section home-section--white">
      <div className="home-section__container">
        <HomeSectionHeading
          t={t}
          titleKey="home.bento.title1"
          highlightKey="home.bento.titleHighlight"
          titleClassName="home-section__title home-section__title--accent home-section__title--bento"
        />

        <div className="bento-grid">
          <article className="bento-item bento-tall bento-item--emerald">
            <div className="bento-item__icon bento-item__icon--emerald">
              <ShieldCheck size={32} color="#fff" />
            </div>
            <h3 className="bento-item__title bento-item__title--deep-green">{t('home.bento.panel1Text')}</h3>
            <div className="bento-item__link">
              {t('home.bento.discoverMore')} <MousePointerClick size={18} />
            </div>
          </article>

          <article className="bento-item bento-large bento-item--indigo">
            <div className="bento-item__icon bento-item__icon--glass">
              <Award size={36} color="#fff" />
            </div>
            <h3 className="bento-item__title bento-item__title--light">{t('home.bento.panel2Title')}</h3>
            <p className="bento-item__description bento-item__description--light">{t('home.bento.panel2Text')}</p>
          </article>

          <article className="bento-item bento-wide bento-item--surface">
            <div className="bento-item__stats">
              <div className="bento-item__stat">
                <div className="bento-item__stat-value">{stats[0]?.value}</div>
                <div className="bento-item__stat-label">{t(stats[0]?.labelKey)}</div>
              </div>
              <div className="bento-item__divider" />
              <div className="bento-item__stat">
                <div className="bento-item__stat-value">{stats[1]?.value}</div>
                <div className="bento-item__stat-label">{t(stats[1]?.labelKey)}</div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default HomeBentoSection
