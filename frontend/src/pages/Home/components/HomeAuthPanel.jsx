import React from 'react';
import { ShieldCheck } from 'lucide-react';

import Register from '@/pages/Register/Register';

function formatErrorMessage(errorMessage) {
  if (errorMessage.includes('\n')) {
    return errorMessage.split('\n').map((line, index) => (
      <div key={index} className="home-auth-error__line">
        {line}
      </div>
    ));
  }

  return errorMessage;
}

function HomeAuthPanel({
  t,
  showRegister,
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onBackHome,
}) {
  return (
    <div className="home-auth-view">
      <div className="home-auth-card">
        {showRegister ? (
          <Register onCancel={onBackHome} />
        ) : (
          <form className="home-auth-form" onSubmit={onSubmit}>
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
                onChange={(event) => onEmailChange(event.target.value)}
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
                onChange={(event) => onPasswordChange(event.target.value)}
                required
              />
            </div>

            <button className="home-submit-button" type="submit" disabled={loading}>
              {loading ? t('home.auth.loadingLogin') : t('home.auth.loginButton')}
            </button>

            <button className="home-back-button" type="button" onClick={onBackHome}>
              {t('home.auth.backToHome')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default HomeAuthPanel;
