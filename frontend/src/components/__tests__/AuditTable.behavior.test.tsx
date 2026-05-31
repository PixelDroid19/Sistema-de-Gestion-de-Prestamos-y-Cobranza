import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuditTable from '../AuditTable';
import type { AuditLog } from '../../services/auditService';

const buildAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'audit-1',
  userId: 7,
  userName: 'Ana Operadora',
  action: 'UPDATE',
  module: 'credits',
  entityId: '23',
  entityType: 'Loan',
  previousData: null,
  newData: null,
  metadata: null,
  ip: '190.12.44.10',
  userAgent: 'vitest',
  timestamp: '2026-05-30T12:00:00.000Z',
  ...overrides,
});

describe('AuditTable behavior', () => {
  it('describes authenticated users without exposing internal ids in list rows', () => {
    render(
      <AuditTable
        logs={[buildAuditLog()]}
        isLoading={false}
        onViewDetails={vi.fn()}
        onPageChange={vi.fn()}
        onFilterIp={vi.fn()}
      />,
    );

    expect(screen.getByText('Ana Operadora')).toBeInTheDocument();
    expect(screen.getByText('Usuario registrado')).toBeInTheDocument();
    expect(screen.queryByText('Usuario #7')).not.toBeInTheDocument();
  });
});
