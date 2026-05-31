import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreditDetailHeader } from '../creditDetails/CreditDetailHeader';

const executableGuard = { visible: true, executable: true };

describe('CreditDetailHeader behavior', () => {
  it('uses an operational title instead of exposing the internal loan id', () => {
    render(
      <CreditDetailHeader
        loanId={123}
        statusInfo={{ label: 'Activo', className: 'text-green-700' }}
        subtitle="Cliente QA"
        customerLabel="Cliente QA"
        calculationProfileSummary="Regla vigente"
        registerPaymentLabel="Registrar pago"
        capitalContributionLabel="Abono a capital"
        canAccessBackofficeActions
        canExportCreditExcel
        isExportingCreditExcel={false}
        installmentPaymentGuard={executableGuard}
        capitalPaymentGuard={executableGuard}
        payoffPaymentGuard={executableGuard}
        lateFeeUpdateGuard={executableGuard}
        creditStatusUpdateGuard={executableGuard}
        onBack={vi.fn()}
        onRegisterPayment={vi.fn()}
        onOpenCapitalPayment={vi.fn()}
        onPayoff={vi.fn()}
        onOpenLateFeeRate={vi.fn()}
        onOpenStatus={vi.fn()}
        onExportCreditExcel={vi.fn()}
        onOpenSchedule={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Detalle del crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crédito #123' })).not.toBeInTheDocument();
  });
});
