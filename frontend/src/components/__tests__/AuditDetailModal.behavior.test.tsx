import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditDetailModal from '../AuditDetailModal';
import type { AuditLog } from '../../services/auditService';

const buildAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'audit-1',
  userId: 7,
  userName: 'Ana Operadora',
  action: 'UPDATE',
  module: 'credits',
  entityId: null,
  entityType: 'Loan',
  previousData: null,
  newData: null,
  metadata: null,
  ip: '190.12.44.10',
  userAgent: 'vitest',
  timestamp: '2026-05-30T12:00:00.000Z',
  ...overrides,
});

describe('AuditDetailModal behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses operational labels for audit trace identifiers', () => {
    render(<AuditDetailModal auditLog={buildAuditLog()} onClose={vi.fn()} />);

    expect(screen.getByText('Número de usuario')).toBeInTheDocument();
    expect(screen.getByText('Número de entidad')).toBeInTheDocument();
    expect(screen.getByText('Sin número')).toBeInTheDocument();
    expect(screen.queryByText('ID usuario')).not.toBeInTheDocument();
    expect(screen.queryByText('ID entidad')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin ID')).not.toBeInTheDocument();
  });

  it('uses translated labels for the audit detail summary', () => {
    localStorage.setItem('app.locale', 'en');

    render(<AuditDetailModal auditLog={buildAuditLog()} onClose={vi.fn()} />);

    expect(screen.getByText('Operation detail')).toBeInTheDocument();
    expect(screen.getByText('Auditable event')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Source IP')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getByText('Entity')).toBeInTheDocument();
    expect(screen.getByText('HTTP method')).toBeInTheDocument();
    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByText('Detalle de operación')).not.toBeInTheDocument();
  });

  it('closes with Escape through the shared modal shell', () => {
    const onClose = vi.fn();

    render(<AuditDetailModal auditLog={buildAuditLog()} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Detalle de operación' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
