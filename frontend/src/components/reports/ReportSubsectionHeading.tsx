type ReportSubsectionHeadingProps = {
  title: string;
  subtitle?: string;
};

/** Secondary section title inside a report tab (e.g. daily cash flow block). */
export function ReportSubsectionHeading({ title, subtitle }: ReportSubsectionHeadingProps) {
  return (
    <div className="report-subsection-heading">
      <h3 className="report-subsection-heading__title">{title}</h3>
      {subtitle ? <p className="report-subsection-heading__subtitle">{subtitle}</p> : null}
    </div>
  );
}
