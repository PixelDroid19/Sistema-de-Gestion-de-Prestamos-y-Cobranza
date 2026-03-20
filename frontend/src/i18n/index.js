import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/locales/en/common.json'
import esCommon from '@/locales/es/common.json'

const resources = {
  en: {
    common: enCommon,
  },
  es: {
    common: esCommon,
  },
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: 'es',
    fallbackLng: 'en',
    supportedLngs: ['es', 'en'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })
}

export default i18n
