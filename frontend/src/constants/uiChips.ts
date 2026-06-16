export type ChipTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'neutral';

export const CHIP_TONE_CLASSNAMES: Record<ChipTone, string> = {
  success: 'border border-emerald-100 bg-emerald-50/70 font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/8 dark:text-emerald-200',
  warning: 'border border-amber-100 bg-amber-50 font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  danger: 'border border-rose-100 bg-rose-50 font-semibold text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200',
  info: 'border border-sky-100 bg-sky-50 font-semibold text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
  brand: 'border border-brand-primary/20 bg-brand-primary/8 font-semibold text-brand-primary dark:border-brand-primary/25 dark:bg-brand-primary/12 dark:text-brand-primary',
  neutral: 'border border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200',
};

export const getChipClassName = (tone: ChipTone): string => CHIP_TONE_CLASSNAMES[tone];
