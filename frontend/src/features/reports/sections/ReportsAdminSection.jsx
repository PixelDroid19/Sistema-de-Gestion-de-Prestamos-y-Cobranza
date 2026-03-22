import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FormSection from '@/components/ui/workspace/FormSection'
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

function AssociateLedgerForm({
  title,
  amountLabel,
  dateLabel,
  dateField,
  notesLabel,
  actionFieldLabel,
  actionLabel,
  amountValue,
  dateValue,
  notesValue,
  onChange,
  onSubmit,
  isPending,
}) {
  return (
    <FormSection title={title} className="section-margin-bottom">
      <div className="dashboard-form-grid">
        <label className="field-group">
          <span className="field-label">{amountLabel}</span>
          <input className="field-control" value={amountValue} onChange={(event) => onChange('amount', event.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">{dateLabel}</span>
          <input className="field-control" type="date" value={dateValue} onChange={(event) => onChange(dateField, event.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">{notesLabel}</span>
          <input className="field-control" value={notesValue} onChange={(event) => onChange('notes', event.target.value)} />
        </label>
        <div className="field-group">
          <span className="field-label">{actionFieldLabel}</span>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{actionLabel}</Button>
        </div>
      </div>
    </FormSection>
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
    selectedAssociateId,
    associates,
    associateForm,
    contributionForm,
    distributionForm,
    reinvestmentForm,
    proportionalForm,
    selectedAssociatePortal,
    selectedAssociateProfitability,
    customerProfitabilityPagination,
    loanProfitabilityPagination,
    createAssociatePending,
    updateAssociatePending,
    deleteAssociatePending,
    createContributionPending,
    createDistributionPending,
    createReinvestmentPending,
    createProportionalPending,
    onSelectAssociate,
    onAssociateFormChange,
    onCreateAssociate,
    onUpdateAssociate,
    onDeleteAssociate,
    onContributionFormChange,
    onCreateContribution,
    onDistributionFormChange,
    onCreateDistribution,
    onReinvestmentFormChange,
    onCreateReinvestment,
    onProportionalFormChange,
    onCreateProportionalDistribution,
    onCustomerProfitabilityPageChange,
    onLoanProfitabilityPageChange,
  } = props

  const associateMetrics = useMemo(() => ({
    contributed: formatCurrency(selectedAssociateProfitability?.summary?.totalContributed),
    distributed: formatCurrency(selectedAssociateProfitability?.summary?.totalDistributed),
    activeLoans: selectedAssociatePortal?.summary?.activeLoanCount || 0,
    exposure: formatCurrency(selectedAssociatePortal?.summary?.portfolioExposure),
  }), [selectedAssociatePortal?.summary?.activeLoanCount, selectedAssociatePortal?.summary?.portfolioExposure, selectedAssociateProfitability?.summary?.totalContributed, selectedAssociateProfitability?.summary?.totalDistributed])

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

  const associateColumns = useMemo(() => [
    { key: 'name', header: t('reports.admin.headers.associate') },
    { key: 'status', header: t('reports.admin.headers.status'), render: (associate) => associate.status || '-' },
    { key: 'participationPercentage', header: t('reports.admin.headers.participation'), render: (associate) => `${associate.participationPercentage || '0.0000'}%` },
    {
      key: 'contributed',
      header: t('reports.admin.headers.contributed'),
      cellClassName: 'table-cell-right',
      render: (associate) => Number(selectedAssociateId) === Number(associate.id) ? associateMetrics.contributed : '-',
    },
    {
      key: 'distributed',
      header: t('reports.admin.headers.distributed'),
      cellClassName: 'table-cell-right',
      render: (associate) => Number(selectedAssociateId) === Number(associate.id) ? associateMetrics.distributed : '-',
    },
  ], [associateMetrics.contributed, associateMetrics.distributed, selectedAssociateId, t])

  return (
    <>
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
          <FormSection title={t('reports.admin.fields.customerProfitabilityRows')} className="section-margin-top">
            <PaginationControls pagination={customerProfitabilityPagination} onPageChange={onCustomerProfitabilityPageChange} />
            <DataTable
              columns={customerProfitabilityColumns}
              rows={customerProfitability}
              rowKey="customerId"
              emptyState={<EmptyState icon="📈" title="No customer profitability rows" />}
            />
          </FormSection>
          <FormSection title={t('reports.admin.fields.loanProfitabilityRows')} className="section-margin-top">
            <PaginationControls pagination={loanProfitabilityPagination} onPageChange={onLoanProfitabilityPageChange} />
            <DataTable
              columns={loanProfitabilityColumns}
              rows={loanProfitability}
              rowKey="loanId"
              emptyState={<EmptyState icon="💹" title="No loan profitability rows" />}
            />
          </FormSection>
      </WorkspaceCard>

      <WorkspaceCard
        className="surface-card"
        eyebrow={t('reports.admin.associateOpsEyebrow')}
        title={t('reports.admin.associateOpsTitle')}
        subtitle={t('reports.admin.associateOpsSubtitle')}
      >
          <div className="dashboard-form-grid section-margin-bottom">
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.selectedAssociate')}</span>
              <select className="field-control" value={selectedAssociateId} onChange={(event) => onSelectAssociate(event.target.value)}>
                <option value="">{t('reports.admin.fields.createAssociate')}</option>
                {associates.map((associate) => (
                  <option key={associate.id} value={associate.id}>
                    {associate.name} ({associate.participationPercentage || '0.0000'}%)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form onSubmit={onCreateAssociate} className="dashboard-form-grid section-margin-bottom">
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.name')}</span>
              <input className="field-control" value={associateForm.name} onChange={(event) => onAssociateFormChange('name', event.target.value)} required />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.email')}</span>
              <input className="field-control" type="email" value={associateForm.email} onChange={(event) => onAssociateFormChange('email', event.target.value)} required />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.phone')}</span>
              <input className="field-control" value={associateForm.phone} onChange={(event) => onAssociateFormChange('phone', event.target.value)} required />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.status')}</span>
              <select className="field-control" value={associateForm.status} onChange={(event) => onAssociateFormChange('status', event.target.value)}>
                <option value="active">{t('common.status.active')}</option>
                <option value="inactive">{t('common.status.inactive')}</option>
              </select>
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.participation')}</span>
              <input className="field-control" value={associateForm.participationPercentage} onChange={(event) => onAssociateFormChange('participationPercentage', event.target.value)} placeholder="25.0000" />
            </label>
            <div className="field-group">
              <span className="field-label">{t('reports.admin.fields.create')}</span>
              <Button variant="success" type="submit" disabled={createAssociatePending}>{t('reports.admin.buttons.createAssociate')}</Button>
            </div>
          </form>

          {selectedAssociateId && (
            <div className="section-actions section-actions--start section-margin-bottom">
              <Button onClick={onUpdateAssociate} disabled={updateAssociatePending}>{t('reports.admin.buttons.updateAssociate')}</Button>
              <Button variant="danger" type="button" onClick={onDeleteAssociate} disabled={deleteAssociatePending}>{t('reports.admin.buttons.deleteAssociate')}</Button>
            </div>
          )}

          {selectedAssociateId && (
            <>
              <div className="summary-grid section-margin-bottom">
                <SummaryMetric label={t('reports.admin.fields.contributed')} value={associateMetrics.contributed} />
                <SummaryMetric label={t('reports.admin.fields.distributed')} value={associateMetrics.distributed} tone="success" />
                <SummaryMetric label={t('reports.admin.fields.activeLoans')} value={associateMetrics.activeLoans} />
                <SummaryMetric label={t('reports.admin.fields.exposure')} value={associateMetrics.exposure} tone="warning" />
              </div>

              <AssociateLedgerForm
                title={t('reports.admin.buttons.addContribution')}
                amountLabel={t('reports.admin.fields.contributionAmount')}
                dateLabel={t('reports.admin.fields.contributionDate')}
                dateField="contributionDate"
                notesLabel={t('reports.admin.fields.notes')}
                actionFieldLabel={t('reports.admin.fields.action')}
                actionLabel={t('reports.admin.buttons.addContribution')}
                amountValue={contributionForm.amount}
                dateValue={contributionForm.contributionDate}
                notesValue={contributionForm.notes}
                onChange={onContributionFormChange}
                onSubmit={onCreateContribution}
                isPending={createContributionPending}
              />

              <AssociateLedgerForm
                title={t('reports.admin.buttons.addDistribution')}
                amountLabel={t('reports.admin.fields.distributionAmount')}
                dateLabel={t('reports.admin.fields.distributionDate')}
                dateField="distributionDate"
                notesLabel={t('reports.admin.fields.notes')}
                actionFieldLabel={t('reports.admin.fields.action')}
                actionLabel={t('reports.admin.buttons.addDistribution')}
                amountValue={distributionForm.amount}
                dateValue={distributionForm.distributionDate}
                notesValue={distributionForm.notes}
                onChange={onDistributionFormChange}
                onSubmit={onCreateDistribution}
                isPending={createDistributionPending}
              />

              <AssociateLedgerForm
                title={t('reports.admin.buttons.addReinvestment')}
                amountLabel={t('reports.admin.fields.reinvestmentAmount')}
                dateLabel={t('reports.admin.fields.reinvestmentDate')}
                dateField="distributionDate"
                notesLabel={t('reports.admin.fields.notes')}
                actionFieldLabel={t('reports.admin.fields.action')}
                actionLabel={t('reports.admin.buttons.addReinvestment')}
                amountValue={reinvestmentForm.amount}
                dateValue={reinvestmentForm.distributionDate}
                notesValue={reinvestmentForm.notes}
                onChange={onReinvestmentFormChange}
                onSubmit={onCreateReinvestment}
                isPending={createReinvestmentPending}
              />
            </>
          )}

          <FormSection title={t('reports.admin.buttons.runProportional')} className="section-margin-bottom">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.proportionalAmount')}</span>
              <input className="field-control" value={proportionalForm.amount} onChange={(event) => onProportionalFormChange('amount', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.distributionDate')}</span>
              <input className="field-control" type="date" value={proportionalForm.distributionDate} onChange={(event) => onProportionalFormChange('distributionDate', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.idempotencyKey')}</span>
              <input className="field-control" value={proportionalForm.idempotencyKey} onChange={(event) => onProportionalFormChange('idempotencyKey', event.target.value)} placeholder="assoc-proportional-2026-03" />
            </label>
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.notes')}</span>
              <input className="field-control" value={proportionalForm.notes} onChange={(event) => onProportionalFormChange('notes', event.target.value)} />
            </label>
            <div className="field-group">
              <span className="field-label">{t('reports.admin.fields.action')}</span>
              <Button variant="outline" type="button" onClick={onCreateProportionalDistribution} disabled={createProportionalPending}>{t('reports.admin.buttons.runProportional')}</Button>
            </div>
          </div>
          </FormSection>

          <DataTable
            columns={associateColumns}
            rows={associates}
            rowKey="id"
            emptyState={<EmptyState icon="🤝" title={t('reports.admin.emptyAssociates')} />}
          />
      </WorkspaceCard>
    </>
  )
}

export default ReportsAdminSection
