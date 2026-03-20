import React from 'react'
import { ShieldCheck } from 'lucide-react'

import Button from '@/components/ui/Button'
import Register from '@/pages/Register/Register'

import './HomeAuthPanel.scss'

function formatErrorMessage(errorMessage) {
  if (errorMessage.includes('\n')) {
    const lineOccurrences = new Map()

    return errorMessage.split('\n').map((line) => {
      const occurrence = lineOccurrences.get(line) ?? 0
      lineOccurrences.set(line, occurrence + 1)

      return (
        <div key={`home-auth-error-line-${line}-${occurrence}`} className="home-auth-error__line">
          {line}
        </div>
      )
    })
  }

  return errorMessage
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
  onLogin,
}) {
  return (
    <div className="home-auth-view">
      <div className="home-auth-card">
        {showRegister ? (
          <Register onLogin={onLogin} />
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

            <Button className="home-submit-button" type="submit" disabled={loading}>
              {loading ? t('home.auth.loadingLogin') : t('home.auth.loginButton')}
            </Button>

            <Button className="home-back-button" type="button" variant="outline" onClick={onBackHome}>
              {t('home.auth.backToHome')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default HomeAuthPanel
