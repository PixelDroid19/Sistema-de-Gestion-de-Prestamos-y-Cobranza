import React from 'react';
import { useTranslation } from 'react-i18next';

import Agents from '@/components/agents/AgentsSelect';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PaginationControls from '@/components/ui/PaginationControls';
import StatePanel from '@/components/ui/StatePanel';
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
  const renderContent = () => {
    if (loansQuery.isLoading) {
      return (
          <StatePanel
            icon="⏳"
            title={t('loans.portfolio.loadingTitle')}
            message={t('loans.portfolio.loadingMessage')}
            loadingState
          />
      );
    }

    if (loansQuery.error) {
      return (
          <StatePanel
            icon="⚠️"
            title={t('loans.portfolio.errorTitle')}
            message={error || t('loans.portfolio.errorMessage')}
            action={<Button onClick={onRefetch}>{t('common.actions.tryAgain')}</Button>}
          />
      );
    }

    if (!loans.length) {
      return (
          <StatePanel
            icon={user.role === 'customer' ? '📄' : '🔍'}
            title={user.role === 'customer' ? t('loans.portfolio.customerEmptyTitle') : t('loans.portfolio.emptyTitle')}
            message={user.role === 'customer'
              ? t('loans.portfolio.customerEmptyMessage')
              : t('loans.portfolio.emptyMessage')}
          />
      );
    }

    return (
      <div className="dashboard-page-stack section-stack--compact">
        <PaginationControls pagination={pagination} isPending={loansQuery.isFetching} onPageChange={onPageChange} />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('loans.portfolio.headers.loanId')}</th>
                {(user.role === 'admin' || user.role === 'agent') && <th>{t('loans.portfolio.headers.customer')}</th>}
                <th className="table-cell-right">{t('loans.portfolio.headers.amount')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.interest')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.term')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.status')}</th>
                {(user.role === 'admin' || user.role === 'agent') && <th className="table-cell-center">{t('loans.portfolio.headers.agent')}</th>}
                <th className="table-cell-center">{t('loans.portfolio.headers.recovery')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.progress')}</th>
                <th className="table-cell-right">{t('loans.portfolio.headers.balance')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.servicing')}</th>
                <th className="table-cell-center">{t('loans.portfolio.headers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {[...loans]
               .sort((left, right) => {
                if (left.status === 'rejected' && right.status !== 'rejected') return 1;
                if (left.status !== 'rejected' && right.status === 'rejected') return -1;
                return Number(right.id) - Number(left.id);
              })
              .map((loan) => {
                const loanDetails = getLoanDetails(loan, paymentsByLoan[loan.id] || []);
                const customerId = Number(loan.customerId || loan.Customer?.id);
                const customerDocuments = customerId ? customerDocumentsByCustomer[customerId] || [] : [];
                const promises = promisesByLoan[loan.id] || [];
                const alerts = alertsByLoan[loan.id] || [];
                const attachments = attachmentsByLoan[loan.id] || [];
                const canDecision = user.role === 'admin' || (user.role === 'agent' && Number(loan.agentId) === Number(user.id));
                const canDelete = loan.status === 'rejected' && (user.role === 'admin' || user.role === 'customer' || user.role === 'agent');

                return (
                  <tr key={loan.id}>
                    <td><span className="table-id-pill">#{loan.id}</span></td>
                    {(user.role === 'admin' || user.role === 'agent') && <td>{loan.Customer?.name || '-'}</td>}
                    <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                    <td className="table-cell-center">{Number(loan.interestRate || 0).toFixed(1)}%</td>
                    <td className="table-cell-center">{loan.termMonths}m</td>
                    <td className="table-cell-center">
                      <Badge variant={LOAN_STATUS_TONE_MAP[loan.status] || 'neutral'}>
                        {formatLoanStatus(loan.status)}
                      </Badge>
                    </td>
                    {(user.role === 'admin' || user.role === 'agent') && (
                      <td className="table-cell-center">
                        <AgentAssignmentCell
                          loan={loan}
                          role={user.role}
                          assignAgentId={assignAgentId}
                          assignAgentPending={assignAgentPending}
                          pendingAssignAgents={pendingAssignAgents}
                          onSelectAgent={onSelectAgent}
                          onAssignAgent={onAssignAgent}
                        />
                      </td>
                    )}
                    <td className="table-cell-center">
                      <Badge variant={RECOVERY_STATUS_TONE_MAP[loan.recoveryStatus] || 'neutral'}>
                        {formatRecoveryStatus(loan.recoveryStatus)}
                      </Badge>
                    </td>
                    <td className="table-cell-center">
                      <ProgressPill loan={loan} payments={paymentsByLoan[loan.id] || []} />
                    </td>
                    <td className="table-cell-right">
                      {loanDetails.balance === '0.00'
                        ? <Badge variant="success">{t('loans.portfolio.fullyPaid')}</Badge>
                        : formatCurrency(loanDetails.balance)}
                    </td>
                    <td className="table-cell-center">
                      <div className="table-inline-stack table-inline-stack--stretch">
                        {(user.role === 'admin' || user.role === 'agent') && <span className="status-note">{t('loans.portfolio.alerts', { count: alerts.filter((alert) => alert.status === 'active').length })}</span>}
                        {(user.role === 'admin' || user.role === 'agent') && <span className="status-note">{t('loans.portfolio.promises', { count: promises.length })}</span>}
                        <span className="status-note">{t('loans.portfolio.attachments', { count: attachments.length })}</span>
                        {customerId ? <span className="status-note">{t('loans.portfolio.customerDocs', { count: customerDocuments.length })}</span> : null}
                      </div>
                    </td>
                    <td className="table-cell-center">
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
                        {(user.role === 'admin' || user.role === 'agent') && (
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
                    </td>
                  </tr>
                );
               })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <section className="surface-card">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">{t('loans.portfolio.eyebrow')}</div>
          <div className="section-title">
            {user.role === 'agent' ? t('loans.portfolio.agentTitle') : user.role === 'admin' ? t('loans.portfolio.adminTitle') : t('loans.portfolio.customerTitle')}
          </div>
          <div className="section-subtitle">
            {t('loans.portfolio.subtitle')}
          </div>
        </div>
      </div>
      <div className="surface-card__body">{renderContent()}</div>
    </section>
  );
}

export default LoansPortfolioSection;
