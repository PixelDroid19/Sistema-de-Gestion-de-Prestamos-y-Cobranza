import type React from 'react';
import { ArrowLeft, CreditCard, DollarSign, Edit2, FileSpreadsheet, FileText, GitBranch, Layers, Percent, Table } from 'lucide-react';
import { QuickGuideButton } from '../shared/HelpSupport';
import { ActionButton, IconActionButton, StatusChip } from '../shared/Surfaces';

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
  canAccessBackofficeActions: boolean;
  canExportCreditExcel: boolean;
  isExportingCreditExcel: boolean;
  installmentPaymentGuard: CreditActionGuard;
  capitalPaymentGuard: CreditActionGuard;
  payoffPaymentGuard: CreditActionGuard;
  lateFeeUpdateGuard: CreditActionGuard;
  creditStatusUpdateGuard: CreditActionGuard;
  onBack: () => void;
  onRegisterPayment: () => void;
  onOpenCapitalPayment: () => void;
  onPayoff: () => void;
  onOpenLateFeeRate: () => void;
  onOpenStatus: () => void;
  onExportCreditExcel: () => void;
  onOpenSchedule: () => void;
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
  canAccessBackofficeActions,
  canExportCreditExcel,
  isExportingCreditExcel,
  installmentPaymentGuard,
  capitalPaymentGuard,
  payoffPaymentGuard,
  lateFeeUpdateGuard,
  creditStatusUpdateGuard,
  onBack,
  onRegisterPayment,
  onOpenCapitalPayment,
  onPayoff,
  onOpenLateFeeRate,
  onOpenStatus,
  onExportCreditExcel,
  onOpenSchedule,
}: CreditDetailHeaderProps) {
  return (
    <section className="border-b border-border-subtle pb-3" data-tour="credit-detail-header">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <IconActionButton
              onClick={onBack}
              label="Volver a créditos"
              icon={<ArrowLeft size={20} />}
              className="shrink-0"
            />
            <h1 className="min-w-0 text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-3xl">Crédito #{loanId}</h1>
            <StatusChip size="sm" className={`uppercase tracking-[0.12em] ${statusInfo.className}`}>
              {statusInfo.label}
            </StatusChip>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-text-secondary">
            {subtitle}
          </p>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5">
            <InlineMetaLine icon={FileText} label="Cliente" value={customerLabel} />
            <InlineMetaLine icon={GitBranch} label="Perfil" value={calculationProfileSummary} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:max-w-[42rem] xl:justify-end" data-tour="credit-detail-primary-actions">
          <QuickGuideButton
            guideKey="credit-details"
            guideContext={{ loanId }}
            className="min-h-11 shrink-0"
          />
          {canAccessBackofficeActions && lateFeeUpdateGuard.visible && (
            <ActionButton
              onClick={onOpenLateFeeRate}
              disabled={!lateFeeUpdateGuard.executable}
              title={lateFeeUpdateGuard.executable ? 'Ajustar tasa de mora del crédito' : lateFeeUpdateGuard.reason}
              icon={<Percent size={16} />}
            >
              Tasa de mora
            </ActionButton>
          )}
          {canAccessBackofficeActions && creditStatusUpdateGuard.visible && (
            <ActionButton
              onClick={onOpenStatus}
              disabled={!creditStatusUpdateGuard.executable}
              title={creditStatusUpdateGuard.executable ? 'Cambiar estado del crédito' : creditStatusUpdateGuard.reason}
              icon={<Edit2 size={16} />}
            >
              Estado
            </ActionButton>
          )}
          {canExportCreditExcel && (
            <ActionButton
              onClick={onExportCreditExcel}
              disabled={isExportingCreditExcel}
              isLoading={isExportingCreditExcel}
              title="Descargar Excel operativo de este crédito con resumen, amortización e historial de pagos"
              icon={<FileSpreadsheet size={16} />}
            >
              Excel
            </ActionButton>
          )}
          <ActionButton
            onClick={onOpenSchedule}
            title="Ver plan de pagos completo"
            icon={<Table size={16} />}
          >
            Plan de pagos
          </ActionButton>
        </div>
      </div>

      <div
        className="mt-3 border-y border-border-subtle py-3"
        data-tour="credit-detail-secondary-actions"
      >
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.75fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-primary/60">
              Acciones de pago
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Recaudos y liquidación del crédito.
            </p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:justify-end">
          {installmentPaymentGuard.visible && (
            <ActionButton
              onClick={onRegisterPayment}
              disabled={!installmentPaymentGuard.executable}
              title={installmentPaymentGuard.executable ? undefined : installmentPaymentGuard.reason}
              icon={<DollarSign size={16} />}
              variant="primary"
              className="w-full lg:w-auto"
            >
              {registerPaymentLabel}
            </ActionButton>
          )}
          {canAccessBackofficeActions && capitalPaymentGuard.visible && (
            <ActionButton
              onClick={onOpenCapitalPayment}
              disabled={!capitalPaymentGuard.executable}
              title={capitalPaymentGuard.executable ? undefined : capitalPaymentGuard.reason}
              icon={<Layers size={16} />}
              className="w-full lg:w-auto"
            >
              {capitalContributionLabel}
            </ActionButton>
          )}
          {payoffPaymentGuard.visible && (
            <ActionButton
              onClick={onPayoff}
              disabled={!payoffPaymentGuard.executable}
              disabledReason={!payoffPaymentGuard.executable && payoffPaymentGuard.reason ? `Pago total no disponible. ${payoffPaymentGuard.reason}` : undefined}
              title="Liquidar el saldo completo del crédito"
              icon={<CreditCard size={16} />}
              className="w-full lg:w-auto"
            >
              Pago total
            </ActionButton>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
