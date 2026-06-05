import { useId, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, ModalShell } from '../shared/Surfaces';
import ReportsExportForm, { type ReportsExportFormProps } from './ReportsExportForm';
import type { ReportExportType } from './reportsExportHelpers';

type ReportsContextualExportModalProps = ReportsExportFormProps & {
  onClose: () => void;
  isExporting: boolean;
  exportExecutable: boolean;
  exportDisabledReason?: string;
  onExport: () => boolean | Promise<boolean>;
};

const getContextualExportLabel = (type: ReportExportType) => {
  if (type === 'credits') return tTerm('reports.cta.exportCredits');
  if (type === 'profitability') return tTerm('reports.cta.exportProfitability');
  return tTerm('reports.cta.exportPayouts');
};

export default function ReportsContextualExportModal({
  onClose,
  isExporting,
  exportExecutable,
  exportDisabledReason,
  onExport,
  reportType,
  hasInvalidRange,
  hasInvalidReportCustomerId,
  hasInvalidReportLoanId,
  ...formProps
}: ReportsContextualExportModalProps) {
  const formId = useId();

  const exportBlocked = isExporting
    || hasInvalidRange
    || hasInvalidReportCustomerId
    || hasInvalidReportLoanId
    || !exportExecutable;

  const exportTitle = hasInvalidRange
    ? tTerm('reports.export.invalidRange')
    : hasInvalidReportCustomerId
      ? tTerm('reports.export.invalidCustomer')
      : hasInvalidReportLoanId
        ? tTerm('reports.export.invalidLoan')
        : (exportExecutable ? getContextualExportLabel(reportType) : (exportDisabledReason || tTerm('credits.action.unavailable')));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!exportBlocked) {
      void onExport();
    }
  };

  return (
    <ModalShell
      title={tTerm('reports.export.modal.title')}
      subtitle={tTerm('reports.export.modal.subtitle')}
      maxWidthClassName="max-w-2xl"
      onClose={onClose}
      footer={(
        <>
          <ActionButton type="button" variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
            {tTerm('common.cta.cancel')}
          </ActionButton>
          <ActionButton
            type="submit"
            form={formId}
            variant="primary"
            disabled={exportBlocked}
            title={exportTitle}
            icon={<Download size={16} />}
            className="flex-1 sm:flex-none"
          >
            {isExporting ? tTerm('credits.cta.exporting') : getContextualExportLabel(reportType)}
          </ActionButton>
        </>
      )}
    >
      <ReportsExportForm
        {...formProps}
        reportType={reportType}
        layout="modal"
        formId={formId}
        onSubmit={handleSubmit}
        hasInvalidRange={hasInvalidRange}
        hasInvalidReportCustomerId={hasInvalidReportCustomerId}
        hasInvalidReportLoanId={hasInvalidReportLoanId}
      />
    </ModalShell>
  );
}
