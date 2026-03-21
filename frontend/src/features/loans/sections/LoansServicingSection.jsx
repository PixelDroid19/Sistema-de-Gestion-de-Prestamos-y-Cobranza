import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/features/loans/loansWorkspace.utils'

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

  return (
    <div className="surface-card surface-card--compact">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">Loan #{loan.id}</div>
          <div className="section-title section-title--compact">
            {(loan.Customer?.name || user.name)} · {formatCurrency(loan.amount)}
          </div>
        </div>
      </div>
      <div className="surface-card__body">
        <div className="summary-grid section-margin-bottom">
          <div className="detail-card">
            <div className="detail-card__label">{t('loans.servicing.metrics.alerts')}</div>
            <div className="detail-card__value detail-card__value--warning">{alerts.filter((alert) => alert.status === 'active').length}</div>
          </div>
          <div className="detail-card">
            <div className="detail-card__label">{t('loans.servicing.metrics.promises')}</div>
            <div className="detail-card__value detail-card__value--info">{promises.length}</div>
          </div>
          <div className="detail-card">
            <div className="detail-card__label">{t('loans.servicing.metrics.loanAttachments')}</div>
            <div className="detail-card__value">{attachments.length}</div>
          </div>
          <div className="detail-card">
            <div className="detail-card__label">{t('loans.servicing.metrics.customerDocuments')}</div>
            <div className="detail-card__value">{customerDocuments.length}</div>
          </div>
        </div>

        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="dashboard-form-grid section-margin-bottom">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.promiseDate')}</span>
              <input
                className="field-control"
                type="date"
                value={promiseDraft.promisedDate || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'promisedDate', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.promiseAmount')}</span>
              <input
                className="field-control"
                type="number"
                value={promiseDraft.amount || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'amount', event.target.value)}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.notes')}</span>
              <input
                className="field-control"
                value={promiseDraft.notes || ''}
                onChange={(event) => onPromiseDraftChange(loan.id, 'notes', event.target.value)}
              />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.create')}</span>
              <Button disabled={pendingPromises[loan.id] || pendingCreatePromise} onClick={() => onCreatePromise(loan.id)}>
                {pendingPromises[loan.id] ? t('loans.portfolio.saving') : t('loans.servicing.buttons.savePromise')}
              </Button>
            </div>
          </div>
        )}

        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="dashboard-form-grid section-margin-bottom">
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.installmentNumber')}</span>
              <input className="field-control" type="number" value={followUpDraft.installmentNumber || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'installmentNumber', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.dueDate')}</span>
              <input className="field-control" type="date" value={followUpDraft.dueDate || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'dueDate', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.outstandingAmount')}</span>
              <input className="field-control" type="number" value={followUpDraft.outstandingAmount || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'outstandingAmount', event.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">{t('loans.servicing.fields.notes')}</span>
              <input className="field-control" value={followUpDraft.notes || ''} onChange={(event) => onFollowUpDraftChange(loan.id, 'notes', event.target.value)} />
            </label>
            <div className="field-group">
              <span className="field-label">{t('loans.servicing.fields.action')}</span>
              <Button disabled={pendingFollowUps[loan.id]} onClick={() => onCreateFollowUp(loan.id)}>
                {pendingFollowUps[loan.id] ? t('loans.portfolio.saving') : t('loans.servicing.buttons.createFollowUp')}
              </Button>
            </div>
          </div>
        )}

        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="dashboard-form-grid section-margin-bottom">
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
        )}

        {(user.role === 'admin' || user.role === 'agent') && customerId && (
          <div className="dashboard-form-grid section-margin-bottom">
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
        )}

        {user.role === 'admin' && customerHistory && (
          <div className="surface-card surface-card--compact section-margin-bottom">
            <div className="surface-card__body">
              <div className="section-eyebrow">{t('loans.servicing.history.eyebrow')}</div>
              <div className="summary-grid section-margin-bottom">
                <div className="detail-card"><div className="detail-card__label">{t('loans.servicing.history.loans')}</div><div className="detail-card__value">{historySegments.loans?.length || 0}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('loans.servicing.history.payments')}</div><div className="detail-card__value detail-card__value--success">{historySegments.payments?.length || 0}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('loans.servicing.history.documents')}</div><div className="detail-card__value">{historySegments.documents?.length || 0}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('loans.servicing.history.notifications')}</div><div className="detail-card__value detail-card__value--info">{historySegments.notifications?.length || 0}</div></div>
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
                    {historyTimeline.slice(0, 5).map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.eventType.replaceAll('_', ' ')}</td>
                        <td>{entry.entityType}</td>
                        <td>{formatDate(entry.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(user.role === 'admin' || user.role === 'agent') && alerts.length > 0 && (
          <div className="table-wrap section-margin-bottom">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('loans.servicing.tables.alerts.headers.installment')}</th>
                  <th>{t('loans.servicing.tables.alerts.headers.dueDate')}</th>
                  <th className="table-cell-right">{t('loans.servicing.tables.alerts.headers.outstanding')}</th>
                  <th>{t('loans.servicing.tables.alerts.headers.status')}</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>#{alert.installmentNumber}</td>
                    <td>{formatDate(alert.dueDate)}</td>
                    <td className="table-cell-right">{formatCurrency(alert.outstandingAmount)}</td>
                    <td>
                      <div className="inline-action-group">
                        <span>{alert.status}</span>
                        {alert.status === 'active' ? (
                          <Button variant="outline" size="sm" onClick={() => onResolveAlert(loan.id, alert.id)}>
                            {t('loans.servicing.buttons.resolveAlert')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {promises.length > 0 && (
          <div className="table-wrap section-margin-bottom">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('loans.servicing.tables.promises.headers.promisedDate')}</th>
                  <th className="table-cell-right">{t('loans.servicing.tables.promises.headers.amount')}</th>
                  <th>{t('loans.servicing.tables.promises.headers.status')}</th>
                  <th>{t('loans.servicing.tables.promises.headers.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {promises.map((promise) => (
                  <tr key={promise.id}>
                    <td>{formatDate(promise.promisedDate)}</td>
                    <td className="table-cell-right">{formatCurrency(promise.amount)}</td>
                    <td>
                      <div className="inline-action-group">
                        <span>{promise.status}</span>
                        {(user.role === 'admin' || user.role === 'agent') && promise.status === 'pending' ? (
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
                    </td>
                    <td>{promise.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-wrap section-margin-bottom">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('loans.servicing.tables.attachments.headers.attachment')}</th>
                <th>{t('loans.servicing.tables.attachments.headers.category')}</th>
                <th>{t('loans.servicing.tables.attachments.headers.customerVisible')}</th>
                <th className="table-cell-center">{t('loans.servicing.tables.attachments.headers.action')}</th>
              </tr>
            </thead>
            <tbody>
              {attachments.length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">{t('loans.servicing.tables.attachments.empty')}</td></tr>
              ) : (
                attachments.map((attachment) => (
                  <tr key={attachment.id}>
                    <td>{attachment.originalName}</td>
                    <td>{attachment.category || '-'}</td>
                    <td>{attachment.customerVisible ? t('common.values.yes') : t('common.values.no')}</td>
                    <td className="table-cell-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadLoanAttachment(loan.id, attachment.id, attachment.originalName)}
                      >
                        {t('loans.servicing.buttons.download')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {(user.role === 'admin' || user.role === 'agent') && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('loans.servicing.tables.promises.headers.promiseId')}</th>
                  <th>{t('loans.servicing.tables.promises.headers.promisedDate')}</th>
                  <th>{t('loans.servicing.tables.promises.headers.amount')}</th>
                  <th>{t('loans.servicing.tables.promises.headers.status')}</th>
                  <th className="table-cell-center">{t('loans.servicing.tables.promises.headers.action')}</th>
                </tr>
              </thead>
              <tbody>
                {promises.length === 0 ? (
                  <tr><td colSpan="5" className="table-cell-center">{t('loans.servicing.tables.promises.empty')}</td></tr>
                ) : (
                  promises.map((promise) => (
                    <tr key={promise.id}>
                      <td>{promise.id}</td>
                      <td>{formatDate(promise.promisedDate)}</td>
                      <td>{formatCurrency(promise.amount)}</td>
                      <td>{promise.status}</td>
                      <td className="table-cell-center">
                        <Button variant="outline" size="sm" onClick={() => onDownloadPromise(loan.id, promise.id)}>
                          {t('loans.servicing.buttons.downloadPdf')}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('loans.servicing.tables.customerDocuments.headers.document')}</th>
                <th>{t('loans.servicing.tables.customerDocuments.headers.category')}</th>
                <th>{t('loans.servicing.tables.customerDocuments.headers.visible')}</th>
                <th className="table-cell-center">{t('loans.servicing.tables.customerDocuments.headers.action')}</th>
              </tr>
            </thead>
            <tbody>
              {customerDocuments.length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">{t('loans.servicing.tables.customerDocuments.empty')}</td></tr>
              ) : (
                customerDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>{document.originalName}</td>
                    <td>{document.category || '-'}</td>
                    <td>{document.customerVisible ? t('common.values.yes') : t('common.values.no')}</td>
                    <td className="table-cell-center">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
    <section className="surface-card">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">{t('loans.servicing.eyebrow')}</div>
          <div className="section-title">{t('loans.servicing.title')}</div>
          <div className="section-subtitle">{t('loans.servicing.subtitle')}</div>
        </div>
      </div>
      <div className="surface-card__body">
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
      </div>
    </section>
  )
}

export default LoansServicingSection
