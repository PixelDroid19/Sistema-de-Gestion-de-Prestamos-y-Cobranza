// In-house i18n provider (no external deps).
// Locale persistence in localStorage; fallback to es.
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { safeLocalStorage } from '../lib/safeStorage';
import { es } from './dictionaries/es';
import { en } from './dictionaries/en';

export type Locale = 'es' | 'en';
type Dictionary = typeof es;
export type TranslationVars = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };
const STORAGE_KEY = 'app.locale';
const DEFAULT_LOCALE: Locale = 'es';
const LOCALE_TAGS: Record<Locale, string> = {
  es: 'es-CO',
  en: 'en-US',
};

let currentLocale: Locale = DEFAULT_LOCALE;

const isLocale = (value: string | null): value is Locale => value === 'es' || value === 'en';

const getStoredLocale = (): Locale | null => {
  const saved = safeLocalStorage.getItem(STORAGE_KEY);
  return isLocale(saved) ? saved : null;
};

const getByPath = (source: any, path: string): unknown => path
  .split('.')
  .reduce((accumulator: any, segment) => (accumulator == null ? accumulator : accumulator[segment]), source);

export const interpolateTemplate = (template: string, vars?: TranslationVars): string => {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (accumulator, [key, value]) => accumulator.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
};

export const getCurrentLocale = (): Locale => getStoredLocale() ?? currentLocale;

export const getIntlLocaleTag = (locale: Locale = getCurrentLocale()): string => LOCALE_TAGS[locale];

const applyLocale = (next: Locale) => {
  currentLocale = next;
  safeLocalStorage.setItem(STORAGE_KEY, next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
};

export const translateDictionaryKey = (key: string, vars?: TranslationVars, locale: Locale = getCurrentLocale()): string => {
  const value = getByPath(DICTIONARIES[locale], key);
  if (typeof value === 'string') return interpolateTemplate(value, vars);
  const fallback = getByPath(DICTIONARIES[DEFAULT_LOCALE], key);
  return typeof fallback === 'string' ? interpolateTemplate(fallback, vars) : key;
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: TranslationVars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return getStoredLocale() ?? DEFAULT_LOCALE;
  });

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale: (next: Locale) => {
      applyLocale(next);
      setLocaleState(next);
    },
    t: (key: string, vars?: TranslationVars) => translateDictionaryKey(key, vars, locale),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Defensive default — works during unit tests that mount components without provider.
    return {
      locale: 'es' as Locale,
      setLocale: () => {},
      t: (key: string, vars?: TranslationVars) => translateDictionaryKey(key, vars, DEFAULT_LOCALE),
    };
  }
  return ctx;
}
