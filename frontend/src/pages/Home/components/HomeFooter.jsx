import React from 'react'

import HomeDeviceFrame from '@/pages/Home/components/HomeDeviceFrame'
import HomeStoreButton from '@/pages/Home/components/HomeStoreButton'

import './HomeFooter.scss'

function HomeFooter({ t, storeButtons }) {
  return (
    <footer className="home-footer">
      <div className="footer-grid">
        <div className="home-footer__content">
          <h2 className="home-footer__title">
            {t('home.footer.title')} <br /> {t('home.footer.titleBreak')}
          </h2>

          <div className="home-footer__store-buttons">
            {storeButtons.map(({ key, eyebrowKey, ...buttonConfig }) => (
              <HomeStoreButton key={key} eyebrow={t(eyebrowKey)} {...buttonConfig} />
            ))}
          </div>
        </div>

        <div className="home-footer__visual">
          <HomeDeviceFrame className="phone-mockup--footer" screenClassName="phone-screen--footer">
            <div className="mock-hero mock-hero--emerald" />

            <div className="mock-row mock-row--footer">
              <div className="mock-avatar mock-avatar--indigo-soft" />
              <div className="mock-row__content">
                <div className="mock-line-1 mock-line-1--90" />
                <div className="mock-line-2 mock-line-2--60" />
              </div>
            </div>
          </HomeDeviceFrame>
        </div>
      </div>

      <div className="home-footer__legal">
        <div>{t('home.footer.copyright')}</div>
        <div className="home-footer__legal-links">
          <a className="home-footer__legal-link" href="#top">
            {t('home.footer.terms')}
          </a>
          <a className="home-footer__legal-link" href="#top">
            {t('home.footer.privacy')}
          </a>
        </div>
      </div>
    </footer>
  )
}

export default HomeFooter
