import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, ModalShell } from '../shared/Surfaces';

type ReportDownloadFormat = 'xlsx' | 'pdf' | 'excel';

type ReportDownloadModalProps = {
  onClose: () => void;
  title: string;
  subtitle?: string;
  isExporting: boolean;
  onDownload: (format: ReportDownloadFormat) => boolean | Promise<boolean>;
  formats?: ReportDownloadFormat[];
};

type ReportDownloadControlProps = Omit<ReportDownloadModalProps, 'onClose'> & {
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
};

const formatMeta: Record<ReportDownloadFormat, { label: string; icon: typeof FileSpreadsheet }> = {
  xlsx: { label: tTerm('reports.export.format.xlsx'), icon: FileSpreadsheet },
  excel: { label: tTerm('reports.cashflow.cta.excel'), icon: FileSpreadsheet },
  pdf: { label: tTerm('reports.export.format.pdf'), icon: FileText },
};

export function ReportDownloadTrigger({
  onClick,
  disabled,
  title,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <ActionButton
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      title={title}
      icon={<Download size={16} />}
    >
      {label || tTerm('reports.cta.download')}
    </ActionButton>
  );
}

export function ReportDownloadControl({
  disabled,
  disabledReason,
  label,
  ...modalProps
}: ReportDownloadControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ReportDownloadTrigger
        onClick={() => setOpen(true)}
        disabled={disabled || modalProps.isExporting}
        title={disabled ? disabledReason : undefined}
        label={label}
      />
      {open ? (
        <ReportDownloadModal
          {...modalProps}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export default function ReportDownloadModal({
  onClose,
  title,
  subtitle,
  isExporting,
  onDownload,
  formats = ['xlsx', 'pdf'],
}: ReportDownloadModalProps) {
  const handleDownload = async (format: ReportDownloadFormat) => {
    if (isExporting) {
      return;
    }

    const success = await onDownload(format);
    if (success) {
      onClose();
    }
  };

  return (
    <ModalShell
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-sm"
      onClose={onClose}
      footer={(
        <ActionButton type="button" variant="ghost" onClick={onClose} fullWidth>
          {tTerm('common.cta.cancel')}
        </ActionButton>
      )}
    >
      <div className="reports-download-modal__options">
        {formats.map((format) => {
          const meta = formatMeta[format];
          const Icon = meta.icon;

          return (
            <ActionButton
              key={format}
              type="button"
              variant="secondary"
              fullWidth
              disabled={isExporting}
              icon={<Icon size={16} />}
              onClick={() => { void handleDownload(format); }}
            >
              {isExporting ? tTerm('credits.cta.exporting') : meta.label}
            </ActionButton>
          );
        })}
      </div>
    </ModalShell>
  );
}
