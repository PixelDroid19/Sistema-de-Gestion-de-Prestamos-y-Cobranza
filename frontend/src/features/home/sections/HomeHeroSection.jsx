import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Register from '@/pages/Register/Register'

function HomeHeroSection({
  mode,
  onModeChange,
  metrics,
  proofPoints,
  floatingBadges,
  phonePanels,
  error,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  isSubmitting,
  onLogin,
}) {
  const { t } = useTranslation()

  return (
    <section className="home-page__hero">
      <div className="home-page__copy">
        <span className="home-page__eyebrow">{t('home.eyebrow')}</span>
        <h1>{t('home.title')}</h1>
        <p className="home-page__lede">{t('home.description')}</p>
        <p className="home-page__support">{t('home.supportingDescription')}</p>

        <div className="home-page__actions">
          <Button type="button" onClick={() => onModeChange('login')}>
            {t('home.primaryCta')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onModeChange('register')}>
            {t('home.secondaryCta')}
          </Button>
        </div>

        <div className="home-page__metric-grid">
          {metrics.map((metric) => (
            <div key={metric.label} className="home-page__metric-card">
              <span className="home-page__metric-value">{metric.value}</span>
              <span className="home-page__metric-label">{metric.label}</span>
            </div>
          ))}
        </div>

        <div className="home-page__proof-list" aria-label={t('home.proofLabel')}>
          {proofPoints.map((point) => (
            <span key={point} className="home-page__proof-pill">
              {point}
            </span>
          ))}
        </div>
      </div>

      <div className="home-page__hero-aside">
        <div className="home-page__visual-stage">
          {floatingBadges.map((badge, index) => (
            <span
              key={badge.label}
              className={`home-page__floating-badge home-page__floating-badge--${badge.variant} home-page__floating-badge--${index + 1}`}
            >
              {badge.label}
            </span>
          ))}

          <div className="home-page__phone-stack">
            {phonePanels.map(({ kicker, title, value, caption, icon: Icon, items }) => (
              <article key={title} className="home-page__phone-mockup">
                <div className="home-page__phone-status">
                  <span>{kicker}</span>
                  <Icon size={16} />
                </div>
                <strong>{title}</strong>
                <span className="home-page__phone-value">{value}</span>
                <p>{caption}</p>
                <div className="home-page__phone-list">
                  {items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <Card hero className="home-page__auth-panel">
          <div className="home-page__auth-tabs" role="tablist" aria-label={t('home.authCardTitle')}>
            <button
              className={mode === 'login' ? 'is-active' : ''}
              type="button"
              aria-pressed={mode === 'login'}
              onClick={() => onModeChange('login')}
            >
              {t('home.tabs.login')}
            </button>
            <button
              className={mode === 'register' ? 'is-active' : ''}
              type="button"
              aria-pressed={mode === 'register'}
              onClick={() => onModeChange('register')}
            >
              {t('home.tabs.register')}
            </button>
          </div>

          <CardHeader
            eyebrow={t('home.brand')}
            title={mode === 'login' ? t('home.authCardTitle') : t('auth.register.title')}
            subtitle={mode === 'login' ? t('home.authCardDescription') : t('auth.register.description')}
            compact
          />

          <CardBody>
            {mode === 'login' ? (
              <form className="home-page__login-form" onSubmit={onSubmit}>
                <div className="home-page__panel-header">
                  <h2>{t('auth.login.title')}</h2>
                  <p>{t('auth.login.description')}</p>
                </div>

                {error ? <div className="inline-message inline-message--error">{error}</div> : null}

                <Input
                  label={t('auth.login.email')}
                  type="email"
                  value={email}
                  onChange={onEmailChange}
                  autoComplete="email"
                  required
                />

                <Input
                  label={t('auth.login.password')}
                  type="password"
                  value={password}
                  onChange={onPasswordChange}
                  autoComplete="current-password"
                  required
                />

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
                </Button>
              </form>
            ) : (
              <div className="home-page__register-surface">
                <Register onLogin={onLogin} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  )
}

export default HomeHeroSection
