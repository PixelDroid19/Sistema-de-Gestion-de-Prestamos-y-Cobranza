import { getCurrentLocale, interpolateTemplate, type TranslationVars } from './index';
import { commonEs, customersEs, creditsEs, associatesEs, paymentsEs, reportsEs, auditEs, settingsEs } from './dictionaries/terms-es';
import { commonEn, customersEn, creditsEn, associatesEn, paymentsEn, reportsEn, auditEn, settingsEn } from './dictionaries/terms-en';

const terminologyEs = {
  ...commonEs,
  ...customersEs,
  ...creditsEs,
  ...associatesEs,
  ...paymentsEs,
  ...reportsEs,
  ...auditEs,
  ...settingsEs,
} as const;

export type TermKey = keyof typeof terminologyEs;

const terminologyEn: Record<TermKey, string> = {
  ...commonEn,
  ...customersEn,
  ...creditsEn,
  ...associatesEn,
  ...paymentsEn,
  ...reportsEn,
  ...auditEn,
  ...settingsEn,
};

const terminologyByLocale = {
  es: terminologyEs,
  en: terminologyEn,
} as const;

export const tTerm = (key: TermKey, vars?: TranslationVars): string => {
  const locale = getCurrentLocale();
  return interpolateTemplate(terminologyByLocale[locale][key] ?? terminologyEs[key], vars);
};

export const getTermAliases = (_key: TermKey): readonly string[] => [];
