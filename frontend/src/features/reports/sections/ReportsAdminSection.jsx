import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { formatCurrency } from '@/features/reports/reportsWorkspace.utils'

function SummaryMetric({ label, value, tone }) {
  const valueClassName = tone ? `detail-card__value detail-card__value--${tone}` : 'detail-card__value'

  return (
    <div className="detail-card">
      <div className="detail-card__label">{label}</div>
      <div className={valueClassName}>{value}</div>
    </div>
  )
}

function ReportsAdminSection(props) {
  const { t } = useTranslation()
  const {
    selectedHistoryLoanId,
    setSelectedHistoryLoanId,
    creditHistory,
    selectedCustomerProfileId,
    setSelectedCustomerProfileId,
    customerCreditProfile,
    customerProfitability,
    loanProfitability,
    customerProfitabilityPagination,
    loanProfitabilityPagination,
    onCustomerProfitabilityPageChange,
    onLoanProfitabilityPageChange,
    onExportCustomerProfile,
    onExportLoanHistory,
  } = props

  const customerProfitabilityColumns = useMemo(() => [
    { key: 'customerId', header: t('reports.admin.fields.customerId'), render: (row) => `#${row.customerId}` },
    { key: 'customerName', header: t('reports.admin.fields.customerName'), render: (row) => row.customerName || '-' },
    { key: 'loanCount', header: t('reports.admin.fields.customerProfitabilityRows'), render: (row) => row.loanCount || 0 },
    { key: 'outstandingBalance', header: t('reports.admin.fields.exposure'), cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.outstandingBalance) },
    { key: 'totalProfit', header: 'Profit', cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.totalProfit) },
  ], [t])

  const loanProfitabilityColumns = useMemo(() => [
    { key: 'loanId', header: t('reports.admin.fields.loanId'), render: (row) => `#${row.loanId}` },
    { key: 'customerName', header: t('reports.admin.fields.customerName'), render: (row) => row.customerName || '-' },
    { key: 'loanStatus', header: t('reports.portfolio.headers.status'), render: (row) => row.loanStatus || '-' },
    { key: 'totalCollected', header: 'Collected', cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.totalCollected) },
    { key: 'totalProfit', header: 'Profit', cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.totalProfit) },
  ], [t])

  return (
      <WorkspaceCard
        className="surface-card"
        eyebrow={t('reports.admin.creditHistoryEyebrow')}
        title={t('reports.admin.creditHistoryTitle')}
        subtitle={t('reports.admin.creditHistorySubtitle')}
      >
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.loanId')}</span>
              <input className="field-control" value={selectedHistoryLoanId} onChange={(event) => setSelectedHistoryLoanId(event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.customerId')}</span>
              <input className="field-control" value={selectedCustomerProfileId} onChange={(event) => setSelectedCustomerProfileId(event.target.value)} />
            </label>
          </div>
          <div className="section-actions section-margin-top">
            <Button variant="outline" type="button" disabled={!selectedHistoryLoanId} onClick={() => onExportLoanHistory('pdf')}>
              {t('reports.admin.buttons.downloadLoanHistory')}
            </Button>
            <Button variant="outline" type="button" disabled={!selectedCustomerProfileId} onClick={() => onExportCustomerProfile('pdf')}>
              {t('reports.admin.buttons.downloadCustomerProfile')}
            </Button>
          </div>
          {creditHistory && (
            <div className="summary-grid section-margin-top">
              <SummaryMetric label={t('reports.admin.fields.loanId')} value={`#${creditHistory.loan.id}`} />
              <SummaryMetric label={t('reports.admin.fields.exposure')} value={formatCurrency(creditHistory.snapshot.outstandingBalance)} tone="warning" />
              <SummaryMetric label={t('reports.admin.fields.distributed')} value={formatCurrency(creditHistory.snapshot.totalPaid)} tone="success" />
              <SummaryMetric label={t('reports.portfolio.headers.status')} value={creditHistory.closure?.closureReason || '-'} />
            </div>
          )}
          {customerCreditProfile && (
            <>
              <div className="summary-grid section-margin-top">
                <SummaryMetric label={t('reports.admin.fields.customerName')} value={customerCreditProfile.customer?.name || '-'} />
                <SummaryMetric label={t('reports.admin.fields.customerCompleteness')} value={customerCreditProfile.profile?.completeness?.isComplete ? t('reports.admin.values.complete') : t('reports.admin.values.incomplete')} />
                <SummaryMetric label={t('reports.admin.fields.activeLoans')} value={customerCreditProfile.profile?.summary?.activeLoans || 0} />
                <SummaryMetric label={t('reports.admin.fields.delinquentAlerts')} value={customerCreditProfile.profile?.summary?.delinquentAlerts || 0} tone="warning" />
              </div>
              <div className="content-note section-margin-top">
                {t('reports.admin.fields.missingSections')}: {(customerCreditProfile.profile?.completeness?.missingSections || []).join(', ') || t('common.values.notAvailable')}
              </div>
            </>
          )}
          <div className="summary-grid section-margin-top">
            <SummaryMetric label={t('reports.admin.fields.customerProfitabilityRows')} value={customerProfitability.length} />
            <SummaryMetric label={t('reports.admin.fields.loanProfitabilityRows')} value={loanProfitability.length} />
          </div>
          <div className="section-margin-top dashboard-page-stack section-stack--compact">
            <div className="section-subtitle">{t('reports.admin.fields.customerProfitabilityRows')}</div>
            <PaginationControls pagination={customerProfitabilityPagination} onPageChange={onCustomerProfitabilityPageChange} />
            <DataTable
              columns={customerProfitabilityColumns}
              rows={customerProfitability}
              rowKey="customerId"
              emptyState={<EmptyState icon="📈" title="No customer profitability rows" />}
            />
          </div>
          <div className="section-margin-top dashboard-page-stack section-stack--compact">
            <div className="section-subtitle">{t('reports.admin.fields.loanProfitabilityRows')}</div>
            <PaginationControls pagination={loanProfitabilityPagination} onPageChange={onLoanProfitabilityPageChange} />
            <DataTable
              columns={loanProfitabilityColumns}
              rows={loanProfitability}
              rowKey="loanId"
              emptyState={<EmptyState icon="💹" title="No loan profitability rows" />}
            />
          </div>
      </WorkspaceCard>
  )
}

export default ReportsAdminSection
