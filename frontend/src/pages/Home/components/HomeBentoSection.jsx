import React from 'react';
import { Award, MousePointerClick, ShieldCheck } from 'lucide-react';

function HomeBentoSection({ t }) {
  return (
    <section className="home-section home-section--white">
      <div className="home-section__container">
        <h2 className="home-section__title home-section__title--accent home-section__title--bento">
          {t('home.bento.title1')} <br />
          <span className="home-section__title-dark">{t('home.bento.titleHighlight')}</span>
        </h2>

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
                <div className="bento-item__stat-value">150+</div>
                <div className="bento-item__stat-label">{t('home.bento.loansManaged')}</div>
              </div>
              <div className="bento-item__divider" />
              <div className="bento-item__stat">
                <div className="bento-item__stat-value">60+</div>
                <div className="bento-item__stat-label">{t('home.bento.activeAgents')}</div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default HomeBentoSection;
