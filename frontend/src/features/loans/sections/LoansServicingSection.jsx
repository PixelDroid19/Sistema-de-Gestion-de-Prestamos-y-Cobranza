import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FormSection from '@/components/ui/workspace/FormSection'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { formatCurrency, formatDate } from '@/features/loans/loansWorkspace.utils'

function SummaryMetric({ label, value, tone }) {
  const valueClassName = tone ? `detail-card__value detail-card__value--${tone}` : 'detail-card__value'

  return (
    <div className="detail-card">
      <div className="detail-card__label">{label}</div>
      <div className={valueClassName}>{value}</div>
    </div>
  )
}

function LoanServicingCard({
  loan,
  user,
  customerDocuments,
  customerHistory,
  alerts,
  promises,
  attachments,
  promiseDraft,
  followUpDraft,
  attachmentDraft,
  customerDocumentDraft,
  pendingPromises,
  pendingFollowUps,
  pendingCreatePromise,
  onPromiseDraftChange,
  onCreatePromise,
  onFollowUpDraftChange,
  onCreateFollowUp,
  onResolveAlert,
  onUpdatePromiseStatus,
  onAttachmentDraftChange,
  onCreateAttachment,
  onCustomerDocumentDraftChange,
  onUploadCustomerDocument,
  onDownloadLoanAttachment,
  onDownloadCustomerDocument,
  onDeleteCustomerDocument,
  onDownloadPromise,
}) {
  const { t } = useTranslation()
  const customerId = Number(loan.customerId || loan.Customer?.id)
  const historySegments = customerHistory?.segments || {}
  const historyTimeline = customerHistory?.timeline || []
  const canManageServicing = user.role === 'admin' || user.role === 'agent'
  const activeAlertCount = alerts.filter((alert) => alert.status === 'active').length
  const historyPreview = historyTimeline.slice(0, 5)

  const alertColumns = useMemo(() => [
    { key: 'installmentNumber', header: t('loans.servicing.tables.alerts.headers.installment'), render: (alert) => `#${alert.installmentNumber}` },
    { key: 'dueDate', header: t('loans.servicing.tables.alerts.headers.dueDate'), render: (alert) => formatDate(alert.dueDate) },
    { key: 'outstandingAmount', header: t('loans.servicing.tables.alerts.headers.outstanding'), cellClassName: 'table-cell-right', render: (alert) => formatCurrency(alert.outstandingAmount) },
    {
      key: 'status',
      header: t('loans.servicing.tables.alerts.headers.status'),
      render: (alert) => (
        <div className="inline-action-group">
          <span>{alert.status}</span>
          {alert.status === 'active' ? (
            <Button variant="outline" size="sm" onClick={() => onResolveAlert(loan.id, alert.id)}>
              {t('loans.servicing.buttons.resolveAlert')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ], [loan.id, onResolveAlert, t])

  const promiseColumns = useMemo(() => [
    { key: 'promisedDate', header: t('loans.servicing.tables.promises.headers.promisedDate'), render: (promise) => formatDate(promise.promisedDate) },
    { key: 'amount', header: t('loans.servicing.tables.promises.headers.amount'), cellClassName: 'table-cell-right', render: (promise) => formatCurrency(promise.amount) },
    {
      key: 'status',
      header: t('loans.servicing.tables.promises.headers.status'),
      render: (promise) => (
        <div className="inline-action-group">
          <span>{promise.status}</span>
          {canManageServicing && promise.status === 'pending' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onUpdatePromiseStatus(loan.id, promise.id, 'kept')}>
                {t('loans.servicing.buttons.markKept')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => onUpdatePromiseStatus(loan.id, promise.id, 'broken')}>
                {t('loans.servicing.buttons.markBroken')}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
    { key: 'notes', header: t('loans.servicing.tables.promises.headers.notes'), render: (promise) => promise.notes || '-' },
  ], [canManageServicing, loan.id, onUpdatePromiseStatus, t])

  const attachmentColumns = useMemo(() => [
    { key: 'originalName', header: t('loans.servicing.tables.attachments.headers.attachment') },
    { key: 'category', header: t('loans.servicing.tables.attachments.headers.category'), render: (attachment) => attachment.category || '-' },
    { key: 'customerVisible', header: t('loans.servicing.tables.attachments.headers.customerVisible'), render: (attachment) => attachment.customerVisible ? t('common.values.yes') : t('common.values.no') },
    {
      key: 'action',
      header: t('loans.servicing.tables.attachments.headers.action'),
      cellClassName: 'table-cell-center',
      render: (attachment) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownloadLoanAttachment(loan.id, attachment.id, attachment.originalName)}
        >
          {t('loans.servicing.buttons.download')}
        </Button>
      ),
    },
  ], [loan.id, onDownloadLoanAttachment, t])

  const promiseDocumentColumns = useMemo(() => [
    { key: 'id', header: t('loans.servicing.tables.promises.headers.promiseId') },
    { key: 'promisedDate', header: t('loans.servicing.tables.promises.headers.promisedDate'), render: (promise) => formatDate(promise.promisedDate) },
    { key: 'amount', header: t('loans.servicing.tables.promises.headers.amount'), render: (promise) => formatCurrency(promise.amount) },
    { key: 'status', header: t('loans.servicing.tables.promises.headers.status') },
    {
      key: 'action',
      header: t('loans.servicing.tables.promises.headers.action'),
      cellClassName: 'table-cell-center',
      render: (promise) => (
        <Button variant="outline" size="sm" onClick={() => onDownloadPromise(loan.id, promise.id)}>
          {t('loans.servicing.buttons.downloadPdf')}
        </Button>
      ),
    },
  ], [loan.id, onDownloadPromise, t])

  const customerDocumentColumns = useMemo(() => [
    { key: 'originalName', header: t('loans.servicing.tables.customerDocuments.headers.document') },
    { key: 'category', header: t('loans.servicing.tables.customerDocuments.headers.category'), render: (document) => document.category || '-' },
    { key: 'customerVisible', header: t('loans.servicing.tables.customerDocuments.headers.visible'), render: (document) => document.customerVisible ? t('common.values.yes') : t('common.values.no') },
    {
      key: 'action',
      header: t('loans.servicing.tables.customerDocuments.headers.action'),
      cellClassName: 'table-cell-center',
      render: (document) => (
        <div className="inline-action-group">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadCustomerDocument(customerId, document.id, document.originalName)}
          >
            {t('loans.servicing.buttons.download')}
          </Button>
          {user.role === 'admin' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteCustomerDocument(customerId, document.id)}
            >
              {t('loans.servicing.buttons.delete')}
            </Button>
          )}
        </div>
      ),
    },
  ], [customerId, onDeleteCustomerDocument, onDownloadCustomerDocument, t, user.role])

  return (
    <WorkspaceCard
      compact
      className="surface-card surface-card--compact"
      data-loan-id={loan.id}
      eyebrow={`Loan #${loan.id}`}
      title={`${loan.Customer?.name || user.name} · ${formatCurrency(loan.amount)}`}
    >
        <div className="summary-grid section-margin-bottom">
          <SummaryMetric label={t('loans.servicing.metrics.alerts')} value={activeAlertCount} tone="warning" />
          <SummaryMetric label={t('loans.servicing.metrics.promises')} value={promises.length} tone="info" />
          <SummaryMetric label={t('loans.servicing.metrics.loanAttachments')} value={attachments.length} />
          <SummaryMetric label={t('loans.servicing.metrics.customerDocuments')} value={customerDocuments.length} />
        </div>

        {canManageServicing && (
          <FormSection title={t('loans.servicing.buttons.savePromise')} className="section-margin-bottom">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.promiseDate')}</span>
              <input
                className="field-control"
                data-testid={`loan-${loan.id}-promise-promised-date`}
                name="promisePromisedDate"
                type="date"
                value={promiseDraft.promisedDate || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'promisedDate', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.promiseAmount')}</span>
              <input
                className="field-control"
                data-testid={`loan-${loan.id}-promise-amount`}
                name="promiseAmount"
                type="number"
                value={promiseDraft.amount || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'amount', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.notes')}</span>
              <input
                className="field-control"
                data-testid={`loan-${loan.id}-promise-notes`}
                name="promiseNotes"
                value={promiseDraft.notes || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'notes', event.target.value)}
              />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.create')}</span>
              <Button data-testid={`loan-${loan.id}-create-promise`} name="createPromise" disabled={pendingPromises[loan.id] || pendingCreatePromise} onClick={() => onCreatePromise(loan.id)}>
                {pendingPromises[loan.id] ? t('loans.portfolio.saving') : t('loans.servicing.buttons.savePromise')}
              </Button>
            </div>
          </div>
          </FormSection>
        )}

        {canManageServicing && (
          <FormSection title={t('loans.servicing.buttons.createFollowUp')} className="section-margin-bottom">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.installmentNumber')}</span>
              <input className="field-control" data-testid={`loan-${loan.id}-follow-up-installment-number`} name="followUpInstallmentNumber" type="number" value={followUpDraft.installmentNumber || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'installmentNumber', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.dueDate')}</span>
              <input className="field-control" data-testid={`loan-${loan.id}-follow-up-due-date`} name="followUpDueDate" type="date" value={followUpDraft.dueDate || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'dueDate', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.outstandingAmount')}</span>
              <input className="field-control" data-testid={`loan-${loan.id}-follow-up-outstanding-amount`} name="followUpOutstandingAmount" type="number" value={followUpDraft.outstandingAmount || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'outstandingAmount', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.notes')}</span>
              <input className="field-control" data-testid={`loan-${loan.id}-follow-up-notes`} name="followUpNotes" value={followUpDraft.notes || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'notes', event.target.value)} />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.action')}</span>
              <Button data-testid={`loan-${loan.id}-create-follow-up`} name="createFollowUp" disabled={pendingFollowUps[loan.id]} onClick={() => onCreateFollowUp(loan.id)}>
                {pendingFollowUps[loan.id] ? t('loans.portfolio.saving') : t('loans.servicing.buttons.createFollowUp')}
              </Button>
            </div>
          </div>
          </FormSection>
        )}

        {canManageServicing && (
          <FormSection title={t('loans.servicing.buttons.uploadAttachment')} className="section-margin-bottom">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.loanAttachment')}</span>
              <input
                className="field-control"
                type="file"
                onChange={(event) => onAttachmentDraftChange(loan.id, 'file', event.target.files?.[0] || null)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.category')}</span>
              <input
                className="field-control"
                value={attachmentDraft.category || ''}
                onChange={(event) => onAttachmentDraftChange(loan.id, 'category', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.description')}</span>
              <input
                className="field-control"
                value={attachmentDraft.description || ''}
                onChange={(event) => onAttachmentDraftChange(loan.id, 'description', event.target.value)}
              />
            </label>
            <label className="field-group field-group--centered">
              <span className="field-label">{t('loans.servicing.fields.customerVisible')}</span>
              <input
                type="checkbox"
                checked={Boolean(attachmentDraft.customerVisible)}
                onChange={(event) => onAttachmentDraftChange(loan.id, 'customerVisible', event.target.checked)}
              />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.upload')}</span>
              <Button onClick={() => onCreateAttachment(loan.id)}>{t('loans.servicing.buttons.uploadAttachment')}</Button>
            </div>
          </div>
          </FormSection>
        )}

        {canManageServicing && customerId && (
          <FormSection title={t('loans.servicing.buttons.uploadDocument')} className="section-margin-bottom">
          <div className="dashboard-form-grid">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.customerDocument')}</span>
              <input
                className="field-control"
                type="file"
                onChange={(event) => onCustomerDocumentDraftChange(customerId, 'file', event.target.files?.[0] || null)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.category')}</span>
              <input
                className="field-control"
                value={customerDocumentDraft.category || ''}
                onChange={(event) => onCustomerDocumentDraftChange(customerId, 'category', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.description')}</span>
              <input
                className="field-control"
                value={customerDocumentDraft.description || ''}
                onChange={(event) => onCustomerDocumentDraftChange(customerId, 'description', event.target.value)}
              />
            </label>
            <label className="field-group field-group--centered">
              <span className="field-label">{t('loans.servicing.fields.customerVisible')}</span>
              <input
                type="checkbox"
                checked={Boolean(customerDocumentDraft.customerVisible)}
                onChange={(event) => onCustomerDocumentDraftChange(customerId, 'customerVisible', event.target.checked)}
              />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.upload')}</span>
              <Button onClick={() => onUploadCustomerDocument(customerId)}>{t('loans.servicing.buttons.uploadDocument')}</Button>
            </div>
          </div>
          </FormSection>
        )}

        {user.role === 'admin' && customerHistory && (
          <WorkspaceCard compact className="surface-card surface-card--compact section-margin-bottom" eyebrow={t('loans.servicing.history.eyebrow')}>
              <div className="section-eyebrow">{t('loans.servicing.history.eyebrow')}</div>
              <div className="summary-grid section-margin-bottom">
                <SummaryMetric label={t('loans.servicing.history.loans')} value={historySegments.loans?.length || 0} />
                <SummaryMetric label={t('loans.servicing.history.payments')} value={historySegments.payments?.length || 0} tone="success" />
                <SummaryMetric label={t('loans.servicing.history.documents')} value={historySegments.documents?.length || 0} />
                <SummaryMetric label={t('loans.servicing.history.notifications')} value={historySegments.notifications?.length || 0} tone="info" />
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('loans.servicing.history.headers.event')}</th>
                      <th>{t('loans.servicing.history.headers.type')}</th>
                      <th>{t('loans.servicing.history.headers.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyPreview.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.eventType.replaceAll('_', ' ')}</td>
                        <td>{entry.entityType}</td>
                        <td>{formatDate(entry.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </WorkspaceCard>
        )}

        {canManageServicing && alerts.length > 0 && (
          <FormSection title={t('loans.servicing.buttons.resolveAlert')} className="section-margin-bottom">
            <DataTable columns={alertColumns} rows={alerts} rowKey="id" />
          </FormSection>
        )}

        {promises.length > 0 && (
          <FormSection title={t('loans.servicing.buttons.savePromise')} className="section-margin-bottom">
            <DataTable columns={promiseColumns} rows={promises} rowKey="id" />
          </FormSection>
        )}

        <FormSection title={t('loans.servicing.metrics.loanAttachments')} className="section-margin-bottom">
          <DataTable
            columns={attachmentColumns}
            rows={attachments}
            rowKey="id"
            emptyState={<EmptyState icon="📎" title={t('loans.servicing.tables.attachments.empty')} />}
          />
        </FormSection>

        {canManageServicing && (
          <FormSection title={t('loans.servicing.buttons.downloadPdf')} className="section-margin-bottom">
            <DataTable
              columns={promiseDocumentColumns}
              rows={promises}
              rowKey="id"
              emptyState={<EmptyState icon="📄" title={t('loans.servicing.tables.promises.empty')} />}
            />
          </FormSection>
        )}

        <FormSection title={t('loans.servicing.metrics.customerDocuments')}>
          <DataTable
            columns={customerDocumentColumns}
            rows={customerDocuments}
            rowKey="id"
            emptyState={<EmptyState icon="🗂️" title={t('loans.servicing.tables.customerDocuments.empty')} />}
          />
        </FormSection>
    </WorkspaceCard>
  )
}

function LoansServicingSection(props) {
  const { t } = useTranslation()
  const {
    loans,
    user,
    loadingServicing,
    customerDocumentsByCustomer,
    customerHistoryByCustomer,
    alertsByLoan,
    promisesByLoan,
    attachmentsByLoan,
    promiseDrafts,
    followUpDrafts,
    attachmentDrafts,
    customerDocumentDrafts,
    pendingPromises,
    pendingFollowUps,
    createLoanPromisePending,
    onPromiseDraftChange,
    onCreatePromise,
    onFollowUpDraftChange,
    onCreateFollowUp,
    onResolveAlert,
    onUpdatePromiseStatus,
    onAttachmentDraftChange,
    onCreateAttachment,
    onCustomerDocumentDraftChange,
    onUploadCustomerDocument,
    onDownloadLoanAttachment,
    onDownloadCustomerDocument,
    onDeleteCustomerDocument,
    onDownloadPromise,
  } = props

  if (loans.length === 0) {
    return null
  }

  return (
    <WorkspaceCard
      className="surface-card"
      eyebrow={t('loans.servicing.eyebrow')}
      title={t('loans.servicing.title')}
      subtitle={t('loans.servicing.subtitle')}
    >
        {loadingServicing && loans.length > 0 && (
          <div className="inline-message inline-message--success">⏳ {t('loans.servicing.refreshing')}</div>
        )}

        <div className="dashboard-page-stack section-stack--compact">
          {loans.map((loan) => {
            const customerId = Number(loan.customerId || loan.Customer?.id)

            return (
              <LoanServicingCard
                key={`servicing-${loan.id}`}
                loan={loan}
                user={user}
                customerDocuments={customerId ? customerDocumentsByCustomer[customerId] || [] : []}
                customerHistory={customerId ? customerHistoryByCustomer[customerId] : null}
                alerts={alertsByLoan[loan.id] || []}
                promises={promisesByLoan[loan.id] || []}
                attachments={attachmentsByLoan[loan.id] || []}
                promiseDraft={promiseDrafts[loan.id] || {}}
                followUpDraft={followUpDrafts[loan.id] || {}}
                attachmentDraft={attachmentDrafts[loan.id] || {}}
                customerDocumentDraft={customerId ? customerDocumentDrafts[customerId] || {} : {}}
                pendingPromises={pendingPromises}
                pendingFollowUps={pendingFollowUps}
                pendingCreatePromise={createLoanPromisePending}
                onPromiseDraftChange={onPromiseDraftChange}
                onCreatePromise={onCreatePromise}
                onFollowUpDraftChange={onFollowUpDraftChange}
                onCreateFollowUp={onCreateFollowUp}
                onResolveAlert={onResolveAlert}
                onUpdatePromiseStatus={onUpdatePromiseStatus}
                onAttachmentDraftChange={onAttachmentDraftChange}
                onCreateAttachment={onCreateAttachment}
                onCustomerDocumentDraftChange={onCustomerDocumentDraftChange}
                onUploadCustomerDocument={onUploadCustomerDocument}
                onDownloadLoanAttachment={onDownloadLoanAttachment}
                onDownloadCustomerDocument={onDownloadCustomerDocument}
                onDeleteCustomerDocument={onDeleteCustomerDocument}
                onDownloadPromise={onDownloadPromise}
              />
            )
          })}
        </div>
    </WorkspaceCard>
  )
}

export default LoansServicingSection
