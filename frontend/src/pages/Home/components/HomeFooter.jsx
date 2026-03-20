import React from 'react';
import { Apple, Play } from 'lucide-react';

import './HomeFooter.scss';

function HomeFooter({ t }) {
  return (
    <footer className="home-footer">
      <div className="footer-grid">
        <div className="home-footer__content">
          <h2 className="home-footer__title">
            {t('home.footer.title')} <br /> {t('home.footer.titleBreak')}
          </h2>

          <div className="home-footer__store-buttons">
            <button className="home-store-button home-store-button--light" type="button">
              <Apple size={28} />
              <span className="home-store-button__copy">
                <span className="home-store-button__eyebrow">{t('home.hero.downloadApple')}</span>
                <span className="home-store-button__label">App Store</span>
              </span>
            </button>

            <button className="home-store-button home-store-button--mint" type="button">
              <Play size={24} fill="#111827" />
              <span className="home-store-button__copy">
                <span className="home-store-button__eyebrow">{t('home.hero.availablePlay')}</span>
                <span className="home-store-button__label">Google Play</span>
              </span>
            </button>
          </div>
        </div>

        <div className="home-footer__visual">
          <div className="phone-mockup phone-mockup--footer">
            <div className="phone-notch" />
            <div className="phone-screen phone-screen--footer">
              <div className="mock-hero mock-hero--emerald" />

              <div className="mock-row mock-row--footer">
                <div className="mock-avatar mock-avatar--indigo-soft" />
                <div className="mock-row__content">
                  <div className="mock-line-1 mock-line-1--90" />
                  <div className="mock-line-2 mock-line-2--60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="home-footer__legal">
        <div>{t('home.footer.copyright')}</div>
        <div className="home-footer__legal-links">
          <a className="home-footer__legal-link" href="#">
            {t('home.footer.terms')}
          </a>
          <a className="home-footer__legal-link" href="#">
            {t('home.footer.privacy')}
          </a>
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
