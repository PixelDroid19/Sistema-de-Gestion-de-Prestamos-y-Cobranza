import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PaginationControls from '@/components/ui/PaginationControls';
import StatePanel from '@/components/ui/StatePanel';
import DataTable from '@/components/ui/workspace/DataTable';
import EmptyState from '@/components/ui/workspace/EmptyState';
import FilterBar from '@/components/ui/workspace/FilterBar';
import FormSection from '@/components/ui/workspace/FormSection';
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard';
import WorkspaceCalendar from '@/components/widgets/WorkspaceCalendar';
import {
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/features/payments/paymentsWorkspace.constants';

const PAYMENT_DATE_FORMAT = { year: 'numeric', month: 'short', day: 'numeric' }

function formatPaymentDate(value, options = PAYMENT_DATE_FORMAT) {
  return new Date(value).toLocaleDateString('en-IN', options)
}

function formatInstallmentDate(value) {
  return new Date(value).toLocaleDateString('en-IN')
}

function getPaymentStatusVariant(status) {
  if (status === 'annulled') return 'danger'
  if (status === 'completed') return 'success'
  return 'neutral'
}

function getInstallmentStatusVariant(status) {
  if (status === 'paid') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'annulled') return 'warning'
  if (status === 'partial') return 'primary'
  return 'neutral'
}

