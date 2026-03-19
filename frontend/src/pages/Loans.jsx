import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Agents from './Agents';
import { api, handleApiError, handleApiSuccess, handleTokenExpiration } from '../utils/api';

const LOAN_STATUS_TONE_MAP = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

const RECOVERY_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  recovered: 'Recovered',
};

const RECOVERY_STATUS_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};

function Loans({ user }) {
  const [loans, setLoans] = useState([]);
  const [paymentsByLoan, setPaymentsByLoan] = useState({});
  const [editingRecovery, setEditingRecovery] = useState({});
  const [selectedRecovery, setSelectedRecovery] = useState({});
  const [error, setError] = useState('');
  const [form, setForm] = useState({ amount: '', interestRate: '', termMonths: '' });
  const [success, setSuccess] = useState('');
  const [assignAgentId, setAssignAgentId] = useState({});
  const [loading, setLoading] = useState(true);

  const calculateInterestRate = (amount, term) => {
    if (!amount || !term) return '';

    const amt = parseFloat(amount);
    const t = parseInt(term, 10);
    let baseRate = 2.5;

    if (amt >= 10000) baseRate -= 0.5;
    if (t >= 12) baseRate -= 0.3;
    if (amt >= 20000) baseRate -= 0.3;

    const random = Math.random() * 0.4;
    let rate = baseRate + random;
    rate = Math.max(1.5, Math.min(rate, 3.5));

    return rate.toFixed(1);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    const newForm = { ...form, [name]: value };

    if (name === 'amount' || name === 'termMonths') {
      newForm.interestRate = calculateInterestRate(
        name === 'amount' ? value : form.amount,
        name === 'termMonths' ? value : form.termMonths,
      );
    }

    setForm(newForm);
  };

  const fetchLoans = useCallback(async () => {
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

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    if (!loans.length) {
      setPaymentsByLoan({});
      return;
    }

    let isMounted = true;

    const fetchPayments = async () => {
      const paymentsMap = {};

      for (const loan of loans) {
        try {
          const data = await api.getPaymentsByLoan(loan.id);
          paymentsMap[loan.id] = Array.isArray(data.data) ? data.data : [];
        } catch (err) {
          if (err.status === 401) {
            handleTokenExpiration();
            return;
          }
          paymentsMap[loan.id] = [];
        }
      }

      if (isMounted) {
        setPaymentsByLoan(paymentsMap);
      }
    };

    fetchPayments();

    return () => {
      isMounted = false;
    };
  }, [loans]);

  const handleApply = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const loanData = {
        customerId: user.id,
        amount: parseFloat(form.amount),
        interestRate: parseFloat(form.interestRate),
        termMonths: parseInt(form.termMonths, 10),
      };

      await api.createLoan(loanData);
      handleApiSuccess('Loan application submitted!', setSuccess);
      setForm({ amount: '', interestRate: '', termMonths: '' });
      fetchLoans();
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const handleStatus = async (id, status) => {
    setError('');
    setSuccess('');

    try {
      await api.updateLoanStatus(id, status);
      handleApiSuccess('Loan status updated!', setSuccess);
      fetchLoans();
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const handleAssignAgent = async (id, agentId) => {
    setError('');
    setSuccess('');

    try {
      await api.assignAgent(id, agentId);
      handleApiSuccess('Agent assigned!', setSuccess);
      fetchLoans();
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const handleRecoverySelect = (loanId, value) => {
    setSelectedRecovery((prev) => ({ ...prev, [loanId]: value }));
    setEditingRecovery((prev) => ({ ...prev, [loanId]: true }));
  };

  const handleRecoverySave = async (loanId) => {
    try {
      await api.updateRecoveryStatus(loanId, selectedRecovery[loanId]);
      setLoans((prev) =>
        prev.map((loan) =>
          loan.id === loanId ? { ...loan, recoveryStatus: selectedRecovery[loanId] } : loan,
        ),
      );
      setEditingRecovery((prev) => ({ ...prev, [loanId]: false }));
      setSelectedRecovery((prev) => ({ ...prev, [loanId]: '' }));
      handleApiSuccess('Recovery status updated successfully', setSuccess);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const handleRecoveryEdit = (loanId) => {
    setEditingRecovery((prev) => ({ ...prev, [loanId]: true }));
  };

  const handleDeleteLoan = async (id) => {
    setError('');
    setSuccess('');

    if (!window.confirm('Are you sure you want to delete this rejected loan? This action cannot be undone.')) {
      return;
    }

    try {
      await api.deleteLoan(id);
      handleApiSuccess('Loan deleted successfully!', setSuccess);
      fetchLoans();
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    }
  };

  const getLoanDetails = (loan, payments) => {
    if (!loan) return { emi: '', balance: '' };

    const principal = parseFloat(loan.amount);
    const rate = parseFloat(loan.interestRate) / 100 / 12;
    const n = parseInt(loan.termMonths, 10);
    const emi =
      rate === 0
        ? principal / n
        : (principal * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    const paid = payments?.length ? payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) : 0;
    const totalDue = emi * n;
    const balance = Math.max(0, totalDue - paid);
    const finalBalance = balance < 1 ? 0 : balance;

    return { emi: emi.toFixed(2), balance: finalBalance.toFixed(2) };
  };

  const getPaymentProgress = (loan) => {
    const payments = paymentsByLoan[loan.id] || [];
    const paymentsMade = payments.length;
    const totalTerm = loan.termMonths;
    const progressPercentage = totalTerm > 0 ? (paymentsMade / totalTerm) * 100 : 0;

    return {
      text: `${paymentsMade}/${totalTerm}`,
      percentage: progressPercentage,
      isGood: progressPercentage >= 50,
    };
  };

  const summaryCards = useMemo(() => {
    const approvedCount = loans.filter((loan) => loan.status === 'approved').length;
    const pendingCount = loans.filter((loan) => loan.status === 'pending').length;
    const recoveryCount = loans.filter((loan) => loan.recoveryStatus === 'in_progress').length;
    const totalBalance = loans.reduce((sum, loan) => {
      const { balance } = getLoanDetails(loan, paymentsByLoan[loan.id] || []);
      return sum + parseFloat(balance || 0);
    }, 0);

    return [
      {
        label: user.role === 'agent' ? 'Assigned loans' : 'Loan records',
        value: loans.length,
        caption: user.role === 'customer' ? 'Applications in your pipeline' : 'Visible in this workspace',
        tone: 'brand',
      },
      {
        label: user.role === 'agent' ? 'Active recovery' : 'Approved loans',
        value: user.role === 'agent' ? recoveryCount : approvedCount,
        caption: user.role === 'agent' ? 'Accounts requiring follow-up' : 'Ready for repayment or assignment',
        tone: 'success',
      },
      {
        label: user.role === 'customer' ? 'Pending review' : 'Pending decisions',
        value: pendingCount,
        caption: user.role === 'customer' ? 'Applications waiting for approval' : 'Items that still need action',
        tone: 'warning',
      },
      {
        label: 'Outstanding balance',
        value: `₹${totalBalance.toFixed(2)}`,
        caption: 'Calculated from current payment history',
        tone: 'info',
      },
    ];
  }, [loans, paymentsByLoan, user.role]);

  const renderStatePanel = ({ icon, title, message, action }) => (
    <div className={`state-panel${icon === '⏳' ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );

  const formatRecoveryStatus = (status) => RECOVERY_STATUS_LABELS[status] || status || '-';
  const formatLoanStatus = (status) => (status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '-');

  const renderProgress = (loan) => {
    const progress = getPaymentProgress(loan);

    return (
      <div className="progress-pill">
        <span className="progress-pill__text">{progress.text}</span>
        <div className="progress-track">
          <div
            className={`progress-track__fill${progress.isGood ? '' : ' progress-track__fill--danger'}`}
            style={{ width: `${Math.min(progress.percentage, 100)}%` }}
          ></div>
        </div>
      </div>
    );
  };

  const renderAgentAssignment = (loan) => (
    <div className="table-inline-stack">
      <div>{loan.Agent ? loan.Agent.name : '-'}</div>
      {user.role === 'admin' && loan.status === 'approved' && !loan.Agent && (
        <div className="table-inline-stack">
          <Agents onSelect={(agentId) => setAssignAgentId((prev) => ({ ...prev, [loan.id]: agentId }))} />
          <button
            className="btn btn-primary btn-sm"
            disabled={!assignAgentId[loan.id]}
            onClick={() => handleAssignAgent(loan.id, assignAgentId[loan.id])}
          >
            Assign agent
          </button>
        </div>
      )}
    </div>
  );

  const renderRecoveryEditor = (loan) => {
    const canEdit = user.role === 'admin' || (user.role === 'agent' && loan.agentId === user.id);

    if (!canEdit) {
      return <span className="status-note">No action available</span>;
    }

    if (editingRecovery[loan.id]) {
      return (
        <div className="action-stack">
          <select
            className="form-control"
            value={selectedRecovery[loan.id] || ''}
            onChange={(event) => handleRecoverySelect(loan.id, event.target.value)}
          >
            <option value="">Select status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="recovered">Recovered</option>
          </select>
          {selectedRecovery[loan.id] && (
            <button className="btn btn-success btn-sm" onClick={() => handleRecoverySave(loan.id)}>
              Save status
            </button>
          )}
        </div>
      );
    }

    return (
      <button className="btn btn-outline-primary btn-sm" onClick={() => handleRecoveryEdit(loan.id)}>
        Edit recovery
      </button>
    );
  };

  const renderTable = () => {
    if (loading) {
      return renderStatePanel({
        icon: '⏳',
        title: 'Loading loans',
        message: 'We are gathering the latest loan records and repayment progress for this workspace.',
      });
    }

    if (error) {
      return renderStatePanel({
        icon: '⚠️',
        title: 'Unable to load loans',
        message: error,
        action: (
          <button className="btn btn-primary" onClick={fetchLoans}>
            Try again
          </button>
        ),
      });
    }

    if (!loans.length) {
      return renderStatePanel({
        icon: user.role === 'agent' ? '🔍' : '📄',
        title: user.role === 'customer' ? 'No loans yet' : user.role === 'agent' ? 'No assigned loans' : 'No loans found',
        message:
          user.role === 'customer'
            ? 'Start with a loan request above and we will track it here as it moves through review and repayment.'
            : user.role === 'agent'
              ? 'Assigned recovery accounts will appear here once an approved loan is routed to you.'
              : 'New loan applications will appear here as soon as they enter the system.',
      });
    }

    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Loan ID</th>
              {(user.role === 'admin' || user.role === 'agent') && <th>Customer</th>}
              <th className="table-cell-right">Amount</th>
              <th className="table-cell-center">Interest</th>
              <th className="table-cell-center">Term</th>
              <th className="table-cell-center">Status</th>
              {(user.role === 'admin' || user.role === 'agent') && <th className="table-cell-center">Agent</th>}
              <th className="table-cell-center">Recovery</th>
              <th className="table-cell-center">Progress</th>
              <th className="table-cell-right">Balance</th>
              <th className="table-cell-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...loans]
              .sort((a, b) => {
                if (a.status === 'rejected' && b.status !== 'rejected') return 1;
                if (a.status !== 'rejected' && b.status === 'rejected') return -1;
                return 0;
              })
              .map((loan) => {
                const loanDetails = getLoanDetails(loan, paymentsByLoan[loan.id] || []);

                return (
                  <tr key={loan.id}>
                    <td>
                      <span className="table-id-pill">#{loan.id}</span>
                    </td>
                    {(user.role === 'admin' || user.role === 'agent') && <td>{loan.Customer ? loan.Customer.name : '-'}</td>}
                    <td className="table-cell-right">₹{loan.amount}</td>
                    <td className="table-cell-center">{parseFloat(loan.interestRate).toFixed(1)}%</td>
                    <td className="table-cell-center">{loan.termMonths}m</td>
                    <td className="table-cell-center">
                      <span className={`status-badge status-badge--${LOAN_STATUS_TONE_MAP[loan.status] || 'neutral'}`}>
                        {formatLoanStatus(loan.status)}
                      </span>
                    </td>
                    {(user.role === 'admin' || user.role === 'agent') && (
                      <td className="table-cell-center">{renderAgentAssignment(loan)}</td>
                    )}
                    <td className="table-cell-center">
                      <span
                        className={`status-badge status-badge--${RECOVERY_STATUS_TONE_MAP[loan.recoveryStatus] || 'neutral'}`}
                      >
                        {formatRecoveryStatus(loan.recoveryStatus)}
                      </span>
                    </td>
                    <td className="table-cell-center">{renderProgress(loan)}</td>
                    <td className="table-cell-right">
                      {loanDetails.balance === '0.00' ? (
                        <span className="status-badge status-badge--success">Fully paid</span>
                      ) : (
                        `₹${loanDetails.balance}`
                      )}
                    </td>
                    <td className="table-cell-center">
                      <div className="action-stack">
                        {loan.status === 'pending' && user.role !== 'agent' && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleStatus(loan.id, 'approved')}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleStatus(loan.id, 'rejected')}>
                              Reject
                            </button>
                          </>
                        )}
                        {(user.role === 'admin' || user.role === 'agent') && renderRecoveryEditor(loan)}
                        {(loan.status === 'rejected' || (user.role === 'customer' && loan.status === 'rejected')) && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteLoan(loan.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="dashboard-page-stack">
      <section className="surface-card surface-card--hero">
        <div className="surface-card__header">
          <div>
            <div className="section-eyebrow">Loans workspace</div>
            <div className="section-title">
              {user.role === 'agent'
                ? 'Track recovery activity across assigned loans'
                : user.role === 'admin'
                  ? 'Manage lending decisions with one consistent view'
                  : 'Apply for loans and monitor your approval journey'}
            </div>
            <div className="section-subtitle">
              Review decisions, assignments, recovery progress, and outstanding balances without leaving the dashboard frame.
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

      {user.role === 'customer' && (
        <section className="surface-card">
          <div className="surface-card__header surface-card__header--compact">
            <div>
              <div className="section-eyebrow">Loan application</div>
              <div className="section-title">Start a new request</div>
              <div className="section-subtitle">
                Enter your amount and term to generate the estimated rate before submitting.
              </div>
            </div>
          </div>
          <div className="surface-card__body">
            <form onSubmit={handleApply} className="dashboard-form-grid">
              <label className="field-group">
                <span className="field-label">Loan amount</span>
                <input className="field-control" name="amount" placeholder="Loan amount" value={form.amount} onChange={handleFormChange} required />
              </label>
              <label className="field-group">
                <span className="field-label">Repayment term</span>
                <select className="field-control" name="termMonths" value={form.termMonths} onChange={handleFormChange} required>
                  <option value="" disabled>
                    Select a term
                  </option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="9">9 months</option>
                  <option value="12">12 months</option>
                  <option value="15">15 months</option>
                  <option value="18">18 months</option>
                  <option value="24">24 months</option>
                </select>
              </label>
              <label className="field-group">
                <span className="field-label">Estimated interest rate</span>
                <input className="field-control" name="interestRate" placeholder="Interest rate (%)" value={form.interestRate} readOnly />
              </label>
              <div className="field-group">
                <span className="field-label">Submit</span>
                <button className="btn btn-success" type="submit">
                  <i className="bi bi-send"></i>
                  Apply for loan
                </button>
              </div>
            </form>

            {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}
            {success && <div className="inline-message inline-message--success">✅ {success}</div>}
          </div>
        </section>
      )}

      {user.role !== 'customer' && success && <div className="inline-message inline-message--success">✅ {success}</div>}
      {user.role !== 'customer' && error && !loading && <div className="inline-message inline-message--error">⚠️ {error}</div>}

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Portfolio view</div>
            <div className="section-title">
              {user.role === 'agent' ? 'Recovery queue' : user.role === 'admin' ? 'Loan operations overview' : 'Your loan history'}
            </div>
            <div className="section-subtitle">
              Shared tables, badge tones, and action zones keep every status easy to scan on desktop and mobile.
            </div>
          </div>
        </div>
        <div className="surface-card__body">{renderTable()}</div>
      </section>
    </div>
  );
}

export default Loans;
