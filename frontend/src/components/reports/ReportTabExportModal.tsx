import { useId, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, FormField, ModalShell, SelectInput, TextInput } from '../shared/Surfaces';
import type { ReportExportFormat } from './reportsExportHelpers';

type ReportTabExportModalProps = {
  onClose: () => void;
  title: string;
  subtitle?: string;
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

export function ReportTabExportTrigger({
  onClick,
  disabled,
  disabledTitle,
}: {
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <ActionButton
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      title={disabledTitle}
      icon={<Download size={16} />}
    >
      {tTerm('reports.cta.export')}
    </ActionButton>
  );
}

export default function ReportTabExportModal({
  onClose,
  title,
  subtitle,
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
}: ReportTabExportModalProps) {
  const formId = useId();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || isExporting) {
      return;
    }

    const success = await onExport();
    if (success) {
      onClose();
    }
  };

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-md"
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
            disabled={disabled || isExporting}
            title={disabledTitle}
            icon={<Download size={16} />}
            className="flex-1 sm:flex-none"
          >
            {isExporting ? tTerm('credits.cta.exporting') : exportLabel}
          </ActionButton>
        </>
      )}
    >
      <form id={formId} className="reports-tab-export-modal" onSubmit={(event) => { void handleSubmit(event); }}>
        {summary ? (
          <p className="reports-tab-export-modal__summary">{summary}</p>
        ) : null}

        {showRangeFields && range && onRangeChange ? (
          <div className="reports-tab-export-modal__range">
            <FormField label={tTerm('reports.export.from')}>
              <TextInput
                type="date"
                value={range.fromDate}
                onChange={(event) => onRangeChange('fromDate', event.target.value)}
              />
            </FormField>
            <FormField label={tTerm('reports.export.to')}>
              <TextInput
                type="date"
                value={range.toDate}
                onChange={(event) => onRangeChange('toDate', event.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {showFormat && (
          <FormField label={tTerm('reports.export.format')}>
            <SelectInput
              value={format}
              onChange={(event) => onFormatChange(event.target.value as ReportExportFormat)}
            >
              <option value="xlsx">{tTerm('reports.export.format.xlsx')}</option>
              <option value="pdf">{tTerm('reports.export.format.pdf')}</option>
            </SelectInput>
          </FormField>
        )}
      </form>
    </ModalShell>
  );
}

export function useReportTabExportModal() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openModal: () => setOpen(true),
    closeModal: () => setOpen(false),
  };
}
