/** Shared bordered icon button shell (matches IconActionButton / action-button--ghost). */
export const tableIconButtonBase =
  'action-button action-button--ghost h-9 w-9 !min-h-0 !p-0 shrink-0';

export const tableIconButtonDanger =
  'action-button action-button--danger h-9 w-9 !min-h-0 !p-0 shrink-0';

export const installmentActionHover = {
  blue: 'hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-200',
  amber: 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-200',
  slate: 'hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:hover:border-slate-500/30 dark:hover:bg-slate-500/10 dark:hover:text-slate-200',
  rose: '',
  emerald: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-200',
} as const;

export type InstallmentActionTone = keyof typeof installmentActionHover;

export function installmentActionClass(tone: InstallmentActionTone) {
  if (tone === 'rose') {
    return tableIconButtonDanger;
  }

  return `${tableIconButtonBase} ${installmentActionHover[tone]}`;
}

export const FINANCIAL_SCHEDULE_TABLE_CLASS = 'financial-schedule-table';

/** Calendario de cuotas en detalle de crédito (estilos dedicados en index.css). */
export const CREDIT_INSTALLMENT_CALENDAR_TABLE_CLASS = 'credit-installment-calendar-table';

/** Apply to action column th/td for vertical centering with RowActionToolbar (operational tables). */
export const TABLE_CELL_ACTIONS_CLASS = 'table-cell-actions';

/** AppTable inside an outer `.data-table-surface` (no duplicate border/shadow). */
export const TABLE_EMBEDDED_SHELL_CLASS = 'border-0 shadow-none bg-transparent rounded-none';
