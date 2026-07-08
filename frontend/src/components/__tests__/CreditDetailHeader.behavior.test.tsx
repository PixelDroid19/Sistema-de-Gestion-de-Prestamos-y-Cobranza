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
        canAccessBackofficeActions
        canExportCreditExcel
        isExportingCreditExcel={false}
        lateFeeUpdateGuard={executableGuard}
        creditStatusUpdateGuard={executableGuard}
        onBack={vi.fn()}
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
