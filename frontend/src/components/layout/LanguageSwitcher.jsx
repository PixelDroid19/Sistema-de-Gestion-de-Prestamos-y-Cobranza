import React from 'react'

import { useTranslation } from 'react-i18next'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <label className="field-group language-switcher">
      <span className="visually-hidden">{t('language.label')}</span>
      <select
        className="field-control"
        aria-label={t('language.label')}
        value={i18n.resolvedLanguage || i18n.language || 'es'}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
      >
        <option value="es">{t('language.spanish')}</option>
        <option value="en">{t('language.english')}</option>
      </select>
    </label>
  )
}

export default LanguageSwitcher
