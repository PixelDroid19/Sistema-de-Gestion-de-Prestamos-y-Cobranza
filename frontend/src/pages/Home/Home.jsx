import React, { useState } from 'react';
import {
  Apple,
  Award,
  CheckCircle2,
  MapPin,
  MousePointerClick,
  PiggyBank,
  Play,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Register from '@/pages/Register/Register';
import { handleApiError } from '@/lib/api/errors';
import { useLoginMutation } from '@/hooks/useAuth';

import './Home.scss';

function Home({ onLogin }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLoginMutation();
  const loading = loginMutation.isPending;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await loginMutation.mutateAsync({ email, password });
      setError('');
      onLogin();
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const formatErrorMessage = (errorMessage) => {
    if (errorMessage.includes('\n')) {
      return errorMessage.split('\n').map((line, index) => (
        <div key={index} className="home-auth-error__line">
          {line}
        </div>
      ));
    }

    return errorMessage;
  };

  const resetAuthState = () => {
    setError('');
    setEmail('');
    setPassword('');
  };

  const handleLoginClick = () => {
    setShowForm(true);
    setShowRegister(false);
    resetAuthState();
  };

  const handleSignUpClick = () => {
    setShowForm(true);
    setShowRegister(true);
    resetAuthState();
  };

  const handleBackHome = () => {
    setShowForm(false);
    setShowRegister(false);
    resetAuthState();
  };

  const featureCards = [
    {
      key: 'portfolio',
      Icon: ShieldCheck,
      cardClassName: 'feature-card feature-card--sky',
      iconClassName: 'feature-card__icon-shell feature-card__icon-shell--sky',
      titleClassName: 'feature-card__title feature-card__title--sky',
      iconColor: '#0284C7',
      title: (
        <>
          {t('home.features.card1')} <br />
          {t('home.features.card1Break')}
        </>
      ),
    },
    {
      key: 'collections',
      Icon: PiggyBank,
      cardClassName: 'feature-card feature-card--amber',
      iconClassName: 'feature-card__icon-shell feature-card__icon-shell--amber',
      titleClassName: 'feature-card__title feature-card__title--amber',
      iconColor: '#D97706',
      title: (
        <>
          {t('home.features.card2')} <br />
          {t('home.features.card2Break')}
        </>
      ),
    },
    {
      key: 'goals',
      Icon: TrendingUp,
      cardClassName: 'feature-card feature-card--orange',
      iconClassName: 'feature-card__icon-shell feature-card__icon-shell--orange',
      titleClassName: 'feature-card__title feature-card__title--orange',
      iconColor: '#EA580C',
      title: (
        <>
          {t('home.features.card3')} <br />
          {t('home.features.card3Break')}
        </>
      ),
    },
  ];

  const controlItems = [
    t('home.control.item1'),
    t('home.control.item2'),
    t('home.control.item3'),
  ];

  const worldStats = [
    {
      key: 'locations',
      Icon: MapPin,
      value: '60+',
      label: t('home.world.locations'),
      iconClassName: 'home-stat__icon home-stat__icon--primary',
    },
    {
      key: 'operations',
      Icon: Users,
      value: '20L+',
      label: t('home.world.operations'),
      iconClassName: 'home-stat__icon home-stat__icon--sky',
    },
    {
      key: 'portfolio',
      Icon: PiggyBank,
      value: '$900k',
      label: t('home.world.portfolio'),
      iconClassName: 'home-stat__icon home-stat__icon--emerald',
    },
  ];

  return (
    <div className="home-container">
      <div className="home-page">
        <header className="home-header">
          <button className="home-brand" type="button" onClick={handleBackHome}>
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
            <button className="home-button home-button--ghost" type="button" onClick={handleLoginClick}>
              {t('home.auth.loginCta')}
            </button>
            <button className="home-button home-button--primary" type="button" onClick={handleSignUpClick}>
              {t('home.auth.registerCta')}
            </button>
          </div>
        </header>

        {showForm ? (
          <div className="home-auth-view">
            <div className="home-auth-card">
              {showRegister ? (
                <Register onCancel={handleBackHome} />
              ) : (
                <form className="home-auth-form" onSubmit={handleLogin}>
                  <div className="home-auth-form__intro">
                    <div className="home-auth-form__badge">
                      <ShieldCheck size={28} color="#4F46E5" />
                    </div>
                    <h2 className="home-auth-form__title">{t('home.auth.welcomeTitle')}</h2>
                    <p className="home-auth-form__description">{t('home.auth.welcomeSubtitle')}</p>
                  </div>

                  {error ? <div className="home-auth-error">{formatErrorMessage(error)}</div> : null}

                  <div className="home-field">
                    <label className="home-field__label" htmlFor="home-email">
                      {t('home.auth.emailLabel')}
                    </label>
                    <input
                      id="home-email"
                      className="home-field__input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="home-field">
                    <label className="home-field__label" htmlFor="home-password">
                      {t('home.auth.passwordLabel')}
                    </label>
                    <input
                      id="home-password"
                      className="home-field__input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button className="home-submit-button" type="submit" disabled={loading}>
                    {loading ? t('home.auth.loadingLogin') : t('home.auth.loginButton')}
                  </button>

                  <button className="home-back-button" type="button" onClick={handleBackHome}>
                    {t('home.auth.backToHome')}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
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
                    <button className="home-store-button home-store-button--dark hero-store-btn" type="button">
                      <Apple size={28} />
                      <span className="home-store-button__copy">
                        <span className="home-store-button__eyebrow">{t('home.hero.downloadApple')}</span>
                        <span className="home-store-button__label">App Store</span>
                      </span>
                    </button>

                    <button className="home-store-button home-store-button--dark hero-store-btn" type="button">
                      <Play size={24} fill="white" />
                      <span className="home-store-button__copy">
                        <span className="home-store-button__eyebrow">{t('home.hero.availablePlay')}</span>
                        <span className="home-store-button__label">Google Play</span>
                      </span>
                    </button>
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

                  <div className="phone-mockup phone-mockup--hero">
                    <div className="phone-notch" />
                    <div className="phone-screen">
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
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="home-section home-section--white">
              <div className="home-section__container">
                <h2 className="home-section__title home-section__title--accent">
                  {t('home.features.title1')} <br />
                  <span className="home-section__title-dark">{t('home.features.titleHighlight')}</span>
                </h2>
                <p className="home-section__description home-section__description--wide">
                  {t('home.features.description')}
                </p>

                <div className="features-grid">
                  {featureCards.map(({ key, Icon, cardClassName, iconClassName, titleClassName, iconColor, title }) => (
                    <article key={key} className={cardClassName}>
                      <div className={iconClassName}>
                        <Icon size={36} color={iconColor} />
                      </div>
                      <h3 className={titleClassName}>{title}</h3>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="home-section home-section--muted home-section--split">
              <div className="home-section__container split-section">
                <div className="split-content">
                  <h2 className="home-section__title home-section__title--accent home-section__title--split">
                    {t('home.control.title1')} <br />
                    <span className="home-section__title-dark">{t('home.control.titleHighlight')}</span>
                  </h2>

                  <h3 className="split-content__subtitle">{t('home.control.subtitle')}</h3>

                  <ul className="split-content__list">
                    {controlItems.map((item) => (
                      <li key={item} className="split-content__item">
                        <span className="split-content__icon">
                          <CheckCircle2 size={24} color="#059669" />
                        </span>
                        <span>{item}</span>
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

            <section className="home-section home-section--muted home-section--centered">
              <div className="home-section__container home-section__container--centered">
                <h2 className="home-world__title">
                  {t('home.world.title1')} <span className="home-world__title-accent">LendFlow</span>
                </h2>
                <p className="home-world__description">{t('home.world.description')}</p>

                <div className="home-world__map">
                  <div className="home-world__map-canvas">
                    <div className="home-world__marker home-world__marker--one">
                      <Users size={28} />
                    </div>
                    <div className="home-world__marker home-world__marker--two">
                      <Users size={24} />
                    </div>
                    <div className="home-world__marker home-world__marker--three">
                      <Users size={32} />
                    </div>
                    <div className="home-world__marker home-world__marker--center">
                      <MapPin size={40} />
                    </div>
                  </div>
                </div>

                <div className="stats-row">
                  {worldStats.map(({ key, Icon, value, label, iconClassName }) => (
                    <div key={key} className="home-stat">
                      <span className={iconClassName}>
                        <Icon size={40} />
                      </span>
                      <div className="home-stat__value">{value}</div>
                      <div className="home-stat__label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

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
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
