/** Column width sets for table-layout:fixed financial grids (must sum to 100%). */

export const CREDIT_CALENDAR_COLUMN_WIDTHS = {
  withActions: ['5%', '14%', '12%', '8%', '8%', '13%', '13%', '10%', '10rem'],
  withoutActions: ['5%', '18%', '12%', '9%', '9%', '14%', '14%', '15%'],
} as const;

export function renderFinancialScheduleColgroup(widths: readonly string[]) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${width}-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}
