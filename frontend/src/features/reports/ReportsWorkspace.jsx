import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import StatePanel from '@/components/ui/StatePanel';
import {
  useAssociateProfitabilityQuery,
  useCustomerCreditProfileQuery,
  useCustomerProfitabilityQuery,
  useLoanProfitabilityQuery,
  useLoanCreditHistoryQuery,
  useOutstandingLoansQuery,
  useRecoveredLoansQuery,
  useRecoveryReportQuery,
} from '@/hooks/useReports';
import {
  useAssociatePortalQuery,
} from '@/hooks/useAssociates';
import {
  useUsersQuery,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
} from '@/hooks/useUsers';
import { downloadFile } from '@/lib/api/download';
import { handleApiError } from '@/lib/api/errors';
import { reportService } from '@/services/reportService';
import { usePaginationStore } from '@/store/paginationStore';

import { formatCurrency } from '@/features/reports/reportsWorkspace.utils';
import ReportsAdminSection from '@/features/reports/sections/ReportsAdminSection';
import ReportsHeroSection from '@/features/reports/sections/ReportsHeroSection';
import ReportsPartnerSection from '@/features/reports/sections/ReportsPartnerSection';
import ReportsPortfolioSection from '@/features/reports/sections/ReportsPortfolioSection';

const RECOVERED_SCOPE = 'workspace-reports-recovered';
const OUTSTANDING_SCOPE = 'workspace-reports-outstanding';
const USERS_SCOPE = 'workspace-reports-users';
const CUSTOMER_PROFITABILITY_SCOPE = 'workspace-reports-customer-profitability';
const LOAN_PROFITABILITY_SCOPE = 'workspace-reports-loan-profitability';
const DEFAULT_PAGINATION = { page: 1, pageSize: 25 };

