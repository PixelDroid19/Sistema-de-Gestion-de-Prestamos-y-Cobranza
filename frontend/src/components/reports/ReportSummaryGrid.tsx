type ReportSummaryGridItem = {
  label: string;
  value: string;
};

type ReportSummaryGridProps = {
  items: ReportSummaryGridItem[];
  columns?: 2 | 3 | 4;
};

export default function ReportSummaryGrid({
  items,
  columns = 4,
}: ReportSummaryGridProps) {
  const visibleItems = items.filter((item) => item.value.trim().length > 0);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <dl className={`report-summary-grid report-summary-grid--cols-${columns}`}>
      {visibleItems.map((item) => (
        <div key={`${item.label}-${item.value}`} className="report-summary-grid__item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
