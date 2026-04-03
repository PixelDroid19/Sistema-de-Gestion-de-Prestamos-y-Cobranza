export type ChipTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export const CHIP_TONE_CLASSNAMES: Record<ChipTone, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30',
  warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30',
  danger: 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-500/30',
  info: 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30',
  neutral: 'bg-slate-100 dark:bg-slate-500/20 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-500/30',
};

export const getChipClassName = (tone: ChipTone): string => CHIP_TONE_CLASSNAMES[tone];
