import type React from 'react';
import { ArrowLeft, DollarSign, Edit2, FileSpreadsheet, FileText, GitBranch, Layers, Percent, Table } from 'lucide-react';
import { QuickGuideButton } from '../shared/HelpSupport';
import { ToolbarSurface } from '../shared/Surfaces';

type CreditActionGuard = {
  visible: boolean;
  executable: boolean;
  reason?: string;
};

type CreditStatusPresentation = {
  label: string;
  className: string;
};

type CreditDetailHeaderProps = {
  loanId: number;
  statusInfo: CreditStatusPresentation;
  subtitle: string;
  customerLabel: string;
  calculationProfileSummary: string;
  registerPaymentLabel: string;
  capitalContributionLabel: string;
  lateFeeRateLabel: string;
  isAdmin: boolean;
  isExportingCreditExcel: boolean;
  installmentPaymentGuard: CreditActionGuard;
  capitalPaymentGuard: CreditActionGuard;
  lateFeeUpdateGuard: CreditActionGuard;
  creditStatusUpdateGuard: CreditActionGuard;
  onBack: () => void;
  onRegisterPayment: () => void;
  onOpenCapitalPayment: () => void;
  onOpenLateFeeRate: () => void;
  onOpenStatus: () => void;
  onExportCreditExcel: () => void;
  onOpenSchedule: () => void;
};

const actionButtonBaseClassName =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-hover-bg disabled:text-text-secondary disabled:opacity-55 disabled:shadow-none';

const actionButtonClassNames = {
  primary: `${actionButtonBaseClassName} border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`,
  capital: `${actionButtonBaseClassName} border border-teal-700 bg-teal-700 text-white hover:bg-teal-800`,
  warning: `${actionButtonBaseClassName} border border-amber-600 bg-amber-600 text-white hover:bg-amber-700`,
  neutral: `${actionButtonBaseClassName} border border-slate-800 bg-slate-800 text-white hover:bg-slate-900 dark:border-slate-200 dark:bg-slate-200 dark:text-slate-950 dark:hover:bg-white`,
  secondary: `${actionButtonBaseClassName} border border-border-subtle bg-bg-surface text-text-primary hover:bg-hover-bg`,
};

function InlineMetaLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon size={15} className="shrink-0 text-brand-primary" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-primary/60 dark:text-text-secondary">{label}</span>
      <span className="min-w-0 break-words font-semibold leading-5 text-text-primary">{value}</span>
    </div>
  );
}

export function CreditDetailHeader({
  loanId,
  statusInfo,
  subtitle,
  customerLabel,
  calculationProfileSummary,
  registerPaymentLabel,
  capitalContributionLabel,
  lateFeeRateLabel,
  isAdmin,
  isExportingCreditExcel,
  installmentPaymentGuard,
  capitalPaymentGuard,
  lateFeeUpdateGuard,
  creditStatusUpdateGuard,
  onBack,
  onRegisterPayment,
  onOpenCapitalPayment,
  onOpenLateFeeRate,
  onOpenStatus,
  onExportCreditExcel,
  onOpenSchedule,
}: CreditDetailHeaderProps) {
  return (
    <section className="border-b border-border-subtle pb-4" data-tour="credit-detail-header">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-hover-bg hover:text-text-primary"
              aria-label="Volver a créditos"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="min-w-0 text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-[2.1rem]">Crédito #{loanId}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-text-secondary">
            {subtitle}
          </p>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
            <InlineMetaLine icon={FileText} label="Cliente" value={customerLabel} />
            <InlineMetaLine icon={GitBranch} label="Perfil" value={calculationProfileSummary} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end" data-tour="credit-detail-primary-actions">
          <QuickGuideButton
            guideKey="credit-details"
            guideContext={{ loanId }}
            className="min-h-11 shrink-0"
          />
          {installmentPaymentGuard.visible && (
            <button
              type="button"
              onClick={onRegisterPayment}
              disabled={!installmentPaymentGuard.executable}
              title={installmentPaymentGuard.executable ? undefined : installmentPaymentGuard.reason}
              className={actionButtonClassNames.primary}
            >
              <DollarSign size={16} /> {registerPaymentLabel}
            </button>
          )}
        </div>
      </div>

      <ToolbarSurface className="mt-4 gap-3 p-3 lg:grid lg:grid-cols-[minmax(13rem,0.65fr)_minmax(0,1.8fr)] lg:items-center" data-tour="credit-detail-secondary-actions">
        <div className="min-w-0 px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-primary/60">Operaciones del crédito</p>
          <p className="mt-1 max-w-xl text-sm leading-5 text-text-secondary">
            Acciones administrativas sobre pagos, estado y reportes sin cambiar la fórmula congelada.
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {isAdmin && capitalPaymentGuard.visible && (
            <button
              type="button"
              onClick={onOpenCapitalPayment}
              disabled={!capitalPaymentGuard.executable}
              title={capitalPaymentGuard.executable ? undefined : capitalPaymentGuard.reason}
              className={actionButtonClassNames.capital}
            >
              <Layers size={16} /> {capitalContributionLabel}
            </button>
          )}
          {isAdmin && lateFeeUpdateGuard.visible && (
            <button
              type="button"
              onClick={onOpenLateFeeRate}
              disabled={!lateFeeUpdateGuard.executable}
              title={lateFeeUpdateGuard.executable ? undefined : lateFeeUpdateGuard.reason}
              className={actionButtonClassNames.warning}
            >
              <Percent size={16} /> {lateFeeRateLabel}
            </button>
          )}
          {isAdmin && creditStatusUpdateGuard.visible && (
            <button
              type="button"
              onClick={onOpenStatus}
              disabled={!creditStatusUpdateGuard.executable}
              className={actionButtonClassNames.neutral}
              title={creditStatusUpdateGuard.executable ? 'Cambiar estado del crédito' : creditStatusUpdateGuard.reason}
            >
              <Edit2 size={16} /> Estado
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={onExportCreditExcel}
              disabled={isExportingCreditExcel}
              className={actionButtonClassNames.secondary}
              title="Descargar Excel operativo de este crédito con resumen, amortización e historial de pagos"
            >
              <FileSpreadsheet size={16} /> {isExportingCreditExcel ? 'Exportando...' : 'Excel'}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSchedule}
            className={actionButtonClassNames.secondary}
            title="Ver plan de pagos completo"
          >
            <Table size={16} /> Plan de pagos
          </button>
        </div>
      </ToolbarSurface>
    </section>
  );
}
