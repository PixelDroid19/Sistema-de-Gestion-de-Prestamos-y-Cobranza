import type { ReactNode } from 'react';

type ReportsTabContentProps = {
  children: ReactNode;
};

export default function ReportsTabContent({ children }: ReportsTabContentProps) {
  return <div className="reports-tab-content">{children}</div>;
}
