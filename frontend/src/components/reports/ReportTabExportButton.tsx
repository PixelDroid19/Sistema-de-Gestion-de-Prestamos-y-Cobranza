import ReportTabExportModal, { ReportTabExportTrigger, useReportTabExportModal } from './ReportTabExportModal';
import type { ReportExportFormat } from './reportsExportHelpers';

type ReportTabExportButtonProps = {
  modalTitle: string;
  modalSubtitle?: string;
  summary?: string;
  exportLabel: string;
  format: ReportExportFormat;
  onFormatChange: (format: ReportExportFormat) => void;
  showFormat?: boolean;
  showRangeFields?: boolean;
  range?: { fromDate: string; toDate: string };
  onRangeChange?: (key: 'fromDate' | 'toDate', value: string) => void;
  isExporting: boolean;
  disabled: boolean;
  disabledTitle?: string;
  onExport: () => boolean | Promise<boolean>;
};

export default function ReportTabExportButton({
  modalTitle,
  modalSubtitle,
  summary,
  exportLabel,
  format,
  onFormatChange,
  showFormat = true,
  showRangeFields = false,
  range,
  onRangeChange,
  isExporting,
  disabled,
  disabledTitle,
  onExport,
}: ReportTabExportButtonProps) {
  const { open, openModal, closeModal } = useReportTabExportModal();

  return (
    <>
      <ReportTabExportTrigger
        onClick={openModal}
        disabled={disabled && !open}
        disabledTitle={disabledTitle}
      />
      {open && (
        <ReportTabExportModal
          onClose={closeModal}
          title={modalTitle}
          subtitle={modalSubtitle}
          summary={summary}
          exportLabel={exportLabel}
          format={format}
          onFormatChange={onFormatChange}
          showFormat={showFormat}
          showRangeFields={showRangeFields}
          range={range}
          onRangeChange={onRangeChange}
          isExporting={isExporting}
          disabled={disabled}
          disabledTitle={disabledTitle}
          onExport={onExport}
        />
      )}
    </>
  );
}
