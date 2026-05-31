import { BarChart3 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { tTerm } from '../../i18n/terminology';
import { ActionButton, InsightStrip, ModalShell } from '../shared/Surfaces';

type InsightStripItem = ComponentProps<typeof InsightStrip>['items'][number];

type ReportMetricsDetailModalProps = {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel: string;
  items: InsightStripItem[];
};

export default function ReportMetricsDetailModal({
  onClose,
  title,
  subtitle,
  ariaLabel,
  items,
}: ReportMetricsDetailModalProps) {
  return (
    <ModalShell
      title={title || tTerm('reports.metrics.modal.title')}
      subtitle={subtitle || tTerm('reports.metrics.modal.subtitle')}
      maxWidthClassName="max-w-4xl"
      onClose={onClose}
      footer={(
        <ActionButton type="button" variant="primary" onClick={onClose} fullWidth>
          {tTerm('common.cta.close')}
        </ActionButton>
      )}
    >
      <InsightStrip
        aria-label={ariaLabel}
        items={items}
        className="insight-strip--modal-grid"
      />
    </ModalShell>
  );
}

export function ReportMetricsMoreTrigger({
  count,
  onClick,
  fullWidth = false,
}: {
  count: number;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  const label = count > 0
    ? tTerm('reports.tab.metrics.toggle.showWithCount', { count })
    : tTerm('reports.tab.metrics.toggle.show');

  return (
    <ActionButton
      type="button"
      variant="ghost"
      onClick={onClick}
      fullWidth={fullWidth}
      className={fullWidth ? 'report-metrics-section__more-btn' : undefined}
      icon={<BarChart3 size={16} />}
    >
      {label}
    </ActionButton>
  );
}
