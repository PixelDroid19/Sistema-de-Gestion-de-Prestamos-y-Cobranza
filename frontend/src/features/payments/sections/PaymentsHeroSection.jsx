import React from 'react';
import { useTranslation } from 'react-i18next';

function PaymentsHeroSection({ summaryCards }) {
  const { t } = useTranslation()

  return (
    <section className="surface-card surface-card--hero">
      <div className="surface-card__header">
        <div>
          <div className="section-eyebrow">{t('payments.hero.eyebrow')}</div>
          <div className="section-title">{t('payments.hero.title')}</div>
          <div className="section-subtitle">
            {t('payments.hero.subtitle')}
          </div>
        </div>
      </div>
      <div className="surface-card__body">
        <div className="metric-grid">
          {summaryCards.map((card) => (
            <div key={card.label} className={`metric-card metric-card--${card.tone}`}>
              <div className="metric-card__label">{card.label}</div>
              <div className="metric-card__value">{card.value}</div>
              <div className="metric-card__caption">{card.caption}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PaymentsHeroSection;
