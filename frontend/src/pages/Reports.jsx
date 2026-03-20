import React, { useEffect, useMemo, useState } from 'react';
import { handleApiError } from '../lib/api/errors';
import { downloadFile } from '../lib/api/download';
import {
  useAssociateProfitabilityQuery,
  useLoanCreditHistoryQuery,
  useOutstandingLoansQuery,
  useRecoveredLoansQuery,
  useRecoveryReportQuery,
} from '../hooks/useReports';
import {
  useAssociatePortalQuery,
  useAssociatesQuery,
  useCreateAssociateContributionMutation,
  useCreateAssociateDistributionMutation,
  useCreateAssociateMutation,
  useCreateProportionalDistributionMutation,
  useDeleteAssociateMutation,
  useUpdateAssociateMutation,
} from '../hooks/useAssociates';
import {
  useUsersQuery,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
} from '../hooks/useUsers';
import { reportService } from '../services/reportService';

const REPORT_TABS = [
  { id: 'overview', label: 'Overview', icon: '📊', description: 'Portfolio totals, recovery rate, and high-level operating context.' },
  { id: 'recovered', label: 'Recovered', icon: '✅', description: 'Loans that have completed recovery successfully.' },
  { id: 'outstanding', label: 'Outstanding', icon: '⏳', description: 'Balances that still require follow-up and collection attention.' },
  { id: 'users', label: 'Users', icon: '👥', description: 'Manage user accounts, roles, and permissions.', adminOnly: true },
];

const emptyAssociateForm = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
  participationPercentage: '',
};

const emptyMoneyForm = {
  amount: '',
  notes: '',
  contributionDate: '',
  distributionDate: '',
};

const emptyProportionalForm = {
  amount: '',
  distributionDate: '',
  notes: '',
  idempotencyKey: '',
};

const RECOVERY_TONE_MAP = {
  pending: 'warning',
  in_progress: 'info',
  recovered: 'success',
};

