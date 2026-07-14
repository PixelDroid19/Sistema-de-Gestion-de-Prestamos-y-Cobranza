import type { ReactNode } from 'react';

type ReportValueStackTone = 'default' | 'positive' | 'negative' | 'warning';

type ReportMetaPair = {
  label: string;
  value: string;
};

type ReportValueStackProps = {
  value: string;
  meta?: ReactNode;
  tone?: ReportValueStackTone;
  strong?: boolean;
};

export function ReportMetaPairs({ pairs }: { pairs: ReportMetaPair[] }) {
  return (
    <div className="report-value-stack__meta-pairs">
      {pairs.map((pair, index) => (
        <span key={`${pair.label}-${pair.value}`} className="report-value-stack__meta-pair">
          <span className="report-value-stack__meta-label">{pair.label}</span>{' '}
          <span className="report-value-stack__meta-amount">{pair.value}</span>
          {index < pairs.length - 1 ? <span className="report-value-stack__meta-separator" aria-hidden="true"> · </span> : null}
        </span>
      ))}
    </div>
  );
}

export default function ReportValueStack({
  value,
  meta,
  tone = 'default',
  strong = false,
}: ReportValueStackProps) {
  return (
    <div className="report-value-stack">
      <p
        className={[
          'report-value-stack__value',
          strong ? 'report-value-stack__value--strong' : '',
          tone === 'positive' ? 'report-value-stack__value--positive' : '',
          tone === 'negative' ? 'report-value-stack__value--negative' : '',
          tone === 'warning' ? 'report-value-stack__value--warning' : '',
        ].filter(Boolean).join(' ')}
      >
        {value}
      </p>
      {meta ? <div className="report-value-stack__meta">{meta}</div> : null}
    </div>
  );
}
