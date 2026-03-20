import React from 'react';
import { TrendingUp } from 'lucide-react';

import Button from '@/components/ui/Button';

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
        <Button className="home-button home-button--ghost" type="button" variant="outline" onClick={onLoginClick}>
          {t('home.auth.loginCta')}
        </Button>
        <Button className="home-button home-button--primary" type="button" onClick={onSignUpClick}>
          {t('home.auth.registerCta')}
        </Button>
      </div>
    </header>
  );
}

export default HomeHeader;
