export type ChipTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export const CHIP_TONE_CLASSNAMES: Record<ChipTone, string> = {
  success: 'border border-emerald-200 bg-emerald-100 font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200',
  warning: 'border border-amber-200 bg-amber-100 font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200',
  danger: 'border border-red-200 bg-red-100 font-semibold text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200',
  info: 'border border-blue-200 bg-blue-100 font-semibold text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200',
  neutral: 'border border-slate-200 bg-slate-100 font-semibold text-slate-900 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-200',
};

export const getChipClassName = (tone: ChipTone): string => CHIP_TONE_CLASSNAMES[tone];
