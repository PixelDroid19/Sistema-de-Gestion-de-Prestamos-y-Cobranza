import { useState } from 'react';
import type { ComponentProps } from 'react';
import ReportMetricsDetailModal, { ReportMetricsMoreTrigger } from './ReportMetricsDetailModal';
import { InsightStrip } from '../shared/Surfaces';

type InsightStripItem = ComponentProps<typeof InsightStrip>['items'][number];

type ReportMetricsSectionProps = {
  primaryItems: InsightStripItem[];
  secondaryItems?: InsightStripItem[];
  primaryAriaLabel: string;
  secondaryAriaLabel?: string;
  detailModalTitle?: string;
  detailModalSubtitle?: string;
  /** @deprecated Secondary metrics open in a modal; inline expand is no longer used */
  defaultSecondaryOpen?: boolean;
};

export function ReportMetricsSection({
  primaryItems,
  secondaryItems,
  primaryAriaLabel,
  secondaryAriaLabel,
  detailModalTitle,
  detailModalSubtitle,
}: ReportMetricsSectionProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const hasSecondary = Boolean(secondaryItems && secondaryItems.length > 0);

  return (
    <div className="report-metrics-section">
      <div className="report-metrics-section__panel">
        <InsightStrip
          aria-label={primaryAriaLabel}
          items={primaryItems}
          className="report-metrics-section__strip"
        />
        {hasSecondary ? (
          <div className="report-metrics-section__footer">
            <ReportMetricsMoreTrigger
              count={secondaryItems!.length}
              onClick={() => setDetailOpen(true)}
              fullWidth
            />
          </div>
        ) : null}
      </div>

      {detailOpen && hasSecondary ? (
        <ReportMetricsDetailModal
          onClose={() => setDetailOpen(false)}
          title={detailModalTitle}
          subtitle={detailModalSubtitle}
          ariaLabel={secondaryAriaLabel || primaryAriaLabel}
          items={secondaryItems!}
        />
      ) : null}
    </div>
  );
}
