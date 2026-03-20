
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { handleApiError } from '../lib/api/errors';
import { downloadFile } from '../lib/api/download';
import { useLoansQuery, useLoanAttachmentsQuery, useLoanCalendarQuery, useLoanPayoffQuoteQuery, useExecutePayoffMutation } from '../hooks/useLoans';
import {
  useCreatePaymentMutation,
  useCreatePartialPaymentMutation,
  useCreateCapitalPaymentMutation,
  useAnnulInstallmentMutation,
  usePaymentsByLoanQuery,
} from '../hooks/usePayments';
import { loanService } from '../services/loanService';

const INSTALLMENT_STATUS_LABELS = {
  pending: 'Pendiente',
  overdue: 'Vencida',
  paid: 'Pagada',
  partial: 'Parcial',
  annulled: 'Anulada',
};

const PAYMENT_TYPE_LABELS = {
  installment: 'Cuota',
  payoff: 'Total',
  partial: 'Parcial',
  capital: 'Capital',
};

const PAYABLE_LOAN_STATUSES = new Set(['approved', 'active', 'defaulted', 'overdue']);

const PAYMENT_TYPES_BY_ROLE = {
  admin: ['partial', 'capital'],
  customer: ['installment', 'partial', 'payoff'],
};

const getPayoffQuoteTotal = (payoffQuote) => Number(
  payoffQuote?.total
  ?? payoffQuote?.totalPayoffAmount
  ?? 0,
);

const buildPaymentPayload = (loanId, amount) => ({
  loanId: Number(loanId),
  amount: Number(amount),
});

// ── Sub-components ────────────────────────────────────────────────────────────

