import type { ReactNode } from 'react';

type ReportTabActionsBarProps = {
  children: ReactNode;
};

/** Groups primary tab actions (export, download, create) in one horizontal toolbar. */
export function ReportTabActionsBar({ children }: ReportTabActionsBarProps) {
  return <div className="report-tab-actions">{children}</div>;
}
