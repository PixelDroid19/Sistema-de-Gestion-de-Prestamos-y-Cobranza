import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuditLogPage from '../AuditLogPage';

const clearLive = vi.fn();

vi.mock('../../services/auditService', () => ({
  useAuditLogs: () => ({
    logs: [],
    pagination: undefined,
    isLoading: false,
  }),
  useAuditStats: () => ({
    stats: [],
    isLoading: false,
  }),
}));

vi.mock('../../services/useAuditStream', () => ({
  useAuditStream: ({ enabled }: { enabled?: boolean } = {}) => ({
    events: enabled
      ? [{
        eventType: 'credit.created',
        category: 'BUSINESS',
        severity: 'INFO',
        timestamp: '2026-05-30T12:00:00.000Z',
        userId: 44,
      }]
      : [],
    connected: true,
    error: null,
    clear: clearLive,
  }),
}));

describe('AuditLogPage behavior', () => {
  it('keeps header actions wrappable on narrow screens', () => {
    render(<AuditLogPage />);

    const liveToggle = screen.getByRole('button', { name: 'Activar tiempo real' });
    const actions = liveToggle.closest('[data-tour="audit-header-actions"]');

    expect(actions).toHaveClass('flex-wrap');
    expect(actions).toHaveClass('whitespace-normal');
  });

  it('does not expose raw user ids in the live events panel', () => {
    render(<AuditLogPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar tiempo real' }));

    expect(screen.getByText('Crédito creado')).toBeInTheDocument();
    expect(screen.getByText('Usuario registrado')).toBeInTheDocument();
    expect(screen.queryByText('Usuario #44')).not.toBeInTheDocument();
  });
});
