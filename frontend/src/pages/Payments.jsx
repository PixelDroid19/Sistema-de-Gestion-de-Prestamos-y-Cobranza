import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { api, handleApiError, handleTokenExpiration } from '../utils/api';

function Payments({ user }) {
  const [payments, setPayments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [form, setForm] = useState({ loanId: '', amount: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [resolvedAlertMessage, setResolvedAlertMessage] = useState('');

  const handleDownloadAttachment = async (attachmentId, fileName) => {
    try {
      const blob = await api.downloadLoanAttachment(form.loanId, attachmentId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || `attachment-${attachmentId}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const getLoanDetails = useCallback((loanId) => {
    const loan = loans.find((item) => item.id === parseInt(loanId, 10));
    if (!loan) return { emi: '', balance: '' };

    const principal = parseFloat(loan.amount);
    const rate = parseFloat(loan.interestRate) / 100 / 12;
    const n = parseInt(loan.termMonths, 10);
    const emi =
      rate === 0
        ? principal / n
        : (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    const paid = payments
      .filter((payment) => payment.loanId === loan.id)
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const totalDue = emi * n;
    const balance = Math.max(0, totalDue - paid);
    const finalBalance = balance < 1 ? 0 : balance;

    return { emi: emi.toFixed(2), balance: finalBalance.toFixed(2) };
  }, [loans, payments]);

  const loadLoans = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      let data;
      if (user.role === 'customer') {
        data = await api.getLoansByCustomer(user.id);
      } else if (user.role === 'agent') {
        data = await api.getLoansByAgent(user.id);
      } else {
        data = await api.getAllLoans();
      }

      setLoans(Array.isArray(data.data.loans) ? data.data.loans : []);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadPayments = async (loanId) => {
    if (!loanId) {
      setPayments([]);
      setCalendar([]);
      setAttachments([]);
      return;
    }

    setHistoryLoading(true);
    setError('');

    try {
      const [paymentData, calendarData, attachmentData] = await Promise.all([
        api.getPaymentsByLoan(loanId),
        api.getLoanCalendar(loanId),
        api.getLoanAttachments(loanId),
      ]);
      setPayments(Array.isArray(paymentData.data) ? paymentData.data : []);
      setCalendar(Array.isArray(calendarData?.data?.calendar?.entries) ? calendarData.data.calendar.entries : []);
      setAttachments(Array.isArray(attachmentData?.data?.attachments) ? attachmentData.data.attachments : []);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
      setPayments([]);
      setCalendar([]);
      setAttachments([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    if (!form.loanId) return;
    const { emi } = getLoanDetails(form.loanId);
    setForm((current) => ({ ...current, amount: emi }));
  }, [form.loanId, loans, getLoanDetails]);

  useEffect(() => {
    loadPayments(form.loanId);
  }, [form.loanId]);

  const handlePay = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    setShowSuccessAnimation(false);

    try {
      await api.createPayment({ loanId: form.loanId, amount: form.amount });
      const previousOverdueCount = calendar.filter((entry) => entry.status === 'overdue').length;
      setShowSuccessAnimation(true);
      setSuccess('Payment successful!');
      await loadPayments(form.loanId);
      setTimeout(() => {
        setResolvedAlertMessage((current) => current);
      }, 0);

      const refreshedCalendar = await api.getLoanCalendar(form.loanId);
      const refreshedEntries = Array.isArray(refreshedCalendar?.data?.calendar?.entries) ? refreshedCalendar.data.calendar.entries : [];
      setCalendar(refreshedEntries);
      const refreshedOverdueCount = refreshedEntries.filter((entry) => entry.status === 'overdue').length;
      if (refreshedOverdueCount < previousOverdueCount) {
        setResolvedAlertMessage('Overdue alerts were refreshed after this payment.');
      } else {
        setResolvedAlertMessage('');
      }

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const selectedLoan = loans.find((loan) => loan.id === parseInt(form.loanId, 10));
  const approvedLoans = loans.filter((loan) => loan.status === 'approved');
  const loanDetails = form.loanId ? getLoanDetails(form.loanId) : { emi: '', balance: '' };

  const summaryCards = useMemo(
    () => [
      {
        label: 'Approved loans',
        value: approvedLoans.length,
        caption: 'Available for payment tracking',
        tone: 'brand',
      },
      {
        label: 'Selected EMI',
        value: loanDetails.emi ? `₹${loanDetails.emi}` : '—',
        caption: 'Auto-filled from the active loan',
        tone: 'success',
      },
      {
        label: 'Remaining balance',
        value: loanDetails.balance ? `₹${loanDetails.balance}` : '—',
        caption: 'Updated from payment history',
        tone: 'warning',
      },
      {
        label: 'Recorded payments',
        value: payments.length,
        caption: 'Transactions loaded in the current view',
        tone: 'info',
      },
    ],
    [approvedLoans.length, loanDetails.balance, loanDetails.emi, payments.length],
  );

  const renderStatePanel = ({ icon, title, message, action, loadingState = false }) => (
    <div className={`state-panel${loadingState ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );

  const renderHistory = () => {
    if (!form.loanId) {
      return renderStatePanel({
        icon: '📋',
        title: 'Choose a loan to view history',
        message: 'Select an approved loan above to load its payment activity and remaining balance.',
      });
    }

    if (historyLoading) {
      return renderStatePanel({
        icon: '⏳',
        title: 'Loading payment history',
        message: 'Fetching the latest transactions for the selected account.',
        loadingState: true,
      });
    }

    if (error) {
      return renderStatePanel({
        icon: '⚠️',
        title: 'Unable to load payments',
        message: error,
        action: (
          <button className="btn btn-primary" onClick={() => loadPayments(form.loanId)}>
            Try again
          </button>
        ),
      });
    }

    if (!payments.length) {
      return renderStatePanel({
        icon: '💳',
        title: 'No payments yet',
        message: 'Once a payment is recorded for this loan, it will appear here with the most recent transaction first.',
      });
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
                <th className="table-cell-center">Payment date</th>
              </tr>
            </thead>
            <tbody>
              {payments
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <span className="table-id-pill">#{payment.id}</span>
                    </td>
                    <td>Loan #{payment.loanId}</td>
                    <td className="table-cell-right">₹{payment.amount}</td>
                    <td className="table-cell-center">
                      {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
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
              </tr>
            </thead>
            <tbody>
              {calendar.length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">No calendar entries available</td></tr>
              ) : (
                calendar.map((entry) => (
                  <tr key={entry.installmentNumber}>
                    <td>#{entry.installmentNumber}</td>
                    <td>{new Date(entry.dueDate).toLocaleDateString('en-IN')}</td>
                    <td className="table-cell-right">₹{Number(entry.outstandingAmount || 0).toFixed(2)}</td>
                    <td className="table-cell-center">{entry.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                  <tr key={attachment.id}>
                    <td>{attachment.originalName}</td>
                    <td>{attachment.category || '-'}</td>
                    <td>{attachment.customerVisible ? 'Customer' : 'Internal'}</td>
                    <td className="table-cell-center">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => handleDownloadAttachment(attachment.id, attachment.originalName)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return renderStatePanel({
      icon: '⏳',
      title: 'Loading payments workspace',
      message: 'Preparing approved loans, balances, and the latest repayment history.',
      loadingState: true,
    });
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
          {error && !form.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}

          {approvedLoans.length === 0 ? (
            renderStatePanel({
              icon: '📭',
              title: 'No approved loans available',
              message: 'Payments can begin after a loan is approved. Return to Loans to review current statuses.',
            })
          ) : (
            <>
              <form onSubmit={handlePay} className="dashboard-form-grid">
                <label className="field-group loan-select-wrap">
                  <span className="field-label">Approved loan</span>
                  <select className="field-control" name="loanId" value={form.loanId} onChange={handleFormChange} required>
                    <option value="" disabled>
                      Select loan
                    </option>
                    {approvedLoans.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        Loan #{loan.id} — ₹{loan.amount}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Payment amount</span>
                  <input
                    className="field-control"
                    name="amount"
                    placeholder="Amount"
                    value={form.amount}
                    onChange={handleFormChange}
                    required
                    disabled={form.loanId && loanDetails.balance === '0.00'}
                  />
                </label>

                <div className="field-group">
                  <span className="field-label">Submit</span>
                  <button
                    className="btn btn-success"
                    type="submit"
                    disabled={
                       (form.loanId && loanDetails.balance === '0.00') ||
                       submitting ||
                       user.role === 'admin' ||
                       user.role === 'agent' ||
                       user.role === 'socio'
                     }
                   >
                    {submitting ? 'Processing…' : 'Pay EMI'}
                  </button>
                </div>
              </form>

              {form.loanId && (
                <div className="summary-grid" style={{ marginTop: '1rem' }}>
                  <div className="detail-card">
                    <div className="detail-card__label">Selected loan</div>
                    <div className="detail-card__value">Loan #{selectedLoan?.id || '—'}</div>
                  </div>
                  <div className="detail-card">
                    <div className="detail-card__label">EMI amount</div>
                    <div className="detail-card__value detail-card__value--success">₹{loanDetails.emi}</div>
                  </div>
                  <div className="detail-card">
                    <div className="detail-card__label">Remaining balance</div>
                    <div className="detail-card__value detail-card__value--warning">₹{loanDetails.balance}</div>
                  </div>
                </div>
              )}

              {user.role !== 'customer' && (
                <div className="inline-message inline-message--error">
                  ℹ️ Payments are customer-only in the current workflow. Admins, agents, and socios can still inspect balances and history here.
                </div>
              )}

              {form.loanId && loanDetails.balance === '0.00' && (
                <div className="inline-message inline-message--success">✅ This loan is fully paid.</div>
              )}

              {resolvedAlertMessage && <div className="inline-message inline-message--success">✅ {resolvedAlertMessage}</div>}

              {error && form.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}
              {success && <div className="inline-message inline-message--success">✅ {success}</div>}
            </>
          )}
        </div>
      </section>

      {showSuccessAnimation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="surface-card" style={{ width: 'min(420px, 92vw)', padding: '2rem', textAlign: 'center' }}>
            <DotLottieReact
              src="https://lottie.host/9701ac69-f35b-46ed-9f46-e58f84ffa77c/QUVXQRcA8Y.lottie"
              style={{ width: '200px', height: '200px', margin: '0 auto' }}
              loop={false}
              autoplay
            />
            <div className="section-title" style={{ fontSize: '1.25rem' }}>
              Payment successful
            </div>
          </div>
        </div>
      )}

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Payment history</div>
            <div className="section-title">Recent transactions</div>
            <div className="section-subtitle">
              View transaction history within the dashboard layout so refresh, error, and empty states stay consistent.
            </div>
          </div>
        </div>
        <div className="surface-card__body">{renderHistory()}</div>
      </section>
    </div>
  );
}

export default Payments;