function ReportsWorkspace({ user }) {
  const { t } = useTranslation()
  const isSocio = user.role === 'socio';
  const isAdmin = user.role === 'admin';

  const [selectedHistoryLoanId, setSelectedHistoryLoanId] = useState('');
  const [selectedCustomerProfileId, setSelectedCustomerProfileId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userRoleForm, setUserRoleForm] = useState({ role: '' });
  const ensurePaginationScope = usePaginationStore((state) => state.ensureScope);
  const setPage = usePaginationStore((state) => state.setPage);
  const recoveredPagination = usePaginationStore((state) => state.scopes[RECOVERED_SCOPE] || DEFAULT_PAGINATION);
  const outstandingPagination = usePaginationStore((state) => state.scopes[OUTSTANDING_SCOPE] || DEFAULT_PAGINATION);
  const usersPagination = usePaginationStore((state) => state.scopes[USERS_SCOPE] || DEFAULT_PAGINATION);
  const customerProfitabilityPagination = usePaginationStore((state) => state.scopes[CUSTOMER_PROFITABILITY_SCOPE] || DEFAULT_PAGINATION);
  const loanProfitabilityPagination = usePaginationStore((state) => state.scopes[LOAN_PROFITABILITY_SCOPE] || DEFAULT_PAGINATION);

  useEffect(() => {
    ensurePaginationScope(RECOVERED_SCOPE, DEFAULT_PAGINATION);
    ensurePaginationScope(OUTSTANDING_SCOPE, DEFAULT_PAGINATION);
    ensurePaginationScope(USERS_SCOPE, DEFAULT_PAGINATION);
    ensurePaginationScope(CUSTOMER_PROFITABILITY_SCOPE, DEFAULT_PAGINATION);
    ensurePaginationScope(LOAN_PROFITABILITY_SCOPE, DEFAULT_PAGINATION);
  }, [ensurePaginationScope]);

  const recoveryReportQuery = useRecoveryReportQuery({ enabled: !isSocio });
  const recoveredLoansQuery = useRecoveredLoansQuery({ enabled: !isSocio && activeTab === 'recovered', pagination: recoveredPagination });
  const outstandingLoansQuery = useOutstandingLoansQuery({ enabled: !isSocio && activeTab === 'outstanding', pagination: outstandingPagination });
  const associateProfitabilityQuery = useAssociateProfitabilityQuery(null, { enabled: isSocio });
  const associatePortalQuery = useAssociatePortalQuery(null, { enabled: isSocio });
  const creditHistoryQuery = useLoanCreditHistoryQuery(selectedHistoryLoanId, {
    enabled: !isSocio && Boolean(selectedHistoryLoanId),
  });
  const customerCreditProfileQuery = useCustomerCreditProfileQuery(selectedCustomerProfileId, {
    enabled: isAdmin && Boolean(selectedCustomerProfileId),
  });
  const customerProfitabilityQuery = useCustomerProfitabilityQuery({ enabled: !isSocio && activeTab === 'overview', pagination: customerProfitabilityPagination });
  const loanProfitabilityQuery = useLoanProfitabilityQuery({ enabled: !isSocio && activeTab === 'overview', pagination: loanProfitabilityPagination });

  const usersQuery = useUsersQuery({ enabled: isAdmin && activeTab === 'users', pagination: usersPagination });
  const updateUserMutation = useUpdateUserMutation();
  const deactivateUserMutation = useDeactivateUserMutation();
  const reactivateUserMutation = useReactivateUserMutation();
  const users = Array.isArray(usersQuery.data?.items)
    ? usersQuery.data.items
    : usersQuery.data?.data || [];
  const currentUserId = Number(user.id);

  useEffect(() => {
    const sourceError = recoveryReportQuery.error
      || recoveredLoansQuery.error
      || outstandingLoansQuery.error
      || associateProfitabilityQuery.error
      || associatePortalQuery.error
      || creditHistoryQuery.error
      || customerCreditProfileQuery.error
      || customerProfitabilityQuery.error
      || loanProfitabilityQuery.error
      || usersQuery.error;

    if (sourceError) {
      handleApiError(sourceError, setError);
    }
  }, [
    associatePortalQuery.error,
    associateProfitabilityQuery.error,
    creditHistoryQuery.error,
    customerCreditProfileQuery.error,
    customerProfitabilityQuery.error,
    loanProfitabilityQuery.error,
    outstandingLoansQuery.error,
    recoveredLoansQuery.error,
    recoveryReportQuery.error,
    usersQuery.error,
  ]);

  const recoverySummary = recoveryReportQuery.data?.summary
    || recoveryReportQuery.data?.data?.summary
    || recoveryReportQuery.data?.data?.report?.summary
    || null;
  const recoveredLoans = recoveredLoansQuery.data?.items || recoveredLoansQuery.data?.data?.loans || [];
  const outstandingLoans = outstandingLoansQuery.data?.items || outstandingLoansQuery.data?.data?.loans || [];
  const partnerReport = associateProfitabilityQuery.data?.data?.report || null;
  const partnerPortal = associatePortalQuery.data?.data?.portal || null;
  const creditHistory = creditHistoryQuery.data?.data?.history || null;
  const customerCreditProfile = customerCreditProfileQuery.data?.data || null;
  const customerProfitability = customerProfitabilityQuery.data?.items || customerProfitabilityQuery.data?.data?.customers || [];
  const loanProfitability = loanProfitabilityQuery.data?.items || loanProfitabilityQuery.data?.data?.loans || [];
  const recoveredPaginationMeta = recoveredLoansQuery.data?.pagination || recoveredLoansQuery.data?.data?.pagination || null;
  const outstandingPaginationMeta = outstandingLoansQuery.data?.pagination || outstandingLoansQuery.data?.data?.pagination || null;
  const usersPaginationMeta = usersQuery.data?.pagination || usersQuery.data?.data?.pagination || null;
  const customerProfitabilityPaginationMeta = customerProfitabilityQuery.data?.pagination || customerProfitabilityQuery.data?.data?.pagination || null;
  const loanProfitabilityPaginationMeta = loanProfitabilityQuery.data?.pagination || loanProfitabilityQuery.data?.data?.pagination || null;
  const loading = isSocio ? associateProfitabilityQuery.isLoading : recoveryReportQuery.isLoading;

  const clearMessages = () => {
    setError('');
    setSuccess('');
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
      showSuccess(t('reports.workspace.userRoleUpdated'));
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleDeactivateUser = async (targetUser) => {
    if (!window.confirm(t('reports.workspace.deactivateConfirm', { name: targetUser.name }))) {
      return;
    }

    clearMessages();

    try {
      await deactivateUserMutation.mutateAsync(targetUser.id);
      showSuccess(t('reports.workspace.userDeactivated'));
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleReactivateUser = async (targetUser) => {
    clearMessages();

    try {
      await reactivateUserMutation.mutateAsync(targetUser.id);
      showSuccess(t('reports.workspace.userReactivated'));
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
          customerProfitabilityQuery.refetch(),
          loanProfitabilityQuery.refetch(),
          ...(selectedCustomerProfileId ? [customerCreditProfileQuery.refetch()] : []),
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
    const exportAssociateId = partnerReport?.associate?.id || partnerPortal?.associate?.id;
    if (!exportAssociateId) {
      setError(t('reports.workspace.selectAssociateToExport'));
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

  const handleCustomerProfileExport = async (format = 'pdf') => {
    if (!selectedCustomerProfileId) {
      setError(t('reports.workspace.selectCustomerToExport'));
      return;
    }

    try {
      await downloadFile({
        loader: () => reportService.exportCustomerCreditProfile(selectedCustomerProfileId, format),
        filename: `customer-${selectedCustomerProfileId}-credit-profile.${format}`,
      });
    } catch (exportError) {
      handleApiError(exportError, setError);
    }
  };

  const handleLoanHistoryExport = async (format = 'pdf') => {
    if (!selectedHistoryLoanId) {
      setError(t('reports.workspace.selectLoanToExport'));
      return;
    }

    try {
      await downloadFile({
        loader: () => reportService.exportLoanCreditHistory(selectedHistoryLoanId, format),
        filename: `loan-${selectedHistoryLoanId}-credit-history.${format}`,
      });
    } catch (exportError) {
      handleApiError(exportError, setError);
    }
  };

  const headlineMetrics = useMemo(() => {
    if (user.role === 'socio') {
      return [
        {
          label: t('reports.workspace.summary.totalContributed'),
          value: formatCurrency(partnerReport?.summary?.totalContributed || 0),
          caption: t('reports.workspace.summary.totalContributedCaption'),
          tone: 'brand',
        },
        {
          label: t('reports.workspace.summary.totalDistributed'),
          value: formatCurrency(partnerReport?.summary?.totalDistributed || 0),
          caption: t('reports.workspace.summary.totalDistributedCaption'),
          tone: 'success',
        },
        {
          label: t('reports.workspace.summary.linkedLoans'),
          value: partnerReport?.summary?.loanCount || 0,
          caption: t('reports.workspace.summary.linkedLoansCaption'),
          tone: 'info',
        },
      ];
    }

    if (!recoverySummary) return [];
    return [
      { label: t('reports.workspace.summary.totalLoans'), value: recoverySummary.totalLoans, caption: t('reports.workspace.summary.totalLoansCaption'), tone: 'brand' },
      { label: t('reports.workspace.summary.recoveredLoans'), value: recoverySummary.recoveredLoans, caption: t('reports.workspace.summary.recoveredLoansCaption'), tone: 'success' },
      { label: t('reports.workspace.summary.outstandingLoans'), value: recoverySummary.outstandingLoans, caption: t('reports.workspace.summary.outstandingLoansCaption'), tone: 'warning' },
      { label: t('reports.workspace.summary.recoveryRate'), value: recoverySummary.recoveryRate, caption: t('reports.workspace.summary.recoveryRateCaption'), tone: 'info' },
    ];
  }, [partnerReport, recoverySummary, t, user.role]);

  const amountMetrics = useMemo(() => {
    if (!recoverySummary) return [];
    return [
      { label: t('reports.workspace.summary.recoveredAmount'), value: formatCurrency(recoverySummary.totalRecoveredAmount), tone: 'success' },
      { label: t('reports.workspace.summary.outstandingAmount'), value: formatCurrency(recoverySummary.totalOutstandingAmount), tone: 'warning' },
      { label: t('reports.workspace.summary.portfolioAmount'), value: formatCurrency(recoverySummary.totalLoansAmount), tone: 'brand' },
    ];
  }, [recoverySummary, t]);

  if (loading && !recoverySummary && !partnerReport) {
    return (
        <StatePanel
          icon="⏳"
          title={t('reports.workspace.loadingTitle')}
          message={t('reports.workspace.loadingMessage')}
          loadingState
        />
    );
  }

  if (error && !recoverySummary && !partnerReport) {
    return (
        <StatePanel
          icon="⚠️"
          title={t('reports.workspace.errorTitle')}
          message={error}
          action={<Button onClick={loadReports}>{t('common.actions.tryAgain')}</Button>}
        />
    );
  }

  return (
    <div className="dashboard-page-stack reports-page">
      <ReportsHeroSection
        role={user.role}
        headlineMetrics={headlineMetrics}
        refreshing={refreshing}
        refreshSuccess={refreshSuccess}
        onRefresh={loadReports}
        onExport={handleExport}
        onExportAssociate={handleAssociateExport}
      />

      {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}
      {success && <div className="inline-message inline-message--success">✅ {success}</div>}

      {!isSocio && (
        <>
          <ReportsPortfolioSection
            isAdmin={isAdmin}
            recoverySummary={recoverySummary}
            amountMetrics={amountMetrics}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            recoveredLoans={recoveredLoans}
            outstandingLoans={outstandingLoans}
            users={users}
            usersLoading={usersQuery.isLoading}
            editingUser={editingUser}
            userRoleForm={userRoleForm}
            currentUserId={currentUserId}
            updateUserPending={updateUserMutation.isPending}
            deactivatePending={deactivateUserMutation.isPending}
            reactivatePending={reactivateUserMutation.isPending}
            onRoleChange={(role) => setUserRoleForm({ role })}
            onStartEdit={(targetUser) => {
              clearMessages();
              setEditingUser(targetUser.id);
              setUserRoleForm({ role: targetUser.role });
            }}
            onCancelEdit={() => setEditingUser(null)}
            onSaveRole={handleUserRoleSave}
            onDeactivate={handleDeactivateUser}
            onReactivate={handleReactivateUser}
            recoveredPagination={recoveredPaginationMeta}
            outstandingPagination={outstandingPaginationMeta}
            usersPagination={usersPaginationMeta}
            onRecoveredPageChange={(page) => setPage(RECOVERED_SCOPE, page)}
            onOutstandingPageChange={(page) => setPage(OUTSTANDING_SCOPE, page)}
            onUsersPageChange={(page) => setPage(USERS_SCOPE, page)}
          />

          {isAdmin && (
        <ReportsAdminSection
              selectedHistoryLoanId={selectedHistoryLoanId}
              setSelectedHistoryLoanId={setSelectedHistoryLoanId}
              creditHistory={creditHistory}
              selectedCustomerProfileId={selectedCustomerProfileId}
              setSelectedCustomerProfileId={setSelectedCustomerProfileId}
              customerCreditProfile={customerCreditProfile}
              customerProfitability={customerProfitability}
              loanProfitability={loanProfitability}
              customerProfitabilityPagination={customerProfitabilityPaginationMeta}
          loanProfitabilityPagination={loanProfitabilityPaginationMeta}
          onCustomerProfitabilityPageChange={(page) => setPage(CUSTOMER_PROFITABILITY_SCOPE, page)}
          onLoanProfitabilityPageChange={(page) => setPage(LOAN_PROFITABILITY_SCOPE, page)}
          onExportCustomerProfile={handleCustomerProfileExport}
          onExportLoanHistory={handleLoanHistoryExport}
        />
          )}
        </>
      )}

      {isSocio && <ReportsPartnerSection partnerReport={partnerReport} partnerPortal={partnerPortal} />}
    </div>
  );
}

export default ReportsWorkspace;
