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
  useAssociatesQuery,
  useCreateAssociateContributionMutation,
  useCreateAssociateDistributionMutation,
  useCreateAssociateMutation,
  useCreateAssociateReinvestmentMutation,
  useCreateProportionalDistributionMutation,
  useDeleteAssociateMutation,
  useUpdateAssociateMutation,
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

import {
  emptyAssociateForm,
  emptyMoneyForm,
  emptyProportionalForm,
} from '@/features/reports/reportsWorkspace.constants';
import { formatCurrency } from '@/features/reports/reportsWorkspace.utils';
import ReportsAdminSection from '@/features/reports/sections/ReportsAdminSection';
import ReportsHeroSection from '@/features/reports/sections/ReportsHeroSection';
import ReportsPartnerSection from '@/features/reports/sections/ReportsPartnerSection';
import ReportsPortfolioSection from '@/features/reports/sections/ReportsPortfolioSection';

function ReportsWorkspace({ user }) {
  const { t } = useTranslation()
  const isSocio = user.role === 'socio';
  const isAdmin = user.role === 'admin';

  const [selectedHistoryLoanId, setSelectedHistoryLoanId] = useState('');
  const [selectedCustomerProfileId, setSelectedCustomerProfileId] = useState('');
  const [selectedAssociateId, setSelectedAssociateId] = useState('');
  const [associateForm, setAssociateForm] = useState(emptyAssociateForm);
  const [contributionForm, setContributionForm] = useState(emptyMoneyForm);
  const [distributionForm, setDistributionForm] = useState(emptyMoneyForm);
  const [reinvestmentForm, setReinvestmentForm] = useState(emptyMoneyForm);
  const [proportionalForm, setProportionalForm] = useState(emptyProportionalForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userRoleForm, setUserRoleForm] = useState({ role: '' });

  const recoveryReportQuery = useRecoveryReportQuery({ enabled: !isSocio });
  const recoveredLoansQuery = useRecoveredLoansQuery({ enabled: !isSocio && activeTab === 'recovered' });
  const outstandingLoansQuery = useOutstandingLoansQuery({ enabled: !isSocio && activeTab === 'outstanding' });
  const associateProfitabilityQuery = useAssociateProfitabilityQuery(null, { enabled: isSocio });
  const associatePortalQuery = useAssociatePortalQuery(null, { enabled: isSocio });
  const creditHistoryQuery = useLoanCreditHistoryQuery(selectedHistoryLoanId, {
    enabled: !isSocio && Boolean(selectedHistoryLoanId),
  });
  const customerCreditProfileQuery = useCustomerCreditProfileQuery(selectedCustomerProfileId, {
    enabled: isAdmin && Boolean(selectedCustomerProfileId),
  });
  const customerProfitabilityQuery = useCustomerProfitabilityQuery({ enabled: !isSocio && activeTab === 'overview' });
  const loanProfitabilityQuery = useLoanProfitabilityQuery({ enabled: !isSocio && activeTab === 'overview' });

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
  const createReinvestmentMutation = useCreateAssociateReinvestmentMutation(selectedAssociateId || null);
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

  const usersQuery = useUsersQuery({ enabled: isAdmin && activeTab === 'users' });
  const updateUserMutation = useUpdateUserMutation();
  const deactivateUserMutation = useDeactivateUserMutation();
  const reactivateUserMutation = useReactivateUserMutation();
  const users = usersQuery.data?.data || [];
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
    customerCreditProfileQuery.error,
    customerProfitabilityQuery.error,
    loanProfitabilityQuery.error,
    outstandingLoansQuery.error,
    recoveredLoansQuery.error,
    recoveryReportQuery.error,
    selectedAssociatePortalQuery.error,
    selectedAssociateProfitabilityQuery.error,
    usersQuery.error,
  ]);

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
  const customerCreditProfile = customerCreditProfileQuery.data?.data || null;
  const customerProfitability = customerProfitabilityQuery.data?.data?.customers || [];
  const loanProfitability = loanProfitabilityQuery.data?.data?.loans || [];
  const loading = isSocio ? associateProfitabilityQuery.isLoading : recoveryReportQuery.isLoading;

  const resetAssociateActionForms = () => {
    setContributionForm(emptyMoneyForm);
    setDistributionForm(emptyMoneyForm);
    setReinvestmentForm(emptyMoneyForm);
    setProportionalForm(emptyProportionalForm);
  };

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
          associatesQuery.refetch(),
          ...(selectedAssociateId ? [selectedAssociatePortalQuery.refetch(), selectedAssociateProfitabilityQuery.refetch()] : []),
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
    const exportAssociateId = selectedAssociateId || partnerReport?.associate?.id || partnerPortal?.associate?.id;
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

  const handleCreateAssociate = async (event) => {
    event.preventDefault();
    try {
      await createAssociateMutation.mutateAsync({
        ...associateForm,
        participationPercentage: associateForm.participationPercentage || undefined,
      });
      setAssociateForm(emptyAssociateForm);
      showSuccess(t('reports.workspace.associateCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleUpdateAssociate = async () => {
    if (!selectedAssociateId) {
      setError(t('reports.workspace.selectAssociateToUpdate'));
      return;
    }

    try {
      await updateAssociateMutation.mutateAsync({
        ...associateForm,
        participationPercentage: associateForm.participationPercentage || undefined,
      });
      showSuccess(t('reports.workspace.associateUpdated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleDeleteAssociate = async () => {
    if (!selectedAssociateId) {
      setError(t('reports.workspace.selectAssociateToDelete'));
      return;
    }

    if (!window.confirm(t('reports.workspace.deleteAssociateConfirm'))) {
      return;
    }

    try {
      await deleteAssociateMutation.mutateAsync(selectedAssociateId);
      setSelectedAssociateId('');
      setAssociateForm(emptyAssociateForm);
      resetAssociateActionForms();
      showSuccess(t('reports.workspace.associateDeleted'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateContribution = async () => {
    if (!selectedAssociateId) {
      setError(t('reports.workspace.selectAssociateForContribution'));
      return;
    }

    try {
      await createContributionMutation.mutateAsync({
        amount: contributionForm.amount,
        notes: contributionForm.notes || undefined,
        contributionDate: contributionForm.contributionDate || undefined,
      });
      setContributionForm(emptyMoneyForm);
      showSuccess(t('reports.workspace.contributionCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateDistribution = async () => {
    if (!selectedAssociateId) {
      setError(t('reports.workspace.selectAssociateForDistribution'));
      return;
    }

    try {
      await createDistributionMutation.mutateAsync({
        amount: distributionForm.amount,
        notes: distributionForm.notes || undefined,
        distributionDate: distributionForm.distributionDate || undefined,
      });
      setDistributionForm(emptyMoneyForm);
      showSuccess(t('reports.workspace.distributionCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateReinvestment = async () => {
    if (!selectedAssociateId) {
      setError(t('reports.workspace.selectAssociateForDistribution'));
      return;
    }

    try {
      await createReinvestmentMutation.mutateAsync({
        amount: reinvestmentForm.amount,
        notes: reinvestmentForm.notes || undefined,
        reinvestmentDate: reinvestmentForm.distributionDate || undefined,
      });
      setReinvestmentForm(emptyMoneyForm);
      showSuccess(t('reports.workspace.reinvestmentCreated'));
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
      showSuccess(t('reports.workspace.proportionalCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
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

  if (error && !recoverySummary && !partnerReport && (!isAdmin || !associates.length)) {
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
        selectedAssociateId={selectedAssociateId}
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
              selectedAssociateId={selectedAssociateId}
              associates={associates}
              associateForm={associateForm}
              contributionForm={contributionForm}
              distributionForm={distributionForm}
              reinvestmentForm={reinvestmentForm}
              proportionalForm={proportionalForm}
              selectedAssociatePortal={selectedAssociatePortal}
              selectedAssociateProfitability={selectedAssociateProfitability}
              createAssociatePending={createAssociateMutation.isPending}
              updateAssociatePending={updateAssociateMutation.isPending}
              deleteAssociatePending={deleteAssociateMutation.isPending}
              createContributionPending={createContributionMutation.isPending}
              createDistributionPending={createDistributionMutation.isPending}
              createReinvestmentPending={createReinvestmentMutation.isPending}
              createProportionalPending={createProportionalDistributionMutation.isPending}
              onSelectAssociate={setSelectedAssociateId}
              onAssociateFormChange={(field, value) => setAssociateForm((current) => ({ ...current, [field]: value }))}
              onCreateAssociate={handleCreateAssociate}
              onUpdateAssociate={handleUpdateAssociate}
              onDeleteAssociate={handleDeleteAssociate}
              onContributionFormChange={(field, value) => setContributionForm((current) => ({ ...current, [field]: value }))}
              onCreateContribution={handleCreateContribution}
              onDistributionFormChange={(field, value) => setDistributionForm((current) => ({ ...current, [field]: value }))}
              onCreateDistribution={handleCreateDistribution}
              onReinvestmentFormChange={(field, value) => setReinvestmentForm((current) => ({ ...current, [field]: value }))}
              onCreateReinvestment={handleCreateReinvestment}
              onProportionalFormChange={(field, value) => setProportionalForm((current) => ({ ...current, [field]: value }))}
              onCreateProportionalDistribution={handleCreateProportionalDistribution}
            />
          )}
        </>
      )}

      {isSocio && <ReportsPartnerSection partnerReport={partnerReport} partnerPortal={partnerPortal} />}
    </div>
  );
}

export default ReportsWorkspace;
