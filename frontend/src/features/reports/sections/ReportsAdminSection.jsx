import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import { formatCurrency } from '@/features/reports/reportsWorkspace.utils'

function ReportsAdminSection(props) {
  const { t } = useTranslation()
  const {
    selectedHistoryLoanId,
    setSelectedHistoryLoanId,
    creditHistory,
    selectedAssociateId,
    associates,
    associateForm,
    contributionForm,
    distributionForm,
    proportionalForm,
    selectedAssociatePortal,
    selectedAssociateProfitability,
    createAssociatePending,
    updateAssociatePending,
    deleteAssociatePending,
    createContributionPending,
    createDistributionPending,
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
    onProportionalFormChange,
    onCreateProportionalDistribution,
  } = props

  return (
    <>
      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">{t('reports.admin.creditHistoryEyebrow')}</div>
            <div className="section-title">{t('reports.admin.creditHistoryTitle')}</div>
            <div className="section-subtitle">{t('reports.admin.creditHistorySubtitle')}</div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('reports.admin.fields.loanId')}</span>
              <input className="field-control" value={selectedHistoryLoanId} onChange={(event) => setSelectedHistoryLoanId(event.target.value)} />
            </label>
          </div>
          {creditHistory && (
            <div className="summary-grid section-margin-top">
              <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.loanId')}</div><div className="detail-card__value">#{creditHistory.loan.id}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.exposure')}</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(creditHistory.snapshot.outstandingBalance)}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.distributed')}</div><div className="detail-card__value detail-card__value--success">{formatCurrency(creditHistory.snapshot.totalPaid)}</div></div>
              <div className="detail-card"><div className="detail-card__label">{t('reports.portfolio.headers.status')}</div><div className="detail-card__value">{creditHistory.closure?.closureReason || '-'}</div></div>
            </div>
          )}
        </div>
      </section>

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">{t('reports.admin.associateOpsEyebrow')}</div>
            <div className="section-title">{t('reports.admin.associateOpsTitle')}</div>
            <div className="section-subtitle">{t('reports.admin.associateOpsSubtitle')}</div>
          </div>
        </div>
        <div className="surface-card__body">
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
                <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.contributed')}</div><div className="detail-card__value">{formatCurrency(selectedAssociateProfitability?.summary?.totalContributed)}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.distributed')}</div><div className="detail-card__value detail-card__value--success">{formatCurrency(selectedAssociateProfitability?.summary?.totalDistributed)}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.activeLoans')}</div><div className="detail-card__value">{selectedAssociatePortal?.summary?.activeLoanCount || 0}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('reports.admin.fields.exposure')}</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(selectedAssociatePortal?.summary?.portfolioExposure)}</div></div>
              </div>

              <div className="dashboard-form-grid section-margin-bottom">
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.contributionAmount')}</span>
                  <input className="field-control" value={contributionForm.amount} onChange={(event) => onContributionFormChange('amount', event.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.contributionDate')}</span>
                  <input className="field-control" type="date" value={contributionForm.contributionDate} onChange={(event) => onContributionFormChange('contributionDate', event.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.notes')}</span>
                  <input className="field-control" value={contributionForm.notes} onChange={(event) => onContributionFormChange('notes', event.target.value)} />
                </label>
                <div className="field-group">
                  <span className="field-label">{t('reports.admin.fields.action')}</span>
                  <Button type="button" onClick={onCreateContribution} disabled={createContributionPending}>{t('reports.admin.buttons.addContribution')}</Button>
                </div>
              </div>

              <div className="dashboard-form-grid section-margin-bottom">
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.distributionAmount')}</span>
                  <input className="field-control" value={distributionForm.amount} onChange={(event) => onDistributionFormChange('amount', event.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.distributionDate')}</span>
                  <input className="field-control" type="date" value={distributionForm.distributionDate} onChange={(event) => onDistributionFormChange('distributionDate', event.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">{t('reports.admin.fields.notes')}</span>
                  <input className="field-control" value={distributionForm.notes} onChange={(event) => onDistributionFormChange('notes', event.target.value)} />
                </label>
                <div className="field-group">
                  <span className="field-label">{t('reports.admin.fields.action')}</span>
                  <Button type="button" onClick={onCreateDistribution} disabled={createDistributionPending}>{t('reports.admin.buttons.addDistribution')}</Button>
                </div>
              </div>
            </>
          )}

          <div className="dashboard-form-grid section-margin-bottom">
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

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.admin.headers.associate')}</th>
                  <th>{t('reports.admin.headers.status')}</th>
                  <th>{t('reports.admin.headers.participation')}</th>
                  <th className="table-cell-right">{t('reports.admin.headers.contributed')}</th>
                  <th className="table-cell-right">{t('reports.admin.headers.distributed')}</th>
                </tr>
              </thead>
              <tbody>
                {associates.length === 0 ? (
                  <tr><td colSpan="5" className="table-cell-center">{t('reports.admin.emptyAssociates')}</td></tr>
                ) : (
                  associates.map((associate) => (
                    <tr key={associate.id}>
                      <td>{associate.name}</td>
                      <td>{associate.status || '-'}</td>
                      <td>{associate.participationPercentage || '0.0000'}%</td>
                      <td className="table-cell-right">{Number(selectedAssociateId) === Number(associate.id) ? formatCurrency(selectedAssociateProfitability?.summary?.totalContributed) : '-'}</td>
                      <td className="table-cell-right">{Number(selectedAssociateId) === Number(associate.id) ? formatCurrency(selectedAssociateProfitability?.summary?.totalDistributed) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}

export default ReportsAdminSection
