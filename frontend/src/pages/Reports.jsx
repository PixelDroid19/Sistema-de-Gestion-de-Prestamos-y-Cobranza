import React, { useEffect, useMemo, useState } from 'react';
import { api, handleApiError, handleTokenExpiration } from '../utils/api';

const REPORT_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊', description: 'Portfolio totals, recovery rate, and high-level operating context.' },
  { id: 'recovered', label: 'Recovered', icon: '✅', description: 'Loans that have completed recovery successfully.' },
  { id: 'outstanding', label: 'Outstanding', icon: '⏳', description: 'Balances that still require follow-up and collection attention.' },
];

const RECOVERY_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};

function Reports({ user }) {
  const [recoveredLoans, setRecoveredLoans] = useState([]);
  const [outstandingLoans, setOutstandingLoans] = useState([]);
  const [recoverySummary, setRecoverySummary] = useState(null);
  const [partnerReport, setPartnerReport] = useState(null);
  const [creditHistory, setCreditHistory] = useState(null);
  const [selectedHistoryLoanId, setSelectedHistoryLoanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRecoveryStatus = (status) => {
    if (!status) return '-';
    if (status === 'in_progress') return 'In Progress';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const loadReports = async () => {
    setLoading(true);
    setRefreshing(true);
    setError('');
    setRefreshSuccess(false);

    try {
      if (user.role === 'socio') {
        const partnerData = await api.getAssociateProfitability();
        setPartnerReport(partnerData.data.report);
        setRecoverySummary(null);
        setRecoveredLoans([]);
        setOutstandingLoans([]);
      } else {
        const reportData = await api.getRecoveryReport();
        setRecoverySummary(reportData.data.summary);
        setRecoveredLoans(reportData.data.recoveredLoans || []);
        setOutstandingLoans(reportData.data.outstandingLoans || []);
        setPartnerReport(null);
      }

      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } catch (err) {
      if (err.status === 401) {
        handleTokenExpiration();
      } else {
        handleApiError(err, setError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user.role]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedHistoryLoanId || user.role === 'socio') {
        setCreditHistory(null);
        return;
      }

      try {
        const historyData = await api.getLoanCreditHistory(selectedHistoryLoanId);
        setCreditHistory(historyData.data.history);
      } catch (err) {
        if (err.status === 401) {
          handleTokenExpiration();
        } else {
          handleApiError(err, setError);
        }
      }
    };

    loadHistory();
  }, [selectedHistoryLoanId, user.role]);

  const handleExport = async (format) => {
    try {
      const blob = await api.exportRecoveryReport(format);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `recovery-report.${format}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const headlineMetrics = useMemo(() => {
    if (user.role === 'socio') {
      return [
        {
          label: 'Total contributed',
          value: formatCurrency(partnerReport?.summary?.totalContributed || 0),
          caption: 'Capital registered against your associate record',
          tone: 'brand',
        },
        {
          label: 'Total distributed',
          value: formatCurrency(partnerReport?.summary?.totalDistributed || 0),
          caption: 'Cash-basis profit distributions',
          tone: 'success',
        },
        {
          label: 'Linked loans',
          value: partnerReport?.summary?.loanCount || 0,
          caption: 'Loans tied to your associate record',
          tone: 'info',
        },
      ];
    }

    if (!recoverySummary) return [];
    return [
      { label: 'Total loans', value: recoverySummary.totalLoans, caption: 'Approved loans currently tracked', tone: 'brand' },
      { label: 'Recovered loans', value: recoverySummary.recoveredLoans, caption: 'Accounts fully resolved', tone: 'success' },
      { label: 'Outstanding loans', value: recoverySummary.outstandingLoans, caption: 'Balances still open', tone: 'warning' },
      { label: 'Recovery rate', value: recoverySummary.recoveryRate, caption: 'Portfolio success percentage', tone: 'info' },
    ];
  }, [partnerReport, recoverySummary, user.role]);

  const amountMetrics = useMemo(() => {
    if (!recoverySummary) return [];
    return [
      { label: 'Recovered amount', value: formatCurrency(recoverySummary.totalRecoveredAmount), tone: 'success' },
      { label: 'Outstanding amount', value: formatCurrency(recoverySummary.totalOutstandingAmount), tone: 'warning' },
      { label: 'Portfolio amount', value: formatCurrency(recoverySummary.totalLoansAmount), tone: 'brand' },
    ];
  }, [recoverySummary]);

  const renderStatePanel = ({ icon, title, message, action, loadingState = false }) => (
    <div className={`state-panel${loadingState ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );

  const renderRecoveredTable = () => {
    if (!recoveredLoans.length) {
      return renderStatePanel({
        icon: '📋',
        title: 'No recovered loans yet',
        message: 'Recovered accounts will appear here once repayment reaches completion and the recovery workflow is closed.',
      });
    }

    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Customer</th>
              <th>Agent</th>
              <th className="table-cell-right">Amount</th>
              <th className="table-cell-right">Recovered</th>
              <th className="table-cell-center">Recovery date</th>
            </tr>
          </thead>
          <tbody>
            {recoveredLoans.map((loan) => (
              <tr key={loan.id}>
                <td><span className="table-id-pill">#{loan.id}</span></td>
                <td>{loan.Customer?.name || 'N/A'}</td>
                <td>{loan.Agent?.name || 'N/A'}</td>
                <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                <td className="table-cell-right">{formatCurrency(loan.totalPaid)}</td>
                <td className="table-cell-center">{formatDate(loan.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderOutstandingTable = () => {
    if (!outstandingLoans.length) {
      return renderStatePanel({
        icon: '✅',
        title: 'No outstanding loans',
        message: 'Every tracked loan is currently recovered, so there are no open balances to surface here.',
      });
    }

    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Customer</th>
              <th>Agent</th>
              <th className="table-cell-right">Amount</th>
              <th className="table-cell-right">Paid</th>
              <th className="table-cell-right">Outstanding</th>
              <th className="table-cell-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {outstandingLoans.map((loan) => (
              <tr key={loan.id}>
                <td><span className="table-id-pill">#{loan.id}</span></td>
                <td>{loan.Customer?.name || 'N/A'}</td>
                <td>{loan.Agent?.name || 'N/A'}</td>
                <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                <td className="table-cell-right">{formatCurrency(loan.totalPaid)}</td>
                <td className="table-cell-right">{formatCurrency(loan.outstandingAmount)}</td>
                <td className="table-cell-center">
                  <span className={`status-badge status-badge--${RECOVERY_TONE_MAP[loan.recoveryStatus] || 'neutral'}`}>
                    {formatRecoveryStatus(loan.recoveryStatus)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && !recoverySummary && !partnerReport) {
    return renderStatePanel({
      icon: '⏳',
      title: 'Loading reports',
      message: 'Collecting portfolio totals, recovery breakdowns, and outstanding balances.',
      loadingState: true,
    });
  }

  if (error && !recoverySummary && !partnerReport) {
    return renderStatePanel({
      icon: '⚠️',
      title: 'Unable to load reports',
      message: error,
      action: <button className="btn btn-primary" onClick={loadReports}>Try again</button>,
    });
  }

  return (
    <div className="dashboard-page-stack">
      <section className="surface-card surface-card--hero">
        <div className="surface-card__header">
          <div>
            <div className="section-eyebrow">{user.role === 'socio' ? 'Partner portal' : 'Reporting workspace'}</div>
            <div className="section-title">
              {user.role === 'socio' ? 'Review partner profitability from one portal surface' : 'Review recovery performance with one shared analytics surface'}
            </div>
            <div className="section-subtitle">
              {user.role === 'socio'
                ? 'Track contributions, profit distributions, and linked loan exposure tied to your associate record.'
                : 'Summary cards, tabs, and data tables now follow the same dashboard system used throughout Loans and Payments.'}
            </div>
          </div>
          <div className="section-actions">
            <button className="btn btn-primary" onClick={loadReports} disabled={refreshing}>
              <span style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              {refreshing ? 'Refreshing…' : 'Refresh reports'}
            </button>
            {user.role !== 'socio' && (
              <>
                <button className="btn btn-outline-primary" onClick={() => handleExport('csv')}>Export CSV</button>
                <button className="btn btn-outline-primary" onClick={() => handleExport('pdf')}>Export PDF</button>
              </>
            )}
          </div>
        </div>
        <div className="surface-card__body">
          <div className="metric-grid">
            {headlineMetrics.map((metric) => (
              <div key={metric.label} className={`metric-card metric-card--${metric.tone}`}>
                <div className="metric-card__label">{metric.label}</div>
                <div className="metric-card__value">{metric.value}</div>
                <div className="metric-card__caption">{metric.caption}</div>
              </div>
            ))}
          </div>
          {refreshSuccess && <div className="inline-message inline-message--success">✅ Reports refreshed successfully.</div>}
        </div>
      </section>

      {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}

      {user.role !== 'socio' && (
        <>
          <section className="surface-card">
            <div className="surface-card__header surface-card__header--compact">
              <div>
                <div className="section-eyebrow">Amount summary</div>
                <div className="section-title">Portfolio balances</div>
                <div className="section-subtitle">Follow recovered, outstanding, and total portfolio value in a shared dashboard format.</div>
              </div>
            </div>
            <div className="surface-card__body">
              <div className="summary-grid">
                {amountMetrics.map((metric) => (
                  <div key={metric.label} className="detail-card">
                    <div className="detail-card__label">{metric.label}</div>
                    <div className={`detail-card__value detail-card__value--${metric.tone === 'brand' ? 'success' : metric.tone}`}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface-card">
            <div className="surface-card__header surface-card__header--compact">
              <div>
                <div className="section-eyebrow">Report views</div>
                <div className="section-title">Switch between reporting states</div>
              </div>
            </div>
            <div className="surface-card__body">
              <div className="page-tabs">
                {REPORT_TABS.map((tab) => (
                  <button key={tab.id} className={`page-tab${activeTab === tab.id ? ' page-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="surface-card">
            <div className="surface-card__header surface-card__header--compact">
              <div>
                <div className="section-eyebrow">{REPORT_TABS.find((tab) => tab.id === activeTab)?.label}</div>
                <div className="section-title">{REPORT_TABS.find((tab) => tab.id === activeTab)?.description}</div>
              </div>
            </div>
            <div className="surface-card__body">
              {activeTab === 'overview' && (
                <div className="summary-grid">
                  <div className="detail-card"><div className="detail-card__label">Recovered accounts</div><div className="detail-card__value detail-card__value--success">{recoveredLoans.length}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Outstanding accounts</div><div className="detail-card__value detail-card__value--warning">{outstandingLoans.length}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Visible loans</div><div className="detail-card__value">{recoveredLoans.length + outstandingLoans.length}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Recovery rate</div><div className="detail-card__value detail-card__value--success">{recoverySummary?.recoveryRate || '0%'}</div></div>
                </div>
              )}
              {activeTab === 'recovered' && renderRecoveredTable()}
              {activeTab === 'outstanding' && renderOutstandingTable()}
            </div>
          </section>

          <section className="surface-card">
            <div className="surface-card__header surface-card__header--compact">
              <div>
                <div className="section-eyebrow">Credit history</div>
                <div className="section-title">Loan-level customer history</div>
                <div className="section-subtitle">Inspect canonical payment and balance history for a specific loan.</div>
              </div>
            </div>
            <div className="surface-card__body">
              <div className="dashboard-form-grid">
                <label className="field-group">
                  <span className="field-label">Loan ID</span>
                  <input className="field-control" value={selectedHistoryLoanId} onChange={(event) => setSelectedHistoryLoanId(event.target.value)} />
                </label>
              </div>
              {creditHistory && (
                <div className="summary-grid" style={{ marginTop: '1rem' }}>
                  <div className="detail-card"><div className="detail-card__label">Loan</div><div className="detail-card__value">#{creditHistory.loan.id}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Outstanding</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(creditHistory.snapshot.outstandingBalance)}</div></div>
                  <div className="detail-card"><div className="detail-card__label">Total paid</div><div className="detail-card__value detail-card__value--success">{formatCurrency(creditHistory.snapshot.totalPaid)}</div></div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {user.role === 'socio' && (
        <section className="surface-card">
          <div className="surface-card__header surface-card__header--compact">
            <div>
              <div className="section-eyebrow">Partner profitability</div>
              <div className="section-title">Cash-basis partner performance</div>
              <div className="section-subtitle">Review contributions, distributions, and linked loans tied to your associate account.</div>
            </div>
          </div>
          <div className="surface-card__body">
            <div className="summary-grid" style={{ marginBottom: '1rem' }}>
              <div className="detail-card"><div className="detail-card__label">Contribution count</div><div className="detail-card__value">{partnerReport?.summary?.contributionCount || 0}</div></div>
              <div className="detail-card"><div className="detail-card__label">Distribution count</div><div className="detail-card__value">{partnerReport?.summary?.distributionCount || 0}</div></div>
              <div className="detail-card"><div className="detail-card__label">Net profit</div><div className="detail-card__value detail-card__value--success">{formatCurrency(partnerReport?.summary?.netProfit || 0)}</div></div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contribution date</th>
                    <th className="table-cell-right">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(partnerReport?.data?.contributions || []).length === 0 ? (
                    <tr><td colSpan="3" className="table-cell-center">No contributions recorded</td></tr>
                  ) : (
                    (partnerReport?.data?.contributions || []).map((entry) => (
                      <tr key={`contribution-${entry.id}`}>
                        <td>{formatDate(entry.contributionDate)}</td>
                        <td className="table-cell-right">{formatCurrency(entry.amount)}</td>
                        <td>{entry.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default Reports;