function PaymentsHistorySection({
  formLoanId,
  payments,
  calendar,
  attachments,
  selectedPaymentId,
  paymentDocuments,
  paymentDocumentDraft,
  canManagePaymentDocuments,
  canAnnul,
  historyLoading,
  error,
  onRetry,
  onDownloadAttachment,
  onSelectPayment,
  onPaymentDocumentDraftChange,
  onUploadPaymentDocument,
  onDownloadPaymentDocument,
  onUpdatePaymentMetadata,
  onAnnulInstallment,
  annulMutation,
  nearestCancellableInstallmentNumber,
  paymentsPagination,
  onPaymentsPageChange,
}) {
  const { t } = useTranslation()
  const hasContent = payments.length > 0 || calendar.length > 0 || attachments.length > 0

  const calendarEvents = useMemo(() => (
    calendar.map((entry) => ({
      id: `installment-${entry.installmentNumber}`,
      title: `${t('payments.history.calendar.eventTitle', { number: entry.installmentNumber })} · ${t(INSTALLMENT_STATUS_LABELS[entry.status] || entry.status)} · ₹${Number(entry.outstandingAmount || 0).toFixed(2)}`,
      start: new Date(entry.dueDate),
      end: new Date(entry.dueDate),
      allDay: true,
    }))
  ), [calendar, t])

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [payments],
  )

  const paymentColumns = useMemo(() => [
      {
        key: 'paymentId',
        header: t('payments.history.headers.paymentId'),
        render: (payment) => <span className="table-id-pill">#{payment.id}</span>,
      },
      {
        key: 'loanId',
        header: t('payments.history.headers.loanId'),
        render: (payment) => `Loan #${payment.loanId}`,
      },
      {
        key: 'amount',
        header: t('payments.history.headers.amount'),
        cellClassName: 'table-cell-right',
        render: (payment) => `₹${payment.amount}`,
      },
      {
        key: 'type',
        header: t('payments.history.headers.type'),
        render: (payment) => t(PAYMENT_TYPE_LABELS[payment.paymentType] || payment.paymentType),
      },
      {
        key: 'method',
        header: t('payments.history.headers.method'),
        render: (payment) => payment.paymentMetadata?.method || '—',
      },
      {
        key: 'observation',
        header: t('payments.history.headers.observation'),
        render: (payment) => payment.paymentMetadata?.observation || payment.paymentMetadata?.description || '—',
      },
      {
        key: 'date',
        header: t('payments.history.headers.paymentDate'),
        cellClassName: 'table-cell-center',
        render: (payment) => formatPaymentDate(payment.createdAt),
      },
      {
        key: 'status',
        header: t('payments.history.headers.status'),
        render: (payment) => (
          <Badge variant={getPaymentStatusVariant(payment.status)}>
            {payment.status === 'annulled' ? t('payments.statuses.annulled') : payment.status === 'completed' ? t('payments.statuses.completed') : payment.status}
          </Badge>
        ),
      },
      {
        key: 'action',
        header: t('payments.history.headers.action'),
        render: (payment) => (
          <Button variant="outline" size="sm" onClick={() => onUpdatePaymentMetadata(payment)}>
            {t('common.actions.edit')}
          </Button>
        ),
      },
    ], [onUpdatePaymentMetadata, t])

  const installmentColumns = useMemo(() => [
      { key: 'installmentNumber', header: t('payments.history.headers.installment'), render: (entry) => `#${entry.installmentNumber}` },
      { key: 'dueDate', header: t('payments.history.headers.dueDate'), render: (entry) => formatInstallmentDate(entry.dueDate) },
      { key: 'outstandingAmount', header: t('payments.history.headers.outstanding'), cellClassName: 'table-cell-right', render: (entry) => `₹${Number(entry.outstandingAmount || 0).toFixed(2)}` },
      {
        key: 'status',
        header: t('payments.history.headers.status'),
        cellClassName: 'table-cell-center',
        render: (entry) => (
          <Badge variant={getInstallmentStatusVariant(entry.status)}>
            {t(INSTALLMENT_STATUS_LABELS[entry.status] || entry.status)}
          </Badge>
        ),
      },
      canAnnul && {
        key: 'action',
        header: t('payments.history.headers.action'),
        cellClassName: 'table-cell-center',
        render: (entry) => (
          nearestCancellableInstallmentNumber === entry.installmentNumber ? (
            <Button
              variant="danger"
              size="sm"
              onClick={onAnnulInstallment}
              disabled={annulMutation.isPending}
              title={t('payments.history.annulTitle')}
            >
              {t('payments.history.annul')}
            </Button>
          ) : null
        ),
      },
    ].filter(Boolean), [annulMutation.isPending, canAnnul, nearestCancellableInstallmentNumber, onAnnulInstallment, t])

  const attachmentColumns = useMemo(() => [
      { key: 'originalName', header: t('payments.history.headers.attachment') },
      { key: 'category', header: t('payments.history.headers.category'), render: (attachment) => attachment.category || '-' },
      { key: 'visibility', header: t('payments.history.headers.visibility'), render: (attachment) => attachment.customerVisible ? t('payments.history.visibilityCustomer') : t('payments.history.visibilityInternal') },
      {
        key: 'action',
        header: t('payments.history.headers.action'),
        cellClassName: 'table-cell-center',
        render: (attachment) => <Button variant="outline" size="sm" onClick={() => onDownloadAttachment(attachment.id, attachment.originalName)}>{t('common.actions.download')}</Button>,
      },
    ], [onDownloadAttachment, t])

  const paymentDocumentColumns = useMemo(() => [
      { key: 'originalName', header: t('payments.history.headers.attachment') },
      { key: 'category', header: t('payments.history.headers.category'), render: (document) => document.category || '-' },
      { key: 'visibility', header: t('payments.history.headers.visibility'), render: (document) => document.customerVisible ? t('payments.history.visibilityCustomer') : t('payments.history.visibilityInternal') },
      {
        key: 'action',
        header: t('payments.history.headers.action'),
        cellClassName: 'table-cell-center',
        render: (document) => <Button variant="outline" size="sm" onClick={() => onDownloadPaymentDocument(document.id, document.originalName)}>{t('common.actions.download')}</Button>,
      },
    ], [onDownloadPaymentDocument, t])

  let content = (
    <StatePanel
      icon="📋"
      title={t('payments.history.chooseTitle')}
      message={t('payments.history.chooseMessage')}
    />
  )

  if (formLoanId && historyLoading) {
    content = (
      <StatePanel
        icon="⏳"
        title={t('payments.history.loadingTitle')}
        message={t('payments.history.loadingMessage')}
        loadingState
      />
    )
  } else if (formLoanId && error) {
    content = (
      <StatePanel
        icon="⚠️"
        title={t('payments.history.errorTitle')}
        message={error}
        action={<Button onClick={onRetry}>{t('common.actions.tryAgain')}</Button>}
      />
    )
  } else if (formLoanId && !hasContent) {
    content = (
      <StatePanel
        icon="💳"
        title={t('payments.history.emptyTitle')}
        message={t('payments.history.emptyMessage')}
      />
    )
  } else if (formLoanId) {
    content = (
      <div className="dashboard-page-stack section-stack--compact">
        <FilterBar>
          <PaginationControls
            pagination={paymentsPagination}
            isPending={historyLoading}
            onPageChange={onPaymentsPageChange}
          />
        </FilterBar>

        <FormSection title={t('payments.history.headers.paymentId')}>
          <DataTable
            columns={paymentColumns}
            rows={sortedPayments}
            rowKey="id"
            emptyState={<EmptyState icon="💳" title={t('payments.history.emptyTitle')} description={t('payments.history.emptyMessage')} />}
          />
        </FormSection>

        <FormSection title={t('payments.history.headers.installment')}>
          <DataTable
            columns={installmentColumns}
            rows={calendar}
            rowKey="installmentNumber"
            emptyState={<EmptyState icon="📅" title={t('payments.history.noCalendar')} />}
          />
          {canAnnul && (
            <div className="content-note">
              {t('payments.history.nearestAnnulNote')}{nearestCancellableInstallmentNumber ? ` ${t('payments.history.nearestAnnulSuffix', { number: nearestCancellableInstallmentNumber })}` : ''}
            </div>
          )}
        </FormSection>

        <FormSection title={t('payments.history.calendar.title')}>
          {calendarEvents.length > 0 ? (
            <WorkspaceCalendar
              events={calendarEvents}
              defaultView="month"
              views={['month', 'agenda']}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 420 }}
            />
          ) : (
            <EmptyState icon="🗓️" title={t('payments.history.noCalendar')} description={t('payments.history.calendar.emptyMessage')} />
          )}
        </FormSection>

        <FormSection title={t('payments.history.headers.attachment')}>
          <DataTable
            columns={attachmentColumns}
            rows={attachments}
            rowKey="id"
            emptyState={<EmptyState icon="📎" title={t('payments.history.noAttachments')} />}
          />
        </FormSection>

        <WorkspaceCard compact className="surface-card surface-card--compact">
            <div className="dashboard-form-grid section-margin-bottom">
              <label className="field-group">
                <span className="field-label">{t('payments.history.fields.payment')}</span>
                <select className="field-control" value={selectedPaymentId || ''} onChange={(event) => onSelectPayment(event.target.value)}>
                  {payments.map((payment) => (
                    <option key={payment.id} value={payment.id}>#{payment.id} - ₹{payment.amount}</option>
                  ))}
                </select>
              </label>
              {canManagePaymentDocuments && (
                <>
                  <label className="field-group">
                    <span className="field-label">{t('payments.history.fields.paymentDocument')}</span>
                    <input className="field-control" type="file" onChange={(event) => onPaymentDocumentDraftChange('file', event.target.files?.[0] || null)} />
                  </label>
                  <label className="field-group">
                    <span className="field-label">{t('payments.history.headers.category')}</span>
                    <input className="field-control" value={paymentDocumentDraft.category || ''} onChange={(event) => onPaymentDocumentDraftChange('category', event.target.value)} />
                  </label>
                  <label className="field-group">
                    <span className="field-label">{t('loans.servicing.fields.description')}</span>
                    <input className="field-control" value={paymentDocumentDraft.description || ''} onChange={(event) => onPaymentDocumentDraftChange('description', event.target.value)} />
                  </label>
                  <label className="field-group field-group--centered">
                    <span className="field-label">{t('loans.servicing.fields.customerVisible')}</span>
                    <input type="checkbox" checked={Boolean(paymentDocumentDraft.customerVisible)} onChange={(event) => onPaymentDocumentDraftChange('customerVisible', event.target.checked)} />
                  </label>
                  <div className="field-group">
                    <span className="field-label">{t('payments.history.headers.action')}</span>
                    <Button type="button" onClick={onUploadPaymentDocument}>{t('payments.history.buttons.uploadDocument')}</Button>
                  </div>
                </>
              )}
            </div>

            <DataTable
              columns={paymentDocumentColumns}
              rows={paymentDocuments}
              rowKey="id"
              emptyState={<EmptyState icon="🧾" title={t('payments.history.noPaymentDocuments')} />}
            />
        </WorkspaceCard>
      </div>
    )
  }

  return (
    <WorkspaceCard
      className="surface-card"
      eyebrow={t('payments.history.eyebrow')}
      title={t('payments.history.title')}
      subtitle={t('payments.history.subtitle')}
    >
      {content}
    </WorkspaceCard>
  )
}

export default PaymentsHistorySection;
