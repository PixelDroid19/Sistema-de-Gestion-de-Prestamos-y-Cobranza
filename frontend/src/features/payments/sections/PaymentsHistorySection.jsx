import React from 'react';
import { useTranslation } from 'react-i18next';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatePanel from '@/components/ui/StatePanel';
import {
  INSTALLMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/features/payments/paymentsWorkspace.constants';

function PaymentRow({ payment }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td><span className="table-id-pill">#{payment.id}</span></td>
      <td>Loan #{payment.loanId}</td>
      <td className="table-cell-right">₹{payment.amount}</td>
      <td>{t(PAYMENT_TYPE_LABELS[payment.paymentType] || payment.paymentType)}</td>
      <td className="table-cell-center">
        {new Date(payment.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
      </td>
      <td>
        <Badge variant={payment.status === 'annulled' ? 'danger' : payment.status === 'completed' ? 'success' : 'neutral'}>
          {payment.status === 'annulled' ? t('payments.statuses.annulled') : payment.status === 'completed' ? t('payments.statuses.completed') : payment.status}
        </Badge>
      </td>
    </tr>
  );
}

function InstallmentRow({ entry, canAnnul, canAnnulThisInstallment, onAnnul, isAnnulling }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td>#{entry.installmentNumber}</td>
      <td>{new Date(entry.dueDate).toLocaleDateString('en-IN')}</td>
      <td className="table-cell-right">₹{Number(entry.outstandingAmount || 0).toFixed(2)}</td>
      <td className="table-cell-center">
        <Badge variant={
          entry.status === 'paid' ? 'success' :
          entry.status === 'overdue' ? 'danger' :
          entry.status === 'annulled' ? 'warning' :
          entry.status === 'partial' ? 'primary' : 'neutral'
        }>
          {t(INSTALLMENT_STATUS_LABELS[entry.status] || entry.status)}
        </Badge>
      </td>
      {canAnnul && (
        <td className="table-cell-center">
          {canAnnulThisInstallment && (
            <Button
              variant="danger"
              size="sm"
              onClick={onAnnul}
              disabled={isAnnulling}
              title={t('payments.history.annulTitle')}
            >
              {t('payments.history.annul')}
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}

function AttachmentRow({ attachment, onDownload }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td>{attachment.originalName}</td>
      <td>{attachment.category || '-'}</td>
      <td>{attachment.customerVisible ? t('payments.history.visibilityCustomer') : t('payments.history.visibilityInternal')}</td>
      <td className="table-cell-center">
        <Button variant="outline" size="sm" onClick={onDownload}>{t('common.actions.download')}</Button>
      </td>
    </tr>
  );
}

function PaymentsHistorySection({
  formLoanId,
  payments,
  calendar,
  attachments,
  canAnnul,
  historyLoading,
  error,
  onRetry,
  onDownloadAttachment,
  onAnnulInstallment,
  annulMutation,
  nearestCancellableInstallmentNumber,
}) {
  const { t } = useTranslation()
  const renderContent = () => {
    if (!formLoanId) {
      return (
          <StatePanel
            icon="📋"
            title={t('payments.history.chooseTitle')}
            message={t('payments.history.chooseMessage')}
          />
      );
    }

    if (historyLoading) {
      return (
          <StatePanel
            icon="⏳"
            title={t('payments.history.loadingTitle')}
            message={t('payments.history.loadingMessage')}
            loadingState
          />
      );
    }

    if (error) {
      return (
          <StatePanel
            icon="⚠️"
            title={t('payments.history.errorTitle')}
            message={error}
            action={<Button onClick={onRetry}>{t('common.actions.tryAgain')}</Button>}
          />
      );
    }

    const hasContent = payments.length > 0 || calendar.length > 0 || attachments.length > 0;

    if (!hasContent) {
      return (
          <StatePanel
            icon="💳"
            title={t('payments.history.emptyTitle')}
            message={t('payments.history.emptyMessage')}
          />
      );
    }

    return (
      <div className="dashboard-page-stack section-stack--compact">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.history.headers.paymentId')}</th>
                <th>{t('payments.history.headers.loanId')}</th>
                <th className="table-cell-right">{t('payments.history.headers.amount')}</th>
                <th>{t('payments.history.headers.type')}</th>
                <th className="table-cell-center">{t('payments.history.headers.paymentDate')}</th>
                <th>{t('payments.history.headers.status')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.history.headers.installment')}</th>
                <th>{t('payments.history.headers.dueDate')}</th>
                <th className="table-cell-right">{t('payments.history.headers.outstanding')}</th>
                <th className="table-cell-center">{t('payments.history.headers.status')}</th>
                {canAnnul && <th className="table-cell-center">{t('payments.history.headers.action')}</th>}
              </tr>
            </thead>
            <tbody>
              {calendar.length === 0 ? (
                <tr><td colSpan={canAnnul ? 5 : 4} className="table-cell-center">{t('payments.history.noCalendar')}</td></tr>
              ) : (
                calendar.map((entry) => (
                  <InstallmentRow
                    key={entry.installmentNumber}
                    entry={entry}
                    canAnnul={canAnnul}
                    canAnnulThisInstallment={nearestCancellableInstallmentNumber === entry.installmentNumber}
                    onAnnul={onAnnulInstallment}
                    isAnnulling={annulMutation.isPending}
                  />
                ))
              )}
            </tbody>
          </table>
          {canAnnul && (
            <div className="content-note">
              {t('payments.history.nearestAnnulNote')}{nearestCancellableInstallmentNumber ? ` ${t('payments.history.nearestAnnulSuffix', { number: nearestCancellableInstallmentNumber })}` : ''}
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.history.headers.attachment')}</th>
                <th>{t('payments.history.headers.category')}</th>
                <th>{t('payments.history.headers.visibility')}</th>
                <th className="table-cell-center">{t('payments.history.headers.action')}</th>
              </tr>
            </thead>
            <tbody>
              {attachments.length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">{t('payments.history.noAttachments')}</td></tr>
              ) : (
                attachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.id}
                    attachment={attachment}
                    onDownload={() => onDownloadAttachment(attachment.id, attachment.originalName)}
                  />
                ))
              )}
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
          <div className="section-eyebrow">{t('payments.history.eyebrow')}</div>
          <div className="section-title">{t('payments.history.title')}</div>
          <div className="section-subtitle">{t('payments.history.subtitle')}</div>
        </div>
      </div>
      <div className="surface-card__body">{renderContent()}</div>
    </section>
  );
}

export default PaymentsHistorySection;
