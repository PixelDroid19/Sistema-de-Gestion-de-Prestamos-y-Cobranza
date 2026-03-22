import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Agents from '@/components/agents/AgentsSelect';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PaginationControls from '@/components/ui/PaginationControls';
import StatePanel from '@/components/ui/StatePanel';
import DataTable from '@/components/ui/workspace/DataTable';
import EmptyState from '@/components/ui/workspace/EmptyState';
import FilterBar from '@/components/ui/workspace/FilterBar';
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard';
import {
  LOAN_STATUS_TONE_MAP,
  RECOVERY_STATUS_TONE_MAP,
} from '@/features/loans/loansWorkspace.constants';
import {
  formatCurrency,
  formatLoanStatus,
  formatRecoveryStatus,
  getLoanDetails,
} from '@/features/loans/loansWorkspace.utils';

const RECOVERY_EDIT_STATUSES = ['pending', 'assigned', 'in_progress', 'contacted', 'negotiated', 'recovered', 'failed'];

const INTERNAL_ROLES = new Set(['admin', 'agent'])

function isInternalRole(role) {
  return INTERNAL_ROLES.has(role)
}

function sortPortfolioRows(loans) {
  return [...loans].sort((left, right) => {
    if (left.status === 'rejected' && right.status !== 'rejected') return 1
    if (left.status !== 'rejected' && right.status === 'rejected') return -1
    return Number(right.id) - Number(left.id)
  })
}

function getServicingCounts(loan, customerDocumentsByCustomer, promisesByLoan, alertsByLoan, attachmentsByLoan) {
  const customerId = Number(loan.customerId || loan.Customer?.id)
  const customerDocuments = customerId ? customerDocumentsByCustomer[customerId] || [] : []
  const promises = promisesByLoan[loan.id] || []
  const alerts = alertsByLoan[loan.id] || []
  const attachments = attachmentsByLoan[loan.id] || []

  return {
    customerId,
    customerDocumentsCount: customerDocuments.length,
    promiseCount: promises.length,
    activeAlertCount: alerts.filter((alert) => alert.status === 'active').length,
    attachmentCount: attachments.length,
  }
}

