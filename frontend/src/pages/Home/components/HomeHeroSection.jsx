import React from 'react';
import { ShieldCheck, TrendingUp } from 'lucide-react';

import HomeDeviceFrame from '@/pages/Home/components/HomeDeviceFrame';
import HomeStoreButton from '@/pages/Home/components/HomeStoreButton';

import './HomeHeroSection.scss';

function HomeHeroSection({ t, storeButtons }) {
  return (
    <section className="home-hero-section">
      <div className="home-hero-section__container hero-container">
        <div className="home-hero-content hero-content">
          <h1 className="home-hero-content__title">
            {t('home.hero.title1')} <br />
            {t('home.hero.title2')} <br />
            <span className="home-gradient-text">{t('home.hero.titleHighlight')}</span>
          </h1>

          <p className="home-hero-content__description">{t('home.hero.description')}</p>

          <div className="home-store-buttons">
            {storeButtons.map(({ key, eyebrowKey, ...buttonConfig }) => (
              <HomeStoreButton key={key} eyebrow={t(eyebrowKey)} className="hero-store-btn" {...buttonConfig} />
            ))}
          </div>
        </div>

        <div className="home-hero-visual hero-image">
          <div className="home-hero-visual__ring home-hero-visual__ring--teal" />
          <div className="home-hero-visual__ring home-hero-visual__ring--indigo" />

          <div className="floating-badge floating-badge--left">
            <div className="floating-badge__icon floating-badge__icon--success">
              <ShieldCheck size={24} />
            </div>
            <div className="floating-badge__copy">
              <span className="floating-badge__label">{t('home.hero.badgeEncryption')}</span>
              <span className="floating-badge__value">{t('home.hero.badgeSecurity')}</span>
            </div>
          </div>

          <div className="floating-badge floating-badge--right">
            <div className="floating-badge__icon floating-badge__icon--primary">
              <TrendingUp size={24} />
            </div>
            <div className="floating-badge__copy">
              <span className="floating-badge__label">{t('home.hero.badgePerformance')}</span>
              <span className="floating-badge__value">+24.5%</span>
            </div>
          </div>

          <HomeDeviceFrame className="phone-mockup--hero">
              <div className="mock-header" />
              <div className="mock-hero" />

              <div className="mock-row">
                <div className="mock-avatar mock-avatar--rose" />
                <div className="mock-row__content">
                  <div className="mock-line-1" />
                  <div className="mock-line-2" />
                </div>
              </div>

              <div className="mock-row">
                <div className="mock-avatar mock-avatar--sky" />
                <div className="mock-row__content">
                  <div className="mock-line-1 mock-line-1--80" />
                  <div className="mock-line-2 mock-line-2--50" />
                </div>
              </div>

              <div className="mock-row">
                <div className="mock-avatar mock-avatar--green" />
                <div className="mock-row__content">
                  <div className="mock-line-1 mock-line-1--60" />
                  <div className="mock-line-2 mock-line-2--30" />
                </div>
              </div>
          </HomeDeviceFrame>
        </div>
      </div>
    </section>
  );
}

export default HomeHeroSection;