function Reports({ user }) {
  const isSocio = user.role === 'socio';
  const isAdmin = user.role === 'admin';

  const [selectedHistoryLoanId, setSelectedHistoryLoanId] = useState('');
  const [selectedAssociateId, setSelectedAssociateId] = useState('');
  const [associateForm, setAssociateForm] = useState(emptyAssociateForm);
  const [contributionForm, setContributionForm] = useState(emptyMoneyForm);
  const [distributionForm, setDistributionForm] = useState(emptyMoneyForm);
  const [proportionalForm, setProportionalForm] = useState(emptyProportionalForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const recoveryReportQuery = useRecoveryReportQuery({ enabled: !isSocio });
  const recoveredLoansQuery = useRecoveredLoansQuery({ enabled: !isSocio && activeTab === 'recovered' });
  const outstandingLoansQuery = useOutstandingLoansQuery({ enabled: !isSocio && activeTab === 'outstanding' });
  const associateProfitabilityQuery = useAssociateProfitabilityQuery(null, { enabled: isSocio });
  const associatePortalQuery = useAssociatePortalQuery(null, { enabled: isSocio });
  const creditHistoryQuery = useLoanCreditHistoryQuery(selectedHistoryLoanId, {
    enabled: !isSocio && Boolean(selectedHistoryLoanId),
  });

  const associatesQuery = useAssociatesQuery({ enabled: isAdmin });
  const associates = useMemo(() => {
    const rows = associatesQuery.data?.data?.associates;
    return Array.isArray(rows) ? rows : [];
  }, [associatesQuery.data]);
  const createAssociateMutation = useCreateAssociateMutation();
  const updateAssociateMutation = useUpdateAssociateMutation(selectedAssociateId || null);
  const deleteAssociateMutation = useDeleteAssociateMutation();
  const createContributionMutation = useCreateAssociateContributionMutation(selectedAssociateId || null);
  const createDistributionMutation = useCreateAssociateDistributionMutation(selectedAssociateId || null);
  const createProportionalDistributionMutation = useCreateProportionalDistributionMutation();
  const selectedAssociatePortalQuery = useAssociatePortalQuery(selectedAssociateId || null, {
    enabled: isAdmin && Boolean(selectedAssociateId),
  });
  const selectedAssociateProfitabilityQuery = useAssociateProfitabilityQuery(selectedAssociateId || null, {
    enabled: isAdmin && Boolean(selectedAssociateId),
  });
  const selectedAssociate = useMemo(
    () => associates.find((associate) => Number(associate.id) === Number(selectedAssociateId)) || null,
    [associates, selectedAssociateId],
  );

  const recoverySummary = recoveryReportQuery.data?.summary
    || recoveryReportQuery.data?.data?.summary
    || recoveryReportQuery.data?.data?.report?.summary
    || null;
  const recoveredLoans = recoveredLoansQuery.data?.data?.loans || recoveryReportQuery.data?.data?.recoveredLoans || [];
  const outstandingLoans = outstandingLoansQuery.data?.data?.loans || recoveryReportQuery.data?.data?.outstandingLoans || [];
  const partnerReport = associateProfitabilityQuery.data?.data?.report || null;
  const partnerPortal = associatePortalQuery.data?.data?.portal || null;
  const selectedAssociatePortal = selectedAssociatePortalQuery.data?.data?.portal || null;
  const selectedAssociateProfitability = selectedAssociateProfitabilityQuery.data?.data?.report || null;
  const creditHistory = creditHistoryQuery.data?.data?.history || null;
  const loading = isSocio ? associateProfitabilityQuery.isLoading : recoveryReportQuery.isLoading;

  // User management queries and mutations
  const usersQuery = useUsersQuery({ enabled: isAdmin && activeTab === 'users' });
  const updateUserMutation = useUpdateUserMutation();
  const deactivateUserMutation = useDeactivateUserMutation();
  const reactivateUserMutation = useReactivateUserMutation();
  const users = usersQuery.data?.data || [];
  const [editingUser, setEditingUser] = useState(null);
  const [userRoleForm, setUserRoleForm] = useState({ role: '' });
  const currentUserId = Number(user.id);

  useEffect(() => {
    const sourceError = recoveryReportQuery.error
      || recoveredLoansQuery.error
      || outstandingLoansQuery.error
      || associateProfitabilityQuery.error
      || associatePortalQuery.error
      || creditHistoryQuery.error
      || associatesQuery.error
      || usersQuery.error
      || selectedAssociatePortalQuery.error
      || selectedAssociateProfitabilityQuery.error;

    if (sourceError) {
      handleApiError(sourceError, setError);
    }
  }, [
    associatePortalQuery.error,
    associateProfitabilityQuery.error,
    associatesQuery.error,
    creditHistoryQuery.error,
    outstandingLoansQuery.error,
    recoveredLoansQuery.error,
    recoveryReportQuery.error,
    selectedAssociatePortalQuery.error,
    selectedAssociateProfitabilityQuery.error,
    usersQuery.error,
  ]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    if (!selectedAssociateId) {
      setAssociateForm(emptyAssociateForm);
      return;
    }

    if (!selectedAssociate) return;

    setAssociateForm({
      name: selectedAssociate.name || '',
      email: selectedAssociate.email || '',
      phone: selectedAssociate.phone || '',
      status: selectedAssociate.status || 'active',
      participationPercentage: selectedAssociate.participationPercentage || '',
    });
  }, [selectedAssociate, selectedAssociateId]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

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

  const resetAssociateActionForms = () => {
    setContributionForm(emptyMoneyForm);
    setDistributionForm(emptyMoneyForm);
    setProportionalForm(emptyProportionalForm);
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setError('');
  };

  const handleUserRoleSave = async (targetUserId) => {
    clearMessages();

    try {
      await updateUserMutation.mutateAsync({ userId: targetUserId, payload: { role: userRoleForm.role } });
      setEditingUser(null);
      showSuccess('User role updated successfully');
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleDeactivateUser = async (targetUser) => {
    if (!window.confirm(`Deactivate user ${targetUser.name}?`)) {
      return;
    }

    clearMessages();

    try {
      await deactivateUserMutation.mutateAsync(targetUser.id);
      showSuccess('User deactivated successfully');
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleReactivateUser = async (targetUser) => {
    clearMessages();

    try {
      await reactivateUserMutation.mutateAsync(targetUser.id);
      showSuccess('User reactivated successfully');
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const loadReports = async () => {
    setRefreshing(true);
    setError('');
    setRefreshSuccess(false);

    try {
      if (isSocio) {
        await Promise.all([associateProfitabilityQuery.refetch(), associatePortalQuery.refetch()]);
      } else {
        await Promise.all([
          recoveryReportQuery.refetch(),
          recoveredLoansQuery.refetch(),
          outstandingLoansQuery.refetch(),
          associatesQuery.refetch(),
          ...(selectedAssociateId ? [selectedAssociatePortalQuery.refetch(), selectedAssociateProfitabilityQuery.refetch()] : []),
        ]);
      }

      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } catch (refreshError) {
      handleApiError(refreshError, setError);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (format) => {
    try {
      await downloadFile({
        loader: () => reportService.exportRecoveryReport(format),
        filename: `recovery-report.${format}`,
      });
    } catch (exportError) {
      handleApiError(exportError, setError);
    }
  };

  const handleAssociateExport = async (format = 'xlsx') => {
    const exportAssociateId = selectedAssociateId || partnerReport?.associate?.id || partnerPortal?.associate?.id;
    if (!exportAssociateId) {
      setError('Select an associate first to export profitability data.');
      return;
    }

    try {
      await downloadFile({
        loader: () => reportService.exportAssociateProfitability(exportAssociateId, format),
        filename: `associate-${exportAssociateId}-profitability.${format}`,
      });
    } catch (exportError) {
      handleApiError(exportError, setError);
    }
  };

  const handleCreateAssociate = async (event) => {
    event.preventDefault();
    try {
      await createAssociateMutation.mutateAsync({
        ...associateForm,
        participationPercentage: associateForm.participationPercentage || undefined,
      });
      setAssociateForm(emptyAssociateForm);
      showSuccess('Associate created successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleUpdateAssociate = async () => {
    if (!selectedAssociateId) {
      setError('Select an associate before updating.');
      return;
    }

    try {
      await updateAssociateMutation.mutateAsync({
        ...associateForm,
        participationPercentage: associateForm.participationPercentage || undefined,
      });
      showSuccess('Associate updated successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleDeleteAssociate = async () => {
    if (!selectedAssociateId) {
      setError('Select an associate before deleting.');
      return;
    }

    if (!window.confirm('Delete the selected associate? This cannot be undone.')) {
      return;
    }

    try {
      await deleteAssociateMutation.mutateAsync(selectedAssociateId);
      setSelectedAssociateId('');
      setAssociateForm(emptyAssociateForm);
      resetAssociateActionForms();
      showSuccess('Associate deleted successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateContribution = async () => {
    if (!selectedAssociateId) {
      setError('Select an associate before adding a contribution.');
      return;
    }

    try {
      await createContributionMutation.mutateAsync({
        amount: contributionForm.amount,
        notes: contributionForm.notes || undefined,
        contributionDate: contributionForm.contributionDate || undefined,
      });
      setContributionForm(emptyMoneyForm);
      showSuccess('Contribution created successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateDistribution = async () => {
    if (!selectedAssociateId) {
      setError('Select an associate before adding a distribution.');
      return;
    }

    try {
      await createDistributionMutation.mutateAsync({
        amount: distributionForm.amount,
        notes: distributionForm.notes || undefined,
        distributionDate: distributionForm.distributionDate || undefined,
      });
      setDistributionForm(emptyMoneyForm);
      showSuccess('Distribution created successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateProportionalDistribution = async () => {
    try {
      await createProportionalDistributionMutation.mutateAsync({
        payload: {
          amount: proportionalForm.amount,
          distributionDate: proportionalForm.distributionDate || undefined,
          notes: proportionalForm.notes || undefined,
          idempotencyKey: proportionalForm.idempotencyKey || undefined,
        },
        idempotencyKey: proportionalForm.idempotencyKey || undefined,
      });
      setProportionalForm(emptyProportionalForm);
      showSuccess('Proportional distribution created successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
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

  if (error && !recoverySummary && !partnerReport && (!isAdmin || !associates.length)) {
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
              {user.role === 'socio'
                ? 'Review partner profitability from one portal surface'
                : 'Review recovery performance and associate administration from one shared analytics surface'}
            </div>
            <div className="section-subtitle">
              {user.role === 'socio'
                ? 'Track contributions, profit distributions, and linked loan exposure tied to your associate record.'
                : 'Recovery analytics and associate operations now live together on the same TanStack Query-backed page.'}
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
            {(isSocio || selectedAssociateId) && (
              <button className="btn btn-outline-primary" onClick={() => handleAssociateExport(isSocio ? 'xlsx' : 'csv')}>
                Export associate data
              </button>
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
      {success && <div className="inline-message inline-message--success">✅ {success}</div>}

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
                {REPORT_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
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
              {activeTab === 'users' && isAdmin && (
                <div className="table-wrap">
                  {usersQuery.isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users...</div>
                  ) : users.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td>#{user.id}</td>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                              {editingUser === user.id ? (
                                <select
                                  className="form-control"
                                  value={userRoleForm.role || user.role}
                                  onChange={(e) => setUserRoleForm({ role: e.target.value })}
                                  style={{ width: 'auto' }}
                                >
                                  <option value="customer">Customer</option>
                                  <option value="agent">Agent</option>
                                  <option value="socio">Socio</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span className={`status-badge status-badge--${user.role === 'admin' ? 'active' : user.role === 'agent' ? 'info' : 'default'}`}>
                                  {user.role}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge status-badge--${user.isActive !== false ? 'active' : 'danger'}`}>
                                {user.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {editingUser === user.id ? (
                                  <>
                                    <button
                                      className="btn btn-success btn-sm"
                                      type="button"
                                      disabled={updateUserMutation.isPending}
                                      onClick={() => handleUserRoleSave(user.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      type="button"
                                      onClick={() => setEditingUser(null)}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      type="button"
                                      onClick={() => {
                                        clearMessages();
                                        setEditingUser(user.id);
                                        setUserRoleForm({ role: user.role });
                                      }}
                                    >
                                      Edit Role
                                    </button>
                                    {user.isActive !== false ? (
                                      <button
                                        className="btn btn-danger btn-sm"
                                        type="button"
                                        disabled={deactivateUserMutation.isPending || Number(user.id) === currentUserId}
                                        onClick={() => handleDeactivateUser(user)}
                                      >
                                        Deactivate
                                      </button>
                                    ) : (
                                      <button
                                        className="btn btn-success btn-sm"
                                        type="button"
                                        disabled={reactivateUserMutation.isPending}
                                        onClick={() => handleReactivateUser(user)}
                                      >
                                        Reactivate
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
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
                  <div className="detail-card"><div className="detail-card__label">Closure</div><div className="detail-card__value">{creditHistory.closure?.closureReason || '-'}</div></div>
                </div>
              )}
            </div>
          </section>

          {isAdmin && (
            <section className="surface-card">
              <div className="surface-card__header surface-card__header--compact">
                <div>
                  <div className="section-eyebrow">Associate operations</div>
                  <div className="section-title">Manage associates, contributions, and distributions</div>
                  <div className="section-subtitle">Surface associate CRUD and both manual and proportional distribution workflows without leaving the reports workspace.</div>
                </div>
              </div>
              <div className="surface-card__body">
                <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                  <label className="field-group">
                    <span className="field-label">Selected associate</span>
                    <select className="field-control" value={selectedAssociateId} onChange={(event) => setSelectedAssociateId(event.target.value)}>
                      <option value="">Create a new associate</option>
                      {associates.map((associate) => (
                        <option key={associate.id} value={associate.id}>
                          {associate.name} ({associate.participationPercentage || '0.0000'}%)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <form onSubmit={handleCreateAssociate} className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                  <label className="field-group">
                    <span className="field-label">Name</span>
                    <input className="field-control" value={associateForm.name} onChange={(event) => setAssociateForm((current) => ({ ...current, name: event.target.value }))} required />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Email</span>
                    <input className="field-control" type="email" value={associateForm.email} onChange={(event) => setAssociateForm((current) => ({ ...current, email: event.target.value }))} required />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Phone</span>
                    <input className="field-control" value={associateForm.phone} onChange={(event) => setAssociateForm((current) => ({ ...current, phone: event.target.value }))} required />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Status</span>
                    <select className="field-control" value={associateForm.status} onChange={(event) => setAssociateForm((current) => ({ ...current, status: event.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                  <label className="field-group">
                    <span className="field-label">Participation %</span>
                    <input className="field-control" value={associateForm.participationPercentage} onChange={(event) => setAssociateForm((current) => ({ ...current, participationPercentage: event.target.value }))} placeholder="25.0000" />
                  </label>
                  <div className="field-group">
                    <span className="field-label">Create</span>
                    <button className="btn btn-success" type="submit" disabled={createAssociateMutation.isPending}>Create associate</button>
                  </div>
                </form>

                {selectedAssociateId && (
                  <div className="section-actions" style={{ marginBottom: '1rem' }}>
                    <button className="btn btn-primary" onClick={handleUpdateAssociate} disabled={updateAssociateMutation.isPending}>Update associate</button>
                    <button className="btn btn-primary" type="button" onClick={handleUpdateAssociate} disabled={updateAssociateMutation.isPending}>Update associate</button>
                    <button className="btn btn-danger" type="button" onClick={handleDeleteAssociate} disabled={deleteAssociateMutation.isPending}>Delete associate</button>
                  </div>
                )}

                {selectedAssociateId && (
                  <>
                    <div className="summary-grid" style={{ marginBottom: '1rem' }}>
                      <div className="detail-card"><div className="detail-card__label">Contributed</div><div className="detail-card__value">{formatCurrency(selectedAssociateProfitability?.summary?.totalContributed)}</div></div>
                      <div className="detail-card"><div className="detail-card__label">Distributed</div><div className="detail-card__value detail-card__value--success">{formatCurrency(selectedAssociateProfitability?.summary?.totalDistributed)}</div></div>
                      <div className="detail-card"><div className="detail-card__label">Active loans</div><div className="detail-card__value">{selectedAssociatePortal?.summary?.activeLoanCount || 0}</div></div>
                      <div className="detail-card"><div className="detail-card__label">Exposure</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(selectedAssociatePortal?.summary?.portfolioExposure)}</div></div>
                    </div>

                    <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                      <label className="field-group">
                        <span className="field-label">Contribution amount</span>
                        <input className="field-control" value={contributionForm.amount} onChange={(event) => setContributionForm((current) => ({ ...current, amount: event.target.value }))} />
                      </label>
                      <label className="field-group">
                        <span className="field-label">Contribution date</span>
                        <input className="field-control" type="date" value={contributionForm.contributionDate} onChange={(event) => setContributionForm((current) => ({ ...current, contributionDate: event.target.value }))} />
                      </label>
                      <label className="field-group">
                        <span className="field-label">Notes</span>
                        <input className="field-control" value={contributionForm.notes} onChange={(event) => setContributionForm((current) => ({ ...current, notes: event.target.value }))} />
                      </label>
                      <div className="field-group">
                        <span className="field-label">Action</span>
                        <button className="btn btn-primary" type="button" onClick={handleCreateContribution} disabled={createContributionMutation.isPending}>Add contribution</button>
                      </div>
                    </div>

                    <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                      <label className="field-group">
                        <span className="field-label">Distribution amount</span>
                        <input className="field-control" value={distributionForm.amount} onChange={(event) => setDistributionForm((current) => ({ ...current, amount: event.target.value }))} />
                      </label>
                      <label className="field-group">
                        <span className="field-label">Distribution date</span>
                        <input className="field-control" type="date" value={distributionForm.distributionDate} onChange={(event) => setDistributionForm((current) => ({ ...current, distributionDate: event.target.value }))} />
                      </label>
                      <label className="field-group">
                        <span className="field-label">Notes</span>
                        <input className="field-control" value={distributionForm.notes} onChange={(event) => setDistributionForm((current) => ({ ...current, notes: event.target.value }))} />
                      </label>
                      <div className="field-group">
                        <span className="field-label">Action</span>
                        <button className="btn btn-primary" type="button" onClick={handleCreateDistribution} disabled={createDistributionMutation.isPending}>Add distribution</button>
                      </div>
                    </div>
                  </>
                )}

                <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                  <label className="field-group">
                    <span className="field-label">Proportional amount</span>
                    <input className="field-control" value={proportionalForm.amount} onChange={(event) => setProportionalForm((current) => ({ ...current, amount: event.target.value }))} />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Distribution date</span>
                    <input className="field-control" type="date" value={proportionalForm.distributionDate} onChange={(event) => setProportionalForm((current) => ({ ...current, distributionDate: event.target.value }))} />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Idempotency key</span>
                    <input className="field-control" value={proportionalForm.idempotencyKey} onChange={(event) => setProportionalForm((current) => ({ ...current, idempotencyKey: event.target.value }))} placeholder="assoc-proportional-2026-03" />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Notes</span>
                    <input className="field-control" value={proportionalForm.notes} onChange={(event) => setProportionalForm((current) => ({ ...current, notes: event.target.value }))} />
                  </label>
                  <div className="field-group">
                    <span className="field-label">Action</span>
                    <button className="btn btn-outline-primary" type="button" onClick={handleCreateProportionalDistribution} disabled={createProportionalDistributionMutation.isPending}>Run proportional distribution</button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Associate</th>
                        <th>Status</th>
                        <th>Participation</th>
                        <th className="table-cell-right">Contributed</th>
                        <th className="table-cell-right">Distributed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {associates.length === 0 ? (
                        <tr><td colSpan="5" className="table-cell-center">No associates available</td></tr>
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
          )}
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
              <div className="detail-card"><div className="detail-card__label">Portfolio exposure</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(partnerPortal?.summary?.portfolioExposure || 0)}</div></div>
            </div>
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
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
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Distribution date</th>
                    <th>Type</th>
                    <th className="table-cell-right">Allocated</th>
                    <th className="table-cell-right">Declared proportional total</th>
                  </tr>
                </thead>
                <tbody>
                  {(partnerReport?.data?.distributions || []).length === 0 ? (
                    <tr><td colSpan="4" className="table-cell-center">No distributions recorded</td></tr>
                  ) : (
                    (partnerReport?.data?.distributions || []).map((entry) => (
                      <tr key={`distribution-${entry.id}`}>
                        <td>{formatDate(entry.distributionDate)}</td>
                        <td>{entry.distributionType || '-'}</td>
                        <td className="table-cell-right">{formatCurrency(entry.allocatedAmount || entry.amount)}</td>
                        <td className="table-cell-right">{formatCurrency(entry.declaredProportionalTotal)}</td>
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
                    <th>Loan ID</th>
                    <th>Customer</th>
                    <th className="table-cell-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(partnerReport?.data?.loans || []).length === 0 ? (
                    <tr><td colSpan="4" className="table-cell-center">No linked loans</td></tr>
                  ) : (
                    (partnerReport?.data?.loans || []).map((loan) => (
                      <tr key={`loan-${loan.id}`}>
                        <td>#{loan.id}</td>
                        <td>{loan.Customer?.name || '-'}</td>
                        <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                        <td>{loan.status || '-'}</td>
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
