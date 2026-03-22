import React from 'react'
import { useTranslation } from 'react-i18next'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import StatePanel from '@/components/ui/StatePanel'
import { RECOVERY_TONE_MAP, REPORT_TABS } from '@/features/reports/reportsWorkspace.constants'
import { formatCurrency, formatDate, formatRecoveryStatus } from '@/features/reports/reportsWorkspace.utils'

function UsersTable({
  users,
  usersLoading,
  editingUser,
  userRoleForm,
  currentUserId,
  updateUserPending,
  deactivatePending,
  reactivatePending,
  onRoleChange,
  onStartEdit,
  onCancelEdit,
  onSaveRole,
  onDeactivate,
  onReactivate,
}) {
  const { t } = useTranslation()

  if (usersLoading) {
    return <div className="content-note">{t('reports.portfolio.loadingUsers')}</div>
  }

  if (users.length === 0) {
    return <div className="content-note">{t('reports.portfolio.noUsers')}</div>
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{t('reports.portfolio.headers.id')}</th>
          <th>{t('reports.portfolio.headers.name')}</th>
          <th>{t('reports.portfolio.headers.email')}</th>
          <th>{t('reports.portfolio.headers.role')}</th>
          <th>{t('reports.portfolio.headers.status')}</th>
          <th>{t('reports.portfolio.headers.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>#{user.id}</td>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>
              {editingUser === user.id ? (
                <select
                  className="form-control select-inline"
                  value={userRoleForm.role || user.role}
                  onChange={(event) => onRoleChange(event.target.value)}
                >
                  <option value="customer">{t('common.status.customer')}</option>
                  <option value="agent">{t('common.status.agent')}</option>
                  <option value="socio">{t('common.status.socio')}</option>
                  <option value="admin">{t('common.status.admin')}</option>
                </select>
              ) : (
                <Badge variant={user.role === 'admin' ? 'success' : user.role === 'agent' ? 'brand' : 'neutral'}>
                  {t(`common.status.${user.role}`)}
                </Badge>
              )}
            </td>
            <td>
              <Badge variant={user.isActive !== false ? 'success' : 'danger'}>
                {user.isActive !== false ? t('common.status.active') : t('common.status.inactive')}
              </Badge>
            </td>
            <td>
              <div className="inline-action-group">
                {editingUser === user.id ? (
                  <>
                    <Button variant="success" size="sm" type="button" disabled={updateUserPending} onClick={() => onSaveRole(user.id)}>
                      {t('common.actions.save')}
                    </Button>
                    <Button variant="outline" size="sm" type="button" onClick={onCancelEdit}>
                      {t('common.actions.cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" type="button" onClick={() => onStartEdit(user)}>
                      {t('reports.portfolio.editRole')}
                    </Button>
                    {user.isActive !== false ? (
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        disabled={deactivatePending || Number(user.id) === currentUserId}
                        onClick={() => onDeactivate(user)}
                      >
                        {t('reports.portfolio.deactivate')}
                      </Button>
                    ) : (
                      <Button variant="success" size="sm" type="button" disabled={reactivatePending} onClick={() => onReactivate(user)}>
                        {t('reports.portfolio.reactivate')}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReportsPortfolioSection({
  isAdmin,
  recoverySummary,
  amountMetrics,
  activeTab,
  setActiveTab,
  recoveredLoans,
  outstandingLoans,
  users,
  usersLoading,
  editingUser,
  userRoleForm,
  currentUserId,
  updateUserPending,
  deactivatePending,
  reactivatePending,
  onRoleChange,
  onStartEdit,
  onCancelEdit,
  onSaveRole,
  onDeactivate,
  onReactivate,
  recoveredPagination,
  outstandingPagination,
  usersPagination,
  onRecoveredPageChange,
  onOutstandingPageChange,
  onUsersPageChange,
}) {
  const { t } = useTranslation()

  const renderRecoveredTable = () => {
    if (!recoveredLoans.length) {
      return (
        <StatePanel
          icon="📋"
          title={t('reports.portfolio.noRecoveredTitle')}
          message={t('reports.portfolio.noRecoveredMessage')}
        />
      )
    }

    return (
      <div className="dashboard-page-stack section-stack--compact">
        <PaginationControls pagination={recoveredPagination} onPageChange={onRecoveredPageChange} />
        <div className="table-wrap">
          <table className="data-table">
          <thead>
            <tr>
              <th>{t('reports.portfolio.headers.id')}</th>
              <th>{t('reports.portfolio.headers.customer')}</th>
              <th>{t('reports.portfolio.headers.agent')}</th>
              <th className="table-cell-right">{t('reports.portfolio.headers.amount')}</th>
              <th className="table-cell-right">{t('reports.portfolio.headers.recovered')}</th>
              <th className="table-cell-center">{t('reports.portfolio.headers.recoveryDate')}</th>
            </tr>
          </thead>
          <tbody>
            {recoveredLoans.map((loan) => (
              <tr key={loan.id}>
                <td><span className="table-id-pill">#{loan.id}</span></td>
                <td>{loan.Customer?.name || t('common.values.notAvailable')}</td>
                <td>{loan.Agent?.name || t('common.values.notAvailable')}</td>
                <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                <td className="table-cell-right">{formatCurrency(loan.totalPaid)}</td>
                <td className="table-cell-center">{formatDate(loan.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderOutstandingTable = () => {
    if (!outstandingLoans.length) {
      return (
        <StatePanel
          icon="✅"
          title={t('reports.portfolio.noOutstandingTitle')}
          message={t('reports.portfolio.noOutstandingMessage')}
        />
      )
    }

    return (
      <div className="dashboard-page-stack section-stack--compact">
        <PaginationControls pagination={outstandingPagination} onPageChange={onOutstandingPageChange} />
        <div className="table-wrap">
          <table className="data-table">
          <thead>
            <tr>
              <th>{t('reports.portfolio.headers.id')}</th>
              <th>{t('reports.portfolio.headers.customer')}</th>
              <th>{t('reports.portfolio.headers.agent')}</th>
              <th className="table-cell-right">{t('reports.portfolio.headers.amount')}</th>
              <th className="table-cell-right">{t('reports.portfolio.headers.paid')}</th>
              <th className="table-cell-right">{t('reports.portfolio.headers.outstanding')}</th>
              <th className="table-cell-center">{t('reports.portfolio.headers.status')}</th>
            </tr>
          </thead>
          <tbody>
            {outstandingLoans.map((loan) => (
              <tr key={loan.id}>
                <td><span className="table-id-pill">#{loan.id}</span></td>
                <td>{loan.Customer?.name || t('common.values.notAvailable')}</td>
                <td>{loan.Agent?.name || t('common.values.notAvailable')}</td>
                <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                <td className="table-cell-right">{formatCurrency(loan.totalPaid)}</td>
                <td className="table-cell-right">{formatCurrency(loan.outstandingAmount)}</td>
                <td className="table-cell-center">
                  <Badge variant={RECOVERY_TONE_MAP[loan.recoveryStatus] || 'neutral'}>
                    {formatRecoveryStatus(loan.recoveryStatus)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    )
  }

  const activeTabEntry = REPORT_TABS.find((tab) => tab.id === activeTab)

  return (
    <>
      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">{t('reports.portfolio.amountSummaryEyebrow')}</div>
            <div className="section-title">{t('reports.portfolio.amountSummaryTitle')}</div>
            <div className="section-subtitle">{t('reports.portfolio.amountSummarySubtitle')}</div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="summary-grid">
            {amountMetrics.map((metric) => (
              <div key={metric.label} className="detail-card">
                <div className="detail-card__label">{metric.label}</div>
                <div className={`detail-card__value detail-card__value--${metric.tone === 'brand' ? 'success' : metric.tone}`}>{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">{t('reports.portfolio.reportViewsEyebrow')}</div>
            <div className="section-title">{t('reports.portfolio.reportViewsTitle')}</div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="page-tabs">
            {REPORT_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
              <button key={tab.id} className={`page-tab${activeTab === tab.id ? ' page-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.icon} {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">{activeTabEntry ? t(activeTabEntry.label) : ''}</div>
            <div className="section-title">{activeTabEntry ? t(activeTabEntry.description) : ''}</div>
          </div>
        </div>
        <div className="surface-card__body">
          {activeTab === 'overview' && (
            <div className="summary-grid">
              <div className="detail-card"><div className="detail-card__label">{t('reports.portfolio.overviewRecovered')}</div><div className="detail-card__value detail-card__value--success">{recoverySummary?.recoveredLoans || 0}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.portfolio.overviewOutstanding')}</div><div className="detail-card__value detail-card__value--warning">{recoverySummary?.outstandingLoans || 0}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.portfolio.overviewVisible')}</div><div className="detail-card__value">{recoverySummary?.totalLoans || 0}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.portfolio.overviewRate')}</div><div className="detail-card__value detail-card__value--success">{recoverySummary?.recoveryRate || '0%'}</div></div>
            </div>
          )}
          {activeTab === 'recovered' && renderRecoveredTable()}
          {activeTab === 'outstanding' && renderOutstandingTable()}
          {activeTab === 'users' && isAdmin && (
            <div className="dashboard-page-stack section-stack--compact">
              <PaginationControls pagination={usersPagination} disabled={usersLoading} onPageChange={onUsersPageChange} />
              <div className="table-wrap">
                <UsersTable
                  users={users}
                  usersLoading={usersLoading}
                  editingUser={editingUser}
                  userRoleForm={userRoleForm}
                  currentUserId={currentUserId}
                  updateUserPending={updateUserPending}
                  deactivatePending={deactivatePending}
                  reactivatePending={reactivatePending}
                  onRoleChange={onRoleChange}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveRole={onSaveRole}
                  onDeactivate={onDeactivate}
                  onReactivate={onReactivate}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default ReportsPortfolioSection
