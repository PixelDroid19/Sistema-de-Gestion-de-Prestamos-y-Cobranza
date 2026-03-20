import React from 'react';
import { TrendingUp } from 'lucide-react';

import './HomeHeader.scss';

function HomeHeader({ t, onBackHome, onLoginClick, onSignUpClick }) {
  return (
    <header className="home-header">
      <button className="home-brand" type="button" onClick={onBackHome}>
        <span className="home-brand__mark">
          <TrendingUp size={20} color="white" />
        </span>
        <span className="home-brand__title">LendFlow</span>
      </button>

      <nav className="home-header__nav nav-links" aria-label={t('home.nav.home')}>
        <a className="home-header__link home-header__link--active" href="#">
          {t('home.nav.home')}
        </a>
        <a className="home-header__link" href="#">
          {t('home.nav.platform')}
        </a>
        <a className="home-header__link" href="#">
          {t('home.nav.partners')}
        </a>
      </nav>

      <div className="home-header__actions">
        <button className="home-button home-button--ghost" type="button" onClick={onLoginClick}>
          {t('home.auth.loginCta')}
        </button>
        <button className="home-button home-button--primary" type="button" onClick={onSignUpClick}>
          {t('home.auth.registerCta')}
        </button>
      </div>
    </header>
  );
}

export default HomeHeader;
