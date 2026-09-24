import { render, screen, within } from '@testing-library/react';
import { CreditSummaryMetrics } from '../creditDetails/CreditSummaryMetrics';
import { formatCurrency } from '../../i18n/format';

it('never treats an overdue balance as an unpaid late fee in the credit summary', () => {
  render(
    <CreditSummaryMetrics
      loan={{ termMonths: 12, annualLateFeeRate: 0, totalOverdue: 500000 }}
      paymentSnapshot={{ outstandingPrincipal: 500000, totalPaid: 0, outstandingInstallments: 3 }}
      formatCurrency={formatCurrency}
      formatMetricCurrency={formatCurrency}
    />,
  );

  const summary = screen.getByLabelText('Resumen operativo del crédito');
  const lateFeeMetric = within(summary).getByText('Mora pendiente').closest('article');
  expect(lateFeeMetric).not.toBeNull();
  expect(within(lateFeeMetric!).getByTitle('COP 0')).toBeInTheDocument();
});
