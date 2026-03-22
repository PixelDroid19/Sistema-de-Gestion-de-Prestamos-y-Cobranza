import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import Notifications from '@/components/Notifications'
import { renderWithProviders } from '@tests/test/renderWithProviders'

const {
  mockUseNotificationsQuery,
  mockMarkAllNotificationsReadMutateAsync,
} = vi.hoisted(() => ({
  mockUseNotificationsQuery: vi.fn(),
  mockMarkAllNotificationsReadMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/useNotifications', () => ({
  useNotificationsQuery: (...args) => mockUseNotificationsQuery(...args),
  useMarkNotificationReadMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkAllNotificationsReadMutation: () => ({ mutateAsync: mockMarkAllNotificationsReadMutateAsync, isPending: false }),
  useClearNotificationsMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRegisterNotificationSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRegisterBrowserNotificationSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteNotificationSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('Notifications surface', () => {
  it('renders the migrated notifications center and marks all notifications as read', async () => {
    const onClose = vi.fn()

    mockUseNotificationsQuery.mockReturnValue({
      data: {
        data: {
          notifications: [
            {
              id: 11,
              message: 'Loan 22 is overdue',
              createdAt: '2026-03-20T10:30:00.000Z',
              isRead: false,
              type: 'loan_overdue',
              payload: { loanId: 22, customerName: 'Ana Cliente', loanAmount: 4800 },
            },
          ],
          unreadCount: 1,
          totalCount: 1,
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    })
    mockMarkAllNotificationsReadMutateAsync.mockResolvedValue({ data: { success: true } })

    renderWithProviders(<Notifications user={{ id: 1, role: 'admin', name: 'Ada Admin' }} isOpen onClose={onClose} />)

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(mockUseNotificationsQuery).toHaveBeenCalledWith({
      enabled: true,
      refetchInterval: 30000,
    })
    expect(screen.getByText('Loan 22 is overdue')).toBeInTheDocument()
    expect(screen.getByText('Loan #22')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))

    await waitFor(() => {
      expect(mockMarkAllNotificationsReadMutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('✅ All notifications marked as read.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