const formatRecoveryOptionLabel = (status) => {
  const translatedLabel = formatRecoveryStatus(status);
  if (translatedLabel && translatedLabel !== status) {
    return translatedLabel;
  }

  return String(status || '')
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

function ProgressPill({ loan, payments }) {
  const totalInstallments = Number(loan.termMonths || 0);
  const financialSnapshot = loan.financialSnapshot || {};
  const outstandingInstallments = Number(financialSnapshot.outstandingInstallments);
  const completion = totalInstallments > 0
    ? Number.isFinite(outstandingInstallments)
      ? ((totalInstallments - outstandingInstallments) / totalInstallments) * 100
      : ((payments.length) / totalInstallments) * 100
    : 0;
  const completedInstallments = totalInstallments > 0
    ? Number.isFinite(outstandingInstallments)
      ? Math.max(totalInstallments - outstandingInstallments, 0)
      : payments.length
    : 0;

  return (
    <div className="progress-pill">
      <span className="progress-pill__text">{completedInstallments}/{loan.termMonths}</span>
      <div className="progress-track">
        <div
          className={`progress-track__fill${completion < 50 ? ' progress-track__fill--danger' : ''}`}
          style={{ width: `${Math.min(completion, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

function AgentAssignmentCell({
  loan,
  role,
  assignAgentId,
  assignAgentPending,
  pendingAssignAgents,
  onSelectAgent,
  onAssignAgent,
}) {
  const { t } = useTranslation()
  return (
    <div className="table-inline-stack">
      <div>{loan.Agent?.name || '-'}</div>
      {role === 'admin' && loan.status === 'approved' && !loan.Agent && (
        <div className="table-inline-stack">
          <Agents onSelect={(agentId) => onSelectAgent(loan.id, agentId)} />
            <Button
              size="sm"
              disabled={!assignAgentId[loan.id] || assignAgentPending || pendingAssignAgents[loan.id]}
              onClick={() => onAssignAgent(loan.id)}
            >
              {pendingAssignAgents[loan.id] ? t('loans.portfolio.assigning') : t('loans.portfolio.assignAgent')}
            </Button>
        </div>
      )}
    </div>
  );
}

function RecoveryEditorCell({
  loan,
  user,
  editingRecovery,
  recoveryDrafts,
  pendingRecovery,
  updateRecoveryPending,
  onStartEditing,
  onRecoveryDraftChange,
  onSaveRecovery,
}) {
  const { t } = useTranslation()
  const loanId = Number(loan.id);
  const assignedAgentId = Number(loan.agentId || loan.Agent?.id || 0)
  const canEditAssignedLoan = user.role === 'admin' || (user.role === 'agent' && assignedAgentId === Number(user.id));
  const canEdit = canEditAssignedLoan && loan.status === 'defaulted';

  if (!canEdit) {
    return <span className="status-note">{t('loans.portfolio.noAction')}</span>;
  }

  if (editingRecovery[loanId]) {
    return (
      <div className="action-stack">
        <select
          className="form-control"
          data-testid={`loan-${loanId}-recovery-status`}
          value={recoveryDrafts[loanId] || loan.recoveryStatus || 'pending'}
          onChange={(event) => onRecoveryDraftChange(loanId, event.target.value)}
        >
          <option value="">{t('loans.portfolio.selectStatus')}</option>
          {RECOVERY_EDIT_STATUSES.map((status) => (
            <option key={status} value={status}>{formatRecoveryOptionLabel(status)}</option>
          ))}
        </select>
        <Button
          data-testid={`loan-${loanId}-save-recovery`}
          variant="success"
          size="sm"
          disabled={!recoveryDrafts[loanId] || updateRecoveryPending || pendingRecovery[loanId]}
          onClick={() => onSaveRecovery(loanId)}
        >
          {pendingRecovery[loanId] ? t('loans.portfolio.saving') : t('loans.portfolio.saveStatus')}
        </Button>
      </div>
    );
  }

  return (
    <Button data-testid={`loan-${loanId}-edit-recovery`} variant="outline" size="sm" onClick={() => onStartEditing(loan)}>
      {t('loans.portfolio.editRecovery')}
    </Button>
  );
}

function LoansPortfolioSection({
  user,
  loansQuery,
  loans,
  error,
  paymentsByLoan,
  alertsByLoan,
  promisesByLoan,
  attachmentsByLoan,
  customerDocumentsByCustomer,
  assignAgentId,
  pendingStatusLoans,
  pendingAssignAgents,
  pendingRecovery,
  pendingDeleteLoans,
  editingRecovery,
  recoveryDrafts,
  updateLoanStatusPending,
  assignAgentPending,
  updateRecoveryPending,
  deleteLoanPending,
  pagination,
  onPageChange,
  onRefetch,
  onSelectAgent,
  onAssignAgent,
  onStartEditingRecovery,
  onRecoveryDraftChange,
  onSaveRecovery,
  onUpdateLoanStatus,
  onDeleteLoan,
}) {
  const { t } = useTranslation()
  const isCustomer = user.role === 'customer'
  const canViewInternalColumns = isInternalRole(user.role)

  const portfolioRows = useMemo(() => sortPortfolioRows(loans), [loans])

  const portfolioColumns = useMemo(() => [
      {
        key: 'loanId',
        header: t('loans.portfolio.headers.loanId'),
        render: (loan) => <span className="table-id-pill">#{loan.id}</span>,
      },
      canViewInternalColumns && {
        key: 'customer',
        header: t('loans.portfolio.headers.customer'),
        render: (loan) => loan.Customer?.name || '-',
      },
      {
        key: 'amount',
        header: t('loans.portfolio.headers.amount'),
        cellClassName: 'table-cell-right',
        render: (loan) => formatCurrency(loan.amount),
      },
      {
        key: 'interest',
        header: t('loans.portfolio.headers.interest'),
        cellClassName: 'table-cell-center',
        render: (loan) => `${Number(loan.interestRate || 0).toFixed(1)}%`,
      },
      {
        key: 'term',
        header: t('loans.portfolio.headers.term'),
        cellClassName: 'table-cell-center',
        render: (loan) => `${loan.termMonths}m`,
      },
      {
        key: 'status',
        header: t('loans.portfolio.headers.status'),
        cellClassName: 'table-cell-center',
        render: (loan) => (
          <Badge variant={LOAN_STATUS_TONE_MAP[loan.status] || 'neutral'}>
            {formatLoanStatus(loan.status)}
          </Badge>
        ),
      },
      canViewInternalColumns && {
        key: 'agent',
        header: t('loans.portfolio.headers.agent'),
        cellClassName: 'table-cell-center',
        render: (loan) => (
          <AgentAssignmentCell
            loan={loan}
            role={user.role}
            assignAgentId={assignAgentId}
            assignAgentPending={assignAgentPending}
            pendingAssignAgents={pendingAssignAgents}
            onSelectAgent={onSelectAgent}
            onAssignAgent={onAssignAgent}
          />
        ),
      },
      {
        key: 'recovery',
        header: t('loans.portfolio.headers.recovery'),
        cellClassName: 'table-cell-center',
        render: (loan) => (
          <Badge variant={RECOVERY_STATUS_TONE_MAP[loan.recoveryStatus] || 'neutral'}>
            {formatRecoveryStatus(loan.recoveryStatus)}
          </Badge>
        ),
      },
      {
        key: 'progress',
        header: t('loans.portfolio.headers.progress'),
        cellClassName: 'table-cell-center',
        render: (loan) => <ProgressPill loan={loan} payments={paymentsByLoan[loan.id] || []} />,
      },
      {
        key: 'balance',
        header: t('loans.portfolio.headers.balance'),
        cellClassName: 'table-cell-right',
        render: (loan) => {
          const loanDetails = getLoanDetails(loan, paymentsByLoan[loan.id] || [])

          return loanDetails.balance === '0.00'
            ? <Badge variant="success">{t('loans.portfolio.fullyPaid')}</Badge>
            : formatCurrency(loanDetails.balance)
        },
      },
      {
        key: 'servicing',
        header: t('loans.portfolio.headers.servicing'),
        cellClassName: 'table-cell-center',
        render: (loan) => {
          const counts = getServicingCounts(
            loan,
            customerDocumentsByCustomer,
            promisesByLoan,
            alertsByLoan,
            attachmentsByLoan,
          )

          return (
            <div className="table-inline-stack table-inline-stack--stretch">
              {canViewInternalColumns && <span className="status-note">{t('loans.portfolio.alerts', { count: counts.activeAlertCount })}</span>}
              {canViewInternalColumns && <span className="status-note">{t('loans.portfolio.promises', { count: counts.promiseCount })}</span>}
              <span className="status-note">{t('loans.portfolio.attachments', { count: counts.attachmentCount })}</span>
              {counts.customerId ? <span className="status-note">{t('loans.portfolio.customerDocs', { count: counts.customerDocumentsCount })}</span> : null}
            </div>
          )
        },
      },
      {
        key: 'actions',
        header: t('loans.portfolio.headers.actions'),
        cellClassName: 'table-cell-center',
        render: (loan) => {
          const canDecision = user.role === 'admin' || (user.role === 'agent' && Number(loan.agentId) === Number(user.id))
          const canDelete = loan.status === 'rejected' && (user.role === 'admin' || user.role === 'customer' || user.role === 'agent')

          return (
            <div className="action-stack">
              {loan.status === 'pending' && canDecision && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={pendingStatusLoans[loan.id] || updateLoanStatusPending}
                    onClick={() => onUpdateLoanStatus(loan.id, 'approved')}
                  >
                    {pendingStatusLoans[loan.id] ? t('loans.portfolio.processing') : t('loans.portfolio.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pendingStatusLoans[loan.id] || updateLoanStatusPending}
                    onClick={() => onUpdateLoanStatus(loan.id, 'rejected')}
                  >
                    {pendingStatusLoans[loan.id] ? t('loans.portfolio.processing') : t('loans.portfolio.reject')}
                  </Button>
                </>
              )}
              {canViewInternalColumns && (
                <RecoveryEditorCell
                  loan={loan}
                  user={user}
                  editingRecovery={editingRecovery}
                  recoveryDrafts={recoveryDrafts}
                  pendingRecovery={pendingRecovery}
                  updateRecoveryPending={updateRecoveryPending}
                  onStartEditing={onStartEditingRecovery}
                  onRecoveryDraftChange={onRecoveryDraftChange}
                  onSaveRecovery={onSaveRecovery}
                />
              )}
              {canDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pendingDeleteLoans[loan.id] || deleteLoanPending}
                  onClick={() => onDeleteLoan(loan.id)}
                >
                  {pendingDeleteLoans[loan.id] ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          )
        },
      },
    ].filter(Boolean), [
      alertsByLoan,
      assignAgentId,
      assignAgentPending,
      attachmentsByLoan,
      canViewInternalColumns,
      customerDocumentsByCustomer,
      deleteLoanPending,
      editingRecovery,
      onAssignAgent,
      onDeleteLoan,
      onRecoveryDraftChange,
      onSaveRecovery,
      onSelectAgent,
      onStartEditingRecovery,
      onUpdateLoanStatus,
      paymentsByLoan,
      pendingAssignAgents,
      pendingDeleteLoans,
      pendingRecovery,
      pendingStatusLoans,
      promisesByLoan,
      recoveryDrafts,
      t,
      updateLoanStatusPending,
      updateRecoveryPending,
      user,
    ])

  let content = (
    <StatePanel
      icon={isCustomer ? '📄' : '🔍'}
      title={isCustomer ? t('loans.portfolio.customerEmptyTitle') : t('loans.portfolio.emptyTitle')}
      message={isCustomer ? t('loans.portfolio.customerEmptyMessage') : t('loans.portfolio.emptyMessage')}
    />
  )

  if (loansQuery.isLoading) {
    content = (
      <StatePanel
        icon="⏳"
        title={t('loans.portfolio.loadingTitle')}
        message={t('loans.portfolio.loadingMessage')}
        loadingState
      />
    )
  } else if (loansQuery.error) {
    content = (
      <StatePanel
        icon="⚠️"
        title={t('loans.portfolio.errorTitle')}
        message={error || t('loans.portfolio.errorMessage')}
        action={<Button onClick={onRefetch}>{t('common.actions.tryAgain')}</Button>}
      />
    )
  } else if (loans.length) {
    content = (
      <div className="dashboard-page-stack section-stack--compact">
        <FilterBar>
          <PaginationControls pagination={pagination} isPending={loansQuery.isFetching} onPageChange={onPageChange} />
        </FilterBar>
        <DataTable
          columns={portfolioColumns}
          rows={portfolioRows}
          rowKey="id"
          emptyState={(
            <EmptyState
              icon={isCustomer ? '📄' : '🔍'}
              title={isCustomer ? t('loans.portfolio.customerEmptyTitle') : t('loans.portfolio.emptyTitle')}
              description={isCustomer ? t('loans.portfolio.customerEmptyMessage') : t('loans.portfolio.emptyMessage')}
            />
          )}
        />
      </div>
    )
  }

  return (
    <WorkspaceCard
      className="surface-card"
      eyebrow={t('loans.portfolio.eyebrow')}
      title={user.role === 'agent' ? t('loans.portfolio.agentTitle') : user.role === 'admin' ? t('loans.portfolio.adminTitle') : t('loans.portfolio.customerTitle')}
      subtitle={t('loans.portfolio.subtitle')}
    >
      {content}
    </WorkspaceCard>
  )
}

export default LoansPortfolioSection;
