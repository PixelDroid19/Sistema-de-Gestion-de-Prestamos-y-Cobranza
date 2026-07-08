import type React from 'react';
import { ArrowLeft, Edit2, FileSpreadsheet, FileText, Percent, Table } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { QuickGuideButton } from '../shared/HelpSupport';
import { IconActionButton, StatusChip } from '../shared/Surfaces';

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
  canAccessBackofficeActions: boolean;
  canExportCreditExcel: boolean;
  isExportingCreditExcel: boolean;
  lateFeeUpdateGuard: CreditActionGuard;
  creditStatusUpdateGuard: CreditActionGuard;
  onBack: () => void;
  onOpenLateFeeRate: () => void;
  onOpenStatus: () => void;
  onExportCreditExcel: () => void;
  onOpenSchedule: () => void;
};

function HeaderToolbarButton({
  children,
  icon,
  disabled,
  title,
  onClick,
  isLoading,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  isLoading?: boolean;
}) {
  return (
    <button
      type="button"
      className="credit-detail-header-toolbar-btn"
      disabled={disabled || isLoading}
      title={title}
      onClick={onClick}
    >
      <span className="credit-detail-header-toolbar-btn__icon" aria-hidden="true">{icon}</span>
      <span>{isLoading ? tTerm('common.cta.processing') : children}</span>
    </button>
  );
}

function HeaderMetaBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="credit-detail-header-meta-block">
      <span className="credit-detail-header-meta-block__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="credit-detail-header-meta-block__label">{label}</p>
        <p className="credit-detail-header-meta-block__value">{value}</p>
      </div>
    </div>
  );
}

export function CreditDetailHeader({
  loanId,
  statusInfo,
  subtitle,
  customerLabel,
  canAccessBackofficeActions,
  canExportCreditExcel,
  isExportingCreditExcel,
  lateFeeUpdateGuard,
  creditStatusUpdateGuard,
  onBack,
  onOpenLateFeeRate,
  onOpenStatus,
  onExportCreditExcel,
  onOpenSchedule,
}: CreditDetailHeaderProps) {
  const toolbarLeading: React.ReactNode[] = [];
  const toolbarTrailing: React.ReactNode[] = [];

  toolbarLeading.push(
    <QuickGuideButton
      key="guide"
      guideKey="credit-details"
      guideContext={{ loanId }}
      appearance="plain"
    />,
  );

  if (canAccessBackofficeActions && lateFeeUpdateGuard.visible) {
    toolbarLeading.push(
      <HeaderToolbarButton
        key="late-fee"
        onClick={onOpenLateFeeRate}
        disabled={!lateFeeUpdateGuard.executable}
        title={lateFeeUpdateGuard.executable ? tTerm('creditDetails.header.lateFeeTitle') : lateFeeUpdateGuard.reason}
        icon={<Percent size={16} />}
      >
        {tTerm('creditDetails.header.lateFee')}
      </HeaderToolbarButton>,
    );
  }

  if (canAccessBackofficeActions && creditStatusUpdateGuard.visible) {
    toolbarTrailing.push(
      <HeaderToolbarButton
        key="status"
        onClick={onOpenStatus}
        disabled={!creditStatusUpdateGuard.executable}
        title={creditStatusUpdateGuard.executable ? tTerm('creditDetails.header.statusTitle') : creditStatusUpdateGuard.reason}
        icon={<Edit2 size={16} />}
      >
        {tTerm('creditDetails.header.status')}
      </HeaderToolbarButton>,
    );
  }

  if (canExportCreditExcel) {
    toolbarTrailing.push(
      <HeaderToolbarButton
        key="excel"
        onClick={onExportCreditExcel}
        disabled={isExportingCreditExcel}
        isLoading={isExportingCreditExcel}
        title={tTerm('creditDetails.header.excelTitle')}
        icon={<FileSpreadsheet size={16} />}
      >
        {tTerm('creditDetails.header.excel')}
      </HeaderToolbarButton>,
    );
  }

  toolbarTrailing.push(
    <HeaderToolbarButton
      key="schedule"
      onClick={onOpenSchedule}
      title={tTerm('creditDetails.header.scheduleTitle')}
      icon={<Table size={16} />}
    >
      {tTerm('creditDetails.header.schedule')}
    </HeaderToolbarButton>,
  );

  return (
    <section className="credit-detail-header" data-tour="credit-detail-header">
      <div className="credit-detail-header__top">
        <div className="credit-detail-header__title-block min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <IconActionButton
              onClick={onBack}
              label={tTerm('creditDetails.header.back')}
              icon={<ArrowLeft size={20} />}
              className="shrink-0"
            />
            <h1 className="min-w-0 text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-3xl">
              {tTerm('creditDetails.header.title', { id: loanId })}
            </h1>
            <StatusChip size="sm" className={`shrink-0 uppercase tracking-[0.12em] ${statusInfo.className}`}>
              {statusInfo.label}
            </StatusChip>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-text-secondary">
            {subtitle}
          </p>
        </div>

        <nav
          className="credit-detail-header-toolbar"
          aria-label={tTerm('creditDetails.header.utilitiesAria')}
          data-tour="credit-detail-primary-actions"
        >
          {toolbarLeading}
          {toolbarLeading.length > 0 && toolbarTrailing.length > 0 ? (
            <span className="credit-detail-header-toolbar__divider" aria-hidden="true" />
          ) : null}
          {toolbarTrailing}
        </nav>
      </div>

      <div className="credit-detail-header-meta">
        <HeaderMetaBlock icon={FileText} label={tTerm('creditDetails.header.customer')} value={customerLabel} />
      </div>
    </section>
  );
}
