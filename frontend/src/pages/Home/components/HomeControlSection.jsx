import React from 'react';
import { CheckCircle2 } from 'lucide-react';

import './HomeControlSection.scss';

function HomeControlSection({ t, controlItemKeys }) {
  return (
    <section className="home-section home-section--muted home-section--split">
      <div className="home-section__container split-section">
        <div className="split-content">
          <h2 className="home-section__title home-section__title--accent home-section__title--split">
            {t('home.control.title1')} <br />
            <span className="home-section__title-dark">{t('home.control.titleHighlight')}</span>
          </h2>

          <h3 className="split-content__subtitle">{t('home.control.subtitle')}</h3>

          <ul className="split-content__list">
            {controlItemKeys.map((itemKey) => (
              <li key={itemKey} className="split-content__item">
                <span className="split-content__icon">
                  <CheckCircle2 size={24} color="#059669" />
                </span>
                <span>{t(itemKey)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="split-visual">
          <div className="split-visual__ring" />

          <div className="phone-mockup phone-mockup--split">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="split-board__hero" />
              <div className="split-board__metrics">
                <div className="split-board__metric split-board__metric--green" />
                <div className="split-board__metric split-board__metric--indigo" />
              </div>

              <div className="mock-row">
                <div className="mock-avatar mock-avatar--slate" />
                <div className="mock-row__content">
                  <div className="mock-line-1 mock-line-1--slate" />
                  <div className="mock-line-2" />
                </div>
              </div>

              <div className="mock-row">
                <div className="mock-avatar mock-avatar--slate" />
                <div className="mock-row__content">
                  <div className="mock-line-1 mock-line-1--slate" />
                  <div className="mock-line-2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeControlSection;