function StatePanel({ icon, title, message, action, loadingState }) {
  return (
    <div className={`state-panel${loadingState ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );
}

function PaymentRow({ payment }) {
  return (
    <tr>
      <td><span className="table-id-pill">#{payment.id}</span></td>
      <td>Loan #{payment.loanId}</td>
      <td className="table-cell-right">₹{payment.amount}</td>
      <td>{PAYMENT_TYPE_LABELS[payment.paymentType] || payment.paymentType}</td>
      <td className="table-cell-center">
        {new Date(payment.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
      </td>
      <td>
        <span className={`status-badge status-badge--${payment.status === 'annulled' ? 'danger' : payment.status === 'completed' ? 'success' : 'default'}`}>
          {payment.status === 'annulled' ? 'Anulada' : payment.status === 'completed' ? 'Completado' : payment.status}
        </span>
      </td>
    </tr>
  );
}

function InstallmentRow({ entry, canAnnul, canAnnulThisInstallment, onAnnul, isAnnulling }) {
  return (
    <tr key={entry.installmentNumber}>
      <td>#{entry.installmentNumber}</td>
      <td>{new Date(entry.dueDate).toLocaleDateString('en-IN')}</td>
      <td className="table-cell-right">₹{Number(entry.outstandingAmount || 0).toFixed(2)}</td>
      <td className="table-cell-center">
        <span className={`status-badge status-badge--${
          entry.status === 'paid' ? 'success' :
          entry.status === 'overdue' ? 'danger' :
          entry.status === 'annulled' ? 'warning' :
          entry.status === 'partial' ? 'info' : 'default'
        }`}>
          {INSTALLMENT_STATUS_LABELS[entry.status] || entry.status}
        </span>
      </td>
      {canAnnul && (
        <td className="table-cell-center">
          {canAnnulThisInstallment && (
            <button
              className="btn btn-danger btn-sm"
              onClick={onAnnul}
              disabled={isAnnulling}
              title="Anular la cuota más próxima"
            >
              Anular
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function AttachmentRow({ attachment, onDownload }) {
  return (
    <tr key={attachment.id}>
      <td>{attachment.originalName}</td>
      <td>{attachment.category || '-'}</td>
      <td>{attachment.customerVisible ? 'Customer' : 'Internal'}</td>
      <td className="table-cell-center">
        <button className="btn btn-outline-primary btn-sm" onClick={onDownload}>
          Download
        </button>
      </td>
    </tr>
  );
}

function PaymentHistory({
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
  if (!formLoanId) {
    return (
        <StatePanel
          icon="📋"
          title="Choose a loan to view history"
          message="Select a payable loan above to load its payment activity and remaining balance."
        />
      );
  }

  if (historyLoading) {
    return (
      <StatePanel
        icon="⏳"
        title="Loading payment history"
        message="Fetching the latest transactions for the selected account."
        loadingState
      />
    );
  }

  if (error) {
    return (
      <StatePanel
        icon="⚠️"
        title="Unable to load payments"
        message={error}
        action={
          <button className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        }
      />
    );
  }

  const hasContent = payments.length > 0 || calendar.length > 0 || attachments.length > 0;

  if (!hasContent) {
    return (
      <StatePanel
        icon="💳"
        title="No payments yet"
        message="Once a payment is recorded for this loan, it will appear here with the most recent transaction first."
      />
    );
  }

  return (
    <div className="dashboard-page-stack" style={{ gap: '1rem' }}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Loan ID</th>
              <th className="table-cell-right">Amount</th>
              <th>Type</th>
              <th className="table-cell-center">Payment date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Installment</th>
              <th>Due date</th>
              <th className="table-cell-right">Outstanding</th>
              <th className="table-cell-center">Status</th>
              {canAnnul && <th className="table-cell-center">Action</th>}
            </tr>
          </thead>
          <tbody>
            {calendar.length === 0 ? (
              <tr><td colSpan={canAnnul ? 5 : 4} className="table-cell-center">No calendar entries available</td></tr>
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
          <div style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            * Solo se puede anular la cuota pendiente o vencida más próxima{nearestCancellableInstallmentNumber ? ` (cuota #${nearestCancellableInstallmentNumber})` : ''}
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Attachment</th>
              <th>Category</th>
              <th>Visibility</th>
              <th className="table-cell-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {attachments.length === 0 ? (
              <tr><td colSpan="4" className="table-cell-center">No customer-visible attachments available</td></tr>
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
}

// ── Reducer for form state ───────────────────────────────────────────────────

const initialFormState = {
  loanId: '',
  amount: '',
  paymentType: 'installment',
  payoffDate: new Date().toISOString().slice(0, 10),
};

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_LOAN':
      return { ...state, loanId: action.loanId, amount: action.amount };
    case 'SET_PAYMENT_TYPE':
      return { ...state, paymentType: action.paymentType };
    case 'SET_PAYOFF_DATE':
      return { ...state, payoffDate: action.payoffDate };
    case 'RESET':
      return initialFormState;
    default:
      return state;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

function Payments({ user }) {
  const isAdmin = user.role === 'admin';
  const isCustomer = user.role === 'customer';
  const allowedPaymentTypes = useMemo(() => PAYMENT_TYPES_BY_ROLE[user.role] || [], [user.role]);
  const canManagePayments = allowedPaymentTypes.length > 0;
  const canAnnul = isAdmin || user.role === 'agent';

  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = React.useState(false);
  const [resolvedAlertMessage, setResolvedAlertMessage] = React.useState('');

  const loansQuery = useLoansQuery({ user });
  const loans = useMemo(() => (
    Array.isArray(loansQuery.data?.data?.loans)
      ? loansQuery.data.data.loans
      : Array.isArray(loansQuery.data?.data)
        ? loansQuery.data.data
        : []
  ), [loansQuery.data]);
  const selectedLoanId = formState.loanId || null;
  const selectedLoan = loans.find((loan) => loan.id === Number(formState.loanId));
  const isSelectedLoanPayable = Boolean(selectedLoan && PAYABLE_LOAN_STATUSES.has(selectedLoan.status));
  const paymentsQuery = usePaymentsByLoanQuery(selectedLoanId, { enabled: Boolean(selectedLoanId) });
  const calendarQuery = useLoanCalendarQuery(selectedLoanId, { enabled: Boolean(selectedLoanId) });
  const attachmentsQuery = useLoanAttachmentsQuery(selectedLoanId, { enabled: Boolean(selectedLoanId) });
  const payoffQuoteQuery = useLoanPayoffQuoteQuery(selectedLoanId, formState.payoffDate, {
    enabled: Boolean(selectedLoanId) && isCustomer && isSelectedLoanPayable,
  });
  const createPaymentMutation = useCreatePaymentMutation(selectedLoanId);
  const createPartialPaymentMutation = useCreatePartialPaymentMutation(selectedLoanId);
  const createCapitalPaymentMutation = useCreateCapitalPaymentMutation(selectedLoanId);
  const annulInstallmentMutation = useAnnulInstallmentMutation(selectedLoanId);
  const executePayoffMutation = useExecutePayoffMutation(user);

  const payments = useMemo(() => (
    Array.isArray(paymentsQuery.data?.data) ? paymentsQuery.data.data : []
  ), [paymentsQuery.data]);
  const calendar = useMemo(() => (
    Array.isArray(calendarQuery.data?.data?.calendar?.entries) ? calendarQuery.data.data.calendar.entries : []
  ), [calendarQuery.data]);
  const attachments = useMemo(() => (
    Array.isArray(attachmentsQuery.data?.data?.attachments) ? attachmentsQuery.data.data.attachments : []
  ), [attachmentsQuery.data]);
  const payableLoans = loans.filter((loan) => PAYABLE_LOAN_STATUSES.has(loan.status));
  const loading = loansQuery.isLoading;
  const historyLoading = paymentsQuery.isLoading || calendarQuery.isLoading || attachmentsQuery.isLoading;
  const submitting = createPaymentMutation.isPending || executePayoffMutation.isPending ||
    createPartialPaymentMutation.isPending || createCapitalPaymentMutation.isPending || annulInstallmentMutation.isPending;
  const nearestCancellableInstallmentNumber = useMemo(
    () => calendar.find((entry) => (
      (entry.status === 'pending' || entry.status === 'overdue')
      && Number(entry.outstandingAmount || 0) > 0
    ))?.installmentNumber ?? null,
    [calendar],
  );

  useEffect(() => {
    if (allowedPaymentTypes.length === 0) {
      return;
    }

    if (!allowedPaymentTypes.includes(formState.paymentType)) {
      dispatch({ type: 'SET_PAYMENT_TYPE', paymentType: allowedPaymentTypes[0] });
    }
  }, [allowedPaymentTypes, formState.paymentType]);

  useEffect(() => {
    if (!formState.loanId) {
      return;
    }

    if (payableLoans.some((loan) => loan.id === Number(formState.loanId))) {
      return;
    }

    dispatch({ type: 'RESET' });
  }, [formState.loanId, payableLoans]);

  const getLoanDetails = useCallback((loanId) => {
    const loan = loans.find((item) => item.id === parseInt(loanId, 10));
    if (!loan) return { emi: '', balance: '' };

    const financialSnapshot = loan.financialSnapshot || {};
    const snapshotInstallmentAmount = Number(financialSnapshot.installmentAmount ?? loan.installmentAmount);
    const snapshotOutstandingBalance = Number(financialSnapshot.outstandingBalance);

    if (Number.isFinite(snapshotInstallmentAmount) && Number.isFinite(snapshotOutstandingBalance)) {
      return {
        emi: snapshotInstallmentAmount.toFixed(2),
        balance: snapshotOutstandingBalance.toFixed(2),
      };
    }

    const principal = parseFloat(loan.amount);
    const rate = parseFloat(loan.interestRate) / 100 / 12;
    const n = parseInt(loan.termMonths, 10);
    const emi = rate === 0 ? principal / n : (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    const paid = payments
      .filter((payment) => payment.loanId === loan.id)
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const totalDue = emi * n;
    const balance = Math.max(0, totalDue - paid);
    const finalBalance = balance < 1 ? 0 : balance;

    return { emi: emi.toFixed(2), balance: finalBalance.toFixed(2) };
  }, [loans, payments]);

  useEffect(() => {
    const sourceError = loansQuery.error
      || (selectedLoanId ? paymentsQuery.error || calendarQuery.error || attachmentsQuery.error : null)
      || (isSelectedLoanPayable ? payoffQuoteQuery.error : null);

    if (!sourceError) {
      return;
    }

    handleApiError(sourceError, setError);
  }, [
    attachmentsQuery.error,
    calendarQuery.error,
    isSelectedLoanPayable,
    loansQuery.error,
    paymentsQuery.error,
    payoffQuoteQuery.error,
    selectedLoanId,
  ]);

  const loanDetails = formState.loanId ? getLoanDetails(formState.loanId) : { emi: '', balance: '' };

  const handleDownloadAttachment = async (attachmentId, fileName) => {
    try {
      await downloadFile({
        loader: () => loanService.downloadLoanAttachment(formState.loanId, attachmentId),
        filename: fileName,
        fallbackFilename: `attachment-${attachmentId}`,
      });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handlePay = async () => {
    setError('');
    setSuccess('');
    setShowSuccessAnimation(false);

    try {
      const previousOverdueCount = calendar.filter((entry) => entry.status === 'overdue').length;
      await createPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      const refreshedCalendar = await calendarQuery.refetch();
      const refreshedEntries = Array.isArray(refreshedCalendar.data?.data?.calendar?.entries) ? refreshedCalendar.data.data.calendar.entries : [];
      const refreshedOverdueCount = refreshedEntries.filter((entry) => entry.status === 'overdue').length;

      setShowSuccessAnimation(true);
      setSuccess('Payment successful!');
      setResolvedAlertMessage(refreshedOverdueCount < previousOverdueCount ? 'Overdue alerts were refreshed after this payment.' : '');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handlePayoff = async () => {
    setError('');
    setSuccess('');

    try {
      const payoffQuote = payoffQuoteQuery.data?.data?.payoffQuote;
      if (!payoffQuote) {
        setError('Payoff quote is not available yet.');
        return;
      }

      const quotedTotal = getPayoffQuoteTotal(payoffQuote);
      if (quotedTotal <= 0) {
        setError('Payoff quote is not available yet.');
        return;
      }

      await executePayoffMutation.mutateAsync({
        loanId: formState.loanId,
        payload: {
          asOfDate: formState.payoffDate,
          quotedTotal,
        },
      });

      setSuccess('Payoff executed successfully.');
      dispatch({ type: 'RESET' });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handlePartialPayment = async () => {
    setError('');
    setSuccess('');

    try {
      await createPartialPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      setShowSuccessAnimation(true);
      setSuccess('Partial payment successful!');
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleCapitalPayment = async () => {
    setError('');
    setSuccess('');

    try {
      await createCapitalPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      setShowSuccessAnimation(true);
      setSuccess('Capital reduction payment successful!');
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleAnnulInstallment = async () => {
    setError('');
    setSuccess('');

    if (!window.confirm('¿Anular la cuota más próxima pendiente? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await annulInstallmentMutation.mutateAsync({ loanId: formState.loanId });
      setSuccess('Cuota anulada correctamente.');
      await calendarQuery.refetch();
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    dispatch({ type: 'SET_FIELD', field: name, value });

    if (name === 'loanId' && value) {
      const details = getLoanDetails(value);
      dispatch({ type: 'SET_LOAN', loanId: value, amount: details.emi });
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (formState.paymentType === 'installment') {
      await handlePay();
      return;
    }

    if (formState.paymentType === 'partial') {
      await handlePartialPayment();
      return;
    }

    if (formState.paymentType === 'capital') {
      await handleCapitalPayment();
      return;
    }

    if (formState.paymentType === 'payoff') {
      await handlePayoff();
    }
  };

  const summaryCards = useMemo(
    () => [
      { label: 'Payable loans', value: payableLoans.length, caption: 'Eligible for payment tracking', tone: 'brand' },
      { label: 'Selected EMI', value: loanDetails.emi ? `₹${loanDetails.emi}` : '—', caption: 'Auto-filled from the active loan', tone: 'success' },
      { label: 'Remaining balance', value: loanDetails.balance ? `₹${loanDetails.balance}` : '—', caption: 'Updated from payment history', tone: 'warning' },
      { label: 'Recorded payments', value: payments.length, caption: 'Transactions loaded in the current view', tone: 'info' },
    ],
    [loanDetails.balance, loanDetails.emi, payableLoans.length, payments.length],
  );

  if (loading) {
    return (
        <StatePanel
          icon="⏳"
          title="Loading payments workspace"
          message="Preparing payable loans, balances, and the latest repayment history."
          loadingState
        />
      );
  }

  return (
    <div className="dashboard-page-stack">
      <section className="surface-card surface-card--hero">
        <div className="surface-card__header">
          <div>
            <div className="section-eyebrow">Payments workspace</div>
            <div className="section-title">Track EMI activity with one shared payment surface</div>
            <div className="section-subtitle">
              Summary cards, repayment form controls, and history states all follow the same dashboard language used across the authenticated experience.
            </div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="metric-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className={`metric-card metric-card--${card.tone}`}>
                <div className="metric-card__label">{card.label}</div>
                <div className="metric-card__value">{card.value}</div>
                <div className="metric-card__caption">{card.caption}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Payment form</div>
            <div className="section-title">Make or review a payment</div>
            <div className="section-subtitle">
              Choose a loan, review the EMI and outstanding balance, then submit if your role has payment access.
            </div>
          </div>
        </div>
        <div className="surface-card__body">
          {error && !formState.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}

          {payableLoans.length === 0 ? (
            <StatePanel
              icon="📭"
              title="No payable loans available"
              message="Payments can begin once a loan reaches an approved or active servicing state. Return to Loans to review current statuses."
            />
          ) : (
            <>
              <form onSubmit={handleFormSubmit} className="dashboard-form-grid">
                <label className="field-group loan-select-wrap">
                  <span className="field-label">Loan</span>
                  <select className="field-control" name="loanId" value={formState.loanId} onChange={handleFormChange} required>
                    <option value="" disabled>Select loan</option>
                    {payableLoans.map((loan) => (
                      <option key={loan.id} value={loan.id}>Loan #{loan.id} — ₹{loan.amount} ({loan.status})</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Payment type</span>
                  <select
                    className="field-control"
                    value={formState.paymentType}
                    onChange={(e) => dispatch({ type: 'SET_PAYMENT_TYPE', paymentType: e.target.value })}
                    disabled={!canManagePayments}
                  >
                    {allowedPaymentTypes.includes('installment') && <option value="installment">Cuota regular</option>}
                    {allowedPaymentTypes.includes('partial') && <option value="partial">Pago parcial</option>}
                    {allowedPaymentTypes.includes('capital') && <option value="capital">Reducción de capital</option>}
                    {allowedPaymentTypes.includes('payoff') && <option value="payoff">Liquidar (cierre total)</option>}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Payment amount</span>
                  <input
                    id="payment-amount"
                    className="field-control"
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder={formState.paymentType === 'partial' ? 'Monto libre' : 'Amount'}
                    value={formState.amount}
                    onChange={handleFormChange}
                    required
                    disabled={!canManagePayments || (formState.loanId && loanDetails.balance === '0.00')}
                  />
                </label>

                <div className="field-group">
                  <span className="field-label">Submit</span>
                  {formState.paymentType === 'installment' && (
                    <button className="btn btn-success" type="submit" disabled={(formState.loanId && loanDetails.balance === '0.00') || submitting || !isCustomer}>
                      {submitting ? 'Processing…' : 'Pagar cuota'}
                    </button>
                  )}
                  {formState.paymentType === 'partial' && (
                    <button className="btn btn-info" type="button" onClick={handlePartialPayment} disabled={!formState.loanId || submitting || !canManagePayments}>
                      {submitting ? 'Processing…' : 'Pago parcial'}
                    </button>
                  )}
                  {formState.paymentType === 'capital' && isAdmin && (
                    <button className="btn btn-warning" type="button" onClick={handleCapitalPayment} disabled={!formState.loanId || submitting}>
                      {submitting ? 'Processing…' : 'Reducir capital'}
                    </button>
                  )}
                  {formState.paymentType === 'payoff' && (
                    <button type="button" className="btn btn-outline-primary" onClick={handlePayoff} disabled={submitting || !isCustomer}>
                      {submitting ? 'Processing…' : 'Liquidar'}
                    </button>
                  )}
                </div>
              </form>

              {formState.loanId && (
                <div className="summary-grid" style={{ marginTop: '1rem' }}>
                  <div className="detail-card"><div className="detail-card__label">Selected loan</div><div className="detail-card__value">Loan #{selectedLoan?.id || '—'}</div></div>
                  <div className="detail-card"><div className="detail-card__label">EMI amount</div><div className="detail-card__value detail-card__value--success">₹{loanDetails.emi}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Remaining balance</div><div className="detail-card__value detail-card__value--warning">₹{loanDetails.balance}</div></div>
                </div>
              )}

              {isCustomer && formState.loanId && payoffQuoteQuery.data?.data?.payoffQuote && (
                <div className="surface-card surface-card--compact" style={{ marginTop: '1rem' }}>
                  <div className="surface-card__body">
                    <div className="dashboard-form-grid">
                      <label className="field-group">
                        <span className="field-label">Payoff date</span>
                        <input
                          id="payoff-date"
                          className="field-control"
                          type="date"
                          value={formState.payoffDate}
                          onChange={(event) => dispatch({ type: 'SET_PAYOFF_DATE', payoffDate: event.target.value })}
                        />
                      </label>
                      <div className="detail-card">
                        <div className="detail-card__label">Quoted payoff</div>
                        <div className="detail-card__value detail-card__value--warning">₹{getPayoffQuoteTotal(payoffQuoteQuery.data.data.payoffQuote).toFixed(2)}</div>
                      </div>
                      <div className="field-group">
                        <span className="field-label">Close loan</span>
                        <button type="button" className="btn btn-outline-primary" onClick={handlePayoff} disabled={submitting}>
                          Execute payoff
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

               {isAdmin && (
                 <div className="inline-message inline-message--success">ℹ️ Admins can register partial payments and capital reductions here. Regular installments and payoff remain customer-only.</div>
               )}
               {!isAdmin && !isCustomer && (
                 <div className="inline-message inline-message--error">ℹ️ Your role can inspect balances, installments, and history here, but cannot register payments.</div>
               )}
              {formState.loanId && loanDetails.balance === '0.00' && <div className="inline-message inline-message--success">✅ This loan is fully paid.</div>}
              {resolvedAlertMessage && <div className="inline-message inline-message--success">✅ {resolvedAlertMessage}</div>}
              {error && formState.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}
              {success && <div className="inline-message inline-message--success">✅ {success}</div>}
            </>
          )}
        </div>
      </section>

      {showSuccessAnimation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(6px)' }}>
          <div className="surface-card" style={{ width: 'min(420px, 92vw)', padding: '2rem', textAlign: 'center' }}>
            <DotLottieReact src="https://lottie.host/9701ac69-f35b-46ed-9f46-e58f84ffa77c/QUVXQRcA8Y.lottie" style={{ width: '200px', height: '200px', margin: '0 auto' }} loop={false} autoplay />
            <div className="section-title" style={{ fontSize: '1.25rem' }}>Payment successful</div>
          </div>
        </div>
      )}

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Payment history</div>
            <div className="section-title">Recent transactions</div>
            <div className="section-subtitle">View transaction history within the dashboard layout so refresh, error, and empty states stay consistent.</div>
          </div>
        </div>
        <div className="surface-card__body">
          <PaymentHistory
            formLoanId={formState.loanId}
            payments={payments}
            calendar={calendar}
            attachments={attachments}
            canAnnul={canAnnul}
            historyLoading={historyLoading}
            error={error}
            onRetry={() => {
              paymentsQuery.refetch();
              calendarQuery.refetch();
              attachmentsQuery.refetch();
            }}
            onDownloadAttachment={handleDownloadAttachment}
            onAnnulInstallment={handleAnnulInstallment}
            annulMutation={annulInstallmentMutation}
            nearestCancellableInstallmentNumber={nearestCancellableInstallmentNumber}
          />
        </div>
      </section>
    </div>
  );
}

export default Payments;
