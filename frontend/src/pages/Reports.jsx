import React, { useEffect, useMemo, useState } from 'react';
import { api, handleApiError, handleTokenExpiration } from '../utils/api';

const REPORT_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '📊',
    description: 'Portfolio totals, recovery rate, and high-level operating context.',
  },
  {
    id: 'recovered',
    label: 'Recovered',
    icon: '✅',
    description: 'Loans that have completed recovery successfully.',
  },
  {
    id: 'outstanding',
    label: 'Outstanding',
    icon: '⏳',
    description: 'Balances that still require follow-up and collection attention.',
  },
];

const RECOVERY_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};

function Reports() {
  const [recoveredLoans, setRecoveredLoans] = useState([]);
  const [outstandingLoans, setOutstandingLoans] = useState([]);
  const [recoverySummary, setRecoverySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    setRefreshing(true);
    setError('');
    setRefreshSuccess(false);

    try {
      const reportData = await api.getRecoveryReport();
      setRecoverySummary(reportData.data.summary);
      setRecoveredLoans(reportData.data.recoveredLoans || []);
      setOutstandingLoans(reportData.data.outstandingLoans || []);
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
  }, []);

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

  const headlineMetrics = useMemo(() => {
    if (!recoverySummary) return [];

    return [
      {
        label: 'Total loans',
        value: recoverySummary.totalLoans,
        caption: 'Approved loans currently tracked',
        tone: 'brand',
      },
      {
        label: 'Recovered loans',
        value: recoverySummary.recoveredLoans,
        caption: 'Accounts fully resolved',
        tone: 'success',
      },
      {
        label: 'Outstanding loans',
        value: recoverySummary.outstandingLoans,
        caption: 'Balances still open',
        tone: 'warning',
      },
      {
        label: 'Recovery rate',
        value: recoverySummary.recoveryRate,
        caption: 'Portfolio success percentage',
        tone: 'info',
      },
    ];
  }, [recoverySummary]);

  const amountMetrics = useMemo(() => {
    if (!recoverySummary) return [];

    return [
      {
        label: 'Recovered amount',
        value: formatCurrency(recoverySummary.totalRecoveredAmount),
        tone: 'success',
      },
      {
        label: 'Outstanding amount',
        value: formatCurrency(recoverySummary.totalOutstandingAmount),
        tone: 'warning',
      },
      {
        label: 'Portfolio amount',
        value: formatCurrency(recoverySummary.totalLoansAmount),
        tone: 'brand',
      },
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
                <td>
                  <span className="table-id-pill">#{loan.id}</span>
                </td>
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
                <td>
                  <span className="table-id-pill">#{loan.id}</span>
                </td>
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

  if (loading && !recoverySummary) {
    return renderStatePanel({
      icon: '⏳',
      title: 'Loading reports',
      message: 'Collecting portfolio totals, recovery breakdowns, and outstanding balances.',
      loadingState: true,
    });
  }

  if (error && !recoverySummary) {
    return renderStatePanel({
      icon: '⚠️',
      title: 'Unable to load reports',
      message: error,
      action: (
        <button className="btn btn-primary" onClick={loadReports}>
          Try again
        </button>
      ),
    });
  }

  return (
    <div className="dashboard-page-stack">
      <section className="surface-card surface-card--hero">
        <div className="surface-card__header">
          <div>
            <div className="section-eyebrow">Reporting workspace</div>
            <div className="section-title">Review recovery performance with one shared analytics surface</div>
            <div className="section-subtitle">
              Summary cards, tabs, and data tables now follow the same dashboard system used throughout Loans and Payments.
            </div>
          </div>
          <div className="section-actions">
            <button className="btn btn-primary" onClick={loadReports} disabled={refreshing}>
              <span style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              {refreshing ? 'Refreshing…' : 'Refresh reports'}
            </button>
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

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Amount summary</div>
            <div className="section-title">Portfolio balances</div>
            <div className="section-subtitle">
              Follow recovered, outstanding, and total portfolio value in a format aligned with the rest of the dashboard.
            </div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="summary-grid">
            {amountMetrics.map((metric) => (
              <div key={metric.label} className="detail-card">
                <div className="detail-card__label">{metric.label}</div>
                <div className={`detail-card__value detail-card__value--${metric.tone === 'brand' ? 'success' : metric.tone}`}>
                  {metric.value}
                </div>
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
            <div className="section-subtitle">
              Each tab preserves the dashboard layout while focusing on a specific reporting surface.
            </div>
          </div>
        </div>
        <div className="surface-card__body">
          <div className="page-tabs">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`page-tab${activeTab === tab.id ? ' page-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
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
            <div className="section-subtitle">
              {activeTab === 'overview'
                ? 'Use this snapshot to understand high-level performance before diving into specific account groups.'
                : activeTab === 'recovered'
                  ? 'Recovered loans stay in a dedicated, easily scannable list for historical review.'
                  : 'Outstanding loans stay visible with clear status tones and balance breakdowns.'}
            </div>
          </div>
        </div>
        <div className="surface-card__body">
          {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}

          {activeTab === 'overview' && (
            <div className="summary-grid">
              <div className="detail-card">
                <div className="detail-card__label">Recovered accounts</div>
                <div className="detail-card__value detail-card__value--success">{recoveredLoans.length}</div>
              </div>
              <div className="detail-card">
                <div className="detail-card__label">Outstanding accounts</div>
                <div className="detail-card__value detail-card__value--warning">{outstandingLoans.length}</div>
              </div>
              <div className="detail-card">
                <div className="detail-card__label">Visible loans</div>
                <div className="detail-card__value">{recoveredLoans.length + outstandingLoans.length}</div>
              </div>
              <div className="detail-card">
                <div className="detail-card__label">Recovery rate</div>
                <div className="detail-card__value detail-card__value--success">{recoverySummary?.recoveryRate || '0%'}</div>
              </div>
            </div>
          )}

          {activeTab === 'recovered' && renderRecoveredTable()}
          {activeTab === 'outstanding' && renderOutstandingTable()}
        </div>
      </section>
    </div>
  );
}

export default Reports;
