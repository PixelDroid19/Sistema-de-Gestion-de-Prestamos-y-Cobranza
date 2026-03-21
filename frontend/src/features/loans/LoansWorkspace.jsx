import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useDeleteCustomerDocumentMutation, useUploadCustomerDocumentMutation } from '@/hooks/useCustomers';
import {
  useAssignAgentMutation,
  useCreateLoanMutation,
  useCreateLoanFollowUpMutation,
  useCreateLoanPromiseMutation,
  useDeleteLoanMutation,
  useLoanServicingQueries,
  useLoansQuery,
  useSimulateLoanMutation,
  useUpdateLoanAlertStatusMutation,
  useUpdateLoanStatusMutation,
  useUpdateLoanPromiseStatusMutation,
  useUpdateRecoveryStatusMutation,
  useUploadLoanAttachmentMutation,
} from '@/hooks/useLoans';
import { downloadFile } from '@/lib/api/download';
import { queryKeys } from '@/lib/api/queryKeys';
import { handleApiError } from '@/lib/api/errors';
import { customerService } from '@/services/customerService';
import { loanService } from '@/services/loanService';
import { reportService } from '@/services/reportService';

import {
  emptyAttachmentDraft,
  emptyCustomerDocumentDraft,
  emptyPromiseDraft,
} from '@/features/loans/loansWorkspace.constants';
import {
  calculateSuggestedInterestRate,
  getFirstQueryError,
  getLoanDetails,
  mapQueriesById,
  formatCurrency,
} from '@/features/loans/loansWorkspace.utils';
import LoanApplicationSection from '@/features/loans/sections/LoanApplicationSection';
import LoansHeroSection from '@/features/loans/sections/LoansHeroSection';
import LoansPortfolioSection from '@/features/loans/sections/LoansPortfolioSection';
import LoansServicingSection from '@/features/loans/sections/LoansServicingSection';

function LoansWorkspace({ user }) {
  const { t } = useTranslation()
  const [applicationForm, setApplicationForm] = useState({ amount: '', interestRate: '', termMonths: '' });
  const [simulation, setSimulation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assignAgentId, setAssignAgentId] = useState({});
  const [recoveryDrafts, setRecoveryDrafts] = useState({});
  const [editingRecovery, setEditingRecovery] = useState({});
  const [promiseDrafts, setPromiseDrafts] = useState({});
  const [attachmentDrafts, setAttachmentDrafts] = useState({});
  const [customerDocumentDrafts, setCustomerDocumentDrafts] = useState({});
  const [pendingStatusLoans, setPendingStatusLoans] = useState({});
  const [pendingAssignAgents, setPendingAssignAgents] = useState({});
  const [pendingRecovery, setPendingRecovery] = useState({});
  const [pendingDeleteLoans, setPendingDeleteLoans] = useState({});
  const [pendingPromises, setPendingPromises] = useState({});
  const [followUpDrafts, setFollowUpDrafts] = useState({});
  const [pendingFollowUps, setPendingFollowUps] = useState({});

  const loansQuery = useLoansQuery({ user });
  const createLoanMutation = useCreateLoanMutation(user);
  const simulateLoanMutation = useSimulateLoanMutation();
  const updateLoanStatusMutation = useUpdateLoanStatusMutation(user);
  const assignAgentMutation = useAssignAgentMutation(user);
  const updateRecoveryStatusMutation = useUpdateRecoveryStatusMutation(user);
  const createLoanPromiseMutation = useCreateLoanPromiseMutation(user);
  const createLoanFollowUpMutation = useCreateLoanFollowUpMutation(user);
  const updateLoanAlertStatusMutation = useUpdateLoanAlertStatusMutation(user);
  const updateLoanPromiseStatusMutation = useUpdateLoanPromiseStatusMutation(user);
  const uploadLoanAttachmentMutation = useUploadLoanAttachmentMutation(user);
  const deleteLoanMutation = useDeleteLoanMutation(user);
  const uploadCustomerDocumentMutation = useUploadCustomerDocumentMutation();
  const deleteCustomerDocumentMutation = useDeleteCustomerDocumentMutation();

  const loans = useMemo(() => {
    if (Array.isArray(loansQuery.data?.data?.loans)) return loansQuery.data.data.loans;
    if (Array.isArray(loansQuery.data?.data)) return loansQuery.data.data;
    return [];
  }, [loansQuery.data]);

  const loanIds = useMemo(() => loans.map((loan) => loan.id), [loans]);
  const customerIds = useMemo(
    () => [...new Set(loans.map((loan) => Number(loan.customerId || loan.Customer?.id)).filter(Boolean))],
    [loans],
  );

  const { paymentQueries, alertQueries, promiseQueries, attachmentQueries } = useLoanServicingQueries(loans, user);

  const customerDocumentQueries = useQueries({
    queries: customerIds.map((customerId) => ({
      queryKey: queryKeys.customers.documents(customerId),
      queryFn: () => customerService.listDocuments(customerId),
      enabled: Boolean(customerId),
    })),
  });

  const customerHistoryQueries = useQueries({
    queries: customerIds.map((customerId) => ({
      queryKey: queryKeys.customers.history(customerId),
      queryFn: () => reportService.getCustomerHistory(customerId),
      enabled: Boolean(customerId) && user.role === 'admin',
    })),
  });

  const paymentsByLoan = useMemo(
    () => mapQueriesById(loanIds, paymentQueries, (data) => data?.data),
    [loanIds, paymentQueries],
  );
  const alertsByLoan = useMemo(
    () => mapQueriesById(loanIds, alertQueries, (data) => data?.data?.alerts),
    [loanIds, alertQueries],
  );
  const promisesByLoan = useMemo(
    () => mapQueriesById(loanIds, promiseQueries, (data) => data?.data?.promises),
    [loanIds, promiseQueries],
  );
  const attachmentsByLoan = useMemo(
    () => mapQueriesById(loanIds, attachmentQueries, (data) => data?.data?.attachments),
    [loanIds, attachmentQueries],
  );
  const customerDocumentsByCustomer = useMemo(
    () => mapQueriesById(customerIds, customerDocumentQueries, (data) => data?.data?.documents),
    [customerDocumentQueries, customerIds],
  );
  const customerHistoryByCustomer = useMemo(
    () => customerIds.reduce((result, customerId, index) => {
      result[customerId] = customerHistoryQueries[index]?.data?.data || null;
      return result;
    }, {}),
    [customerHistoryQueries, customerIds],
  );

  const loadingServicing = paymentQueries.some((query) => query.isLoading)
    || alertQueries.some((query) => query.isLoading)
    || promiseQueries.some((query) => query.isLoading)
    || attachmentQueries.some((query) => query.isLoading);

  const firstSupportingError = loansQuery.error
    || getFirstQueryError(paymentQueries)
    || getFirstQueryError(alertQueries)
    || getFirstQueryError(promiseQueries)
    || getFirstQueryError(attachmentQueries)
    || getFirstQueryError(customerDocumentQueries)
    || getFirstQueryError(customerHistoryQueries);

  useEffect(() => {
    if (!firstSupportingError) return;
    handleApiError(firstSupportingError, setError);
  }, [firstSupportingError]);

  const successTimeoutRef = useRef(null);

  const clearMessages = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    setError('');
    setSuccess('');
  };

  const showSuccess = (message) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    setSuccess(message);
    setError('');
    successTimeoutRef.current = setTimeout(() => {
      setSuccess((current) => (current === message ? '' : current));
      successTimeoutRef.current = null;
    }, 4000);
  };

  const handleApplicationFormChange = (event) => {
    const { name, value } = event.target;

    setApplicationForm((current) => {
      const nextState = { ...current, [name]: value };
      if (name === 'amount' || name === 'termMonths') {
        nextState.interestRate = calculateSuggestedInterestRate(
          name === 'amount' ? value : current.amount,
          name === 'termMonths' ? value : current.termMonths,
        );
      }

      return nextState;
    });
  };

  const handleApply = async (event) => {
    event.preventDefault();
    clearMessages();

    try {
      await createLoanMutation.mutateAsync({
        customerId: user.id,
        amount: Number(applicationForm.amount),
        interestRate: Number(applicationForm.interestRate),
        termMonths: Number(applicationForm.termMonths),
      });

      setApplicationForm({ amount: '', interestRate: '', termMonths: '' });
      setSimulation(null);
      showSuccess(t('loans.workspace.loanSubmitted'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleSimulate = async () => {
    clearMessages();

    try {
      const response = await simulateLoanMutation.mutateAsync({
        amount: Number(applicationForm.amount),
        interestRate: Number(applicationForm.interestRate),
        termMonths: Number(applicationForm.termMonths),
      });

      setSimulation(response?.data?.simulation || null);
      showSuccess(t('loans.workspace.simulationGenerated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleLoanStatus = async (loanId, status) => {
    clearMessages();
    setPendingStatusLoans((current) => ({ ...current, [loanId]: true }));

    try {
      await updateLoanStatusMutation.mutateAsync({ loanId, status });
      showSuccess(t('loans.workspace.loanMarked', { status }));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingStatusLoans((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleAssignAgent = async (loanId) => {
    clearMessages();
    setPendingAssignAgents((current) => ({ ...current, [loanId]: true }));

    try {
      await assignAgentMutation.mutateAsync({ loanId, agentId: Number(assignAgentId[loanId]) });
      showSuccess(t('loans.workspace.agentAssigned'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingAssignAgents((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleRecoverySave = async (loanId) => {
    clearMessages();
    setPendingRecovery((current) => ({ ...current, [loanId]: true }));

    try {
      await updateRecoveryStatusMutation.mutateAsync({
        loanId,
        recoveryStatus: recoveryDrafts[loanId],
      });

      setEditingRecovery((current) => ({ ...current, [loanId]: false }));
      showSuccess(t('loans.workspace.recoveryUpdated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingRecovery((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleDeleteLoan = async (loanId) => {
    if (!window.confirm(t('loans.workspace.deleteConfirm'))) {
      return;
    }

    clearMessages();
    setPendingDeleteLoans((current) => ({ ...current, [loanId]: true }));

    try {
      await deleteLoanMutation.mutateAsync(loanId);
      showSuccess(t('loans.workspace.loanDeleted'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingDeleteLoans((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleCreatePromise = async (loanId) => {
    clearMessages();
    setPendingPromises((current) => ({ ...current, [loanId]: true }));

    try {
      await createLoanPromiseMutation.mutateAsync({
        loanId,
        payload: promiseDrafts[loanId] || emptyPromiseDraft,
      });

      setPromiseDrafts((current) => ({ ...current, [loanId]: emptyPromiseDraft }));
      showSuccess(t('loans.workspace.promiseCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingPromises((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleCreateFollowUp = async (loanId) => {
    clearMessages();
    setPendingFollowUps((current) => ({ ...current, [loanId]: true }));

    try {
      const draft = followUpDrafts[loanId] || {};
      await createLoanFollowUpMutation.mutateAsync({
        loanId,
        payload: {
          installmentNumber: draft.installmentNumber || 0,
          dueDate: draft.dueDate,
          outstandingAmount: draft.outstandingAmount,
          notes: draft.notes,
          notifyCustomer: true,
        },
      });
      setFollowUpDrafts((current) => ({ ...current, [loanId]: {} }));
      showSuccess(t('loans.workspace.followUpCreated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingFollowUps((current) => {
        const next = { ...current };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleResolveAlert = async (loanId, alertId) => {
    clearMessages();

    try {
      await updateLoanAlertStatusMutation.mutateAsync({
        loanId,
        alertId,
        payload: { status: 'resolved', resolutionSource: 'manual_follow_up', notes: 'Resolved from servicing workspace' },
      });
      showSuccess(t('loans.workspace.alertResolved'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handlePromiseStatus = async (loanId, promiseId, status) => {
    clearMessages();

    try {
      await updateLoanPromiseStatusMutation.mutateAsync({
        loanId,
        promiseId,
        payload: { status, notes: `Promise marked ${status}` },
      });
      showSuccess(t('loans.workspace.promiseUpdated'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleCreateAttachment = async (loanId) => {
    const attachmentDraft = attachmentDrafts[loanId] || emptyAttachmentDraft;

    if (!attachmentDraft.file) {
      setError(t('loans.workspace.chooseAttachment'));
      return;
    }

    clearMessages();

    try {
      const formData = new FormData();
      formData.append('file', attachmentDraft.file);
      formData.append('customerVisible', String(Boolean(attachmentDraft.customerVisible)));
      if (attachmentDraft.category) formData.append('category', attachmentDraft.category);
      if (attachmentDraft.description) formData.append('description', attachmentDraft.description);

      await uploadLoanAttachmentMutation.mutateAsync({ loanId, formData });
      setAttachmentDrafts((current) => ({ ...current, [loanId]: emptyAttachmentDraft }));
      showSuccess(t('loans.workspace.attachmentUploaded'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleUploadCustomerDocument = async (customerId) => {
    const draft = customerDocumentDrafts[customerId] || emptyCustomerDocumentDraft;

    if (!draft.file) {
      setError(t('loans.workspace.chooseCustomerDocument'));
      return;
    }

    clearMessages();

    try {
      const formData = new FormData();
      formData.append('file', draft.file);
      formData.append('customerVisible', String(Boolean(draft.customerVisible)));
      if (draft.category) formData.append('category', draft.category);
      if (draft.description) formData.append('description', draft.description);

      await uploadCustomerDocumentMutation.mutateAsync({ customerId, formData });
      setCustomerDocumentDrafts((current) => ({ ...current, [customerId]: emptyCustomerDocumentDraft }));
      showSuccess(t('loans.workspace.customerDocumentUploaded'));
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleDownloadLoanAttachment = async (loanId, attachmentId, fileName) => {
    clearMessages();

    try {
      await downloadFile({
        loader: () => loanService.downloadLoanAttachment(loanId, attachmentId),
        filename: fileName,
        fallbackFilename: `loan-attachment-${attachmentId}`,
      });
    } catch (downloadError) {
      handleApiError(downloadError, setError);
    }
  };

  const handleDownloadCustomerDocument = async (customerId, documentId, fileName) => {
    clearMessages();

    try {
      await downloadFile({
        loader: () => customerService.downloadDocument(customerId, documentId),
        filename: fileName,
        fallbackFilename: `customer-document-${documentId}`,
      });
    } catch (downloadError) {
      handleApiError(downloadError, setError);
    }
  };

  const handleDeleteCustomerDocument = async (customerId, documentId) => {
    clearMessages();

    try {
      await deleteCustomerDocumentMutation.mutateAsync({ customerId, documentId });
      showSuccess(t('loans.workspace.customerDocumentDeleted'));
    } catch (deleteError) {
      handleApiError(deleteError, setError);
    }
  };

  const handleDownloadPromise = async (loanId, promiseId) => {
    clearMessages();

    try {
      await downloadFile({
        loader: () => loanService.downloadLoanPromise(loanId, promiseId),
        filename: `promise-to-pay-${promiseId}.pdf`,
        fallbackFilename: `promise-${promiseId}`,
      });
    } catch (downloadError) {
      handleApiError(downloadError, setError);
    }
  };

  const summaryCards = useMemo(() => {
    const approvedCount = loans.filter((loan) => loan.status === 'approved').length;
    const pendingCount = loans.filter((loan) => loan.status === 'pending').length;
    const activeRecoveryCount = loans.filter((loan) => loan.recoveryStatus === 'in_progress').length;
    const outstandingBalance = loans.reduce((sum, loan) => {
      const details = getLoanDetails(loan, paymentsByLoan[loan.id] || []);
      return sum + Number(details.balance || 0);
    }, 0);
    const activeAlerts = Object.values(alertsByLoan).reduce(
      (sum, alerts) => sum + alerts.filter((alert) => alert.status === 'active').length,
      0,
    );

    return [
        {
          label: user.role === 'agent' ? t('loans.workspace.summary.assignedLoans') : t('loans.workspace.summary.visibleLoans'),
          value: loans.length,
          caption: user.role === 'customer' ? t('loans.workspace.summary.customerLoansCaption') : t('loans.workspace.summary.assignedLoansCaption'),
          tone: 'brand',
        },
        {
          label: user.role === 'agent' ? t('loans.workspace.summary.recoveryQueue') : t('loans.workspace.summary.approvedLoans'),
          value: user.role === 'agent' ? activeRecoveryCount : approvedCount,
          caption: user.role === 'agent' ? t('loans.workspace.summary.recoveryQueueCaption') : t('loans.workspace.summary.approvedLoansCaption'),
          tone: 'success',
        },
        {
          label: t('loans.workspace.summary.pendingReview'),
          value: pendingCount,
          caption: user.role === 'customer' ? t('loans.workspace.summary.pendingReviewCustomerCaption') : t('loans.workspace.summary.pendingReviewCaption'),
          tone: 'warning',
        },
        {
          label: user.role === 'customer' ? t('loans.workspace.summary.outstandingBalance') : t('loans.workspace.summary.activeAlerts'),
          value: user.role === 'customer' ? formatCurrency(outstandingBalance) : activeAlerts,
          caption: user.role === 'customer' ? t('loans.workspace.summary.outstandingBalanceCaption') : t('loans.workspace.summary.activeAlertsCaption'),
          tone: 'info',
        },
      ];
  }, [alertsByLoan, loans, paymentsByLoan, t, user.role]);

  return (
    <div className="dashboard-page-stack loans-page">
      <LoansHeroSection role={user.role} summaryCards={summaryCards} />

      {success && <div className="inline-message inline-message--success">✅ {success}</div>}
      {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}

      <LoanApplicationSection
        role={user.role}
        applicationForm={applicationForm}
        simulation={simulation}
        onChange={handleApplicationFormChange}
        onSubmit={handleApply}
        onSimulate={handleSimulate}
        createLoanPending={createLoanMutation.isPending}
        simulateLoanPending={simulateLoanMutation.isPending}
      />

      <LoansPortfolioSection
        user={user}
        loansQuery={loansQuery}
        loans={loans}
        error={error}
        paymentsByLoan={paymentsByLoan}
        alertsByLoan={alertsByLoan}
        promisesByLoan={promisesByLoan}
        attachmentsByLoan={attachmentsByLoan}
        customerDocumentsByCustomer={customerDocumentsByCustomer}
        assignAgentId={assignAgentId}
        pendingStatusLoans={pendingStatusLoans}
        pendingAssignAgents={pendingAssignAgents}
        pendingRecovery={pendingRecovery}
        pendingDeleteLoans={pendingDeleteLoans}
        editingRecovery={editingRecovery}
        recoveryDrafts={recoveryDrafts}
        updateLoanStatusPending={updateLoanStatusMutation.isPending}
        assignAgentPending={assignAgentMutation.isPending}
        updateRecoveryPending={updateRecoveryStatusMutation.isPending}
        deleteLoanPending={deleteLoanMutation.isPending}
        onRefetch={() => loansQuery.refetch()}
        onSelectAgent={(loanId, agentId) => setAssignAgentId((current) => ({ ...current, [loanId]: agentId }))}
        onAssignAgent={handleAssignAgent}
        onStartEditingRecovery={(loan) => {
          setEditingRecovery((current) => ({ ...current, [loan.id]: true }));
          setRecoveryDrafts((current) => ({ ...current, [loan.id]: loan.recoveryStatus || 'pending' }));
        }}
        onRecoveryDraftChange={(loanId, value) => setRecoveryDrafts((current) => ({ ...current, [loanId]: value }))}
        onSaveRecovery={handleRecoverySave}
        onUpdateLoanStatus={handleLoanStatus}
        onDeleteLoan={handleDeleteLoan}
      />

      <LoansServicingSection
        loans={loans}
        user={user}
        loadingServicing={loadingServicing}
        customerDocumentsByCustomer={customerDocumentsByCustomer}
        customerHistoryByCustomer={customerHistoryByCustomer}
        alertsByLoan={alertsByLoan}
        promisesByLoan={promisesByLoan}
        attachmentsByLoan={attachmentsByLoan}
        promiseDrafts={promiseDrafts}
        attachmentDrafts={attachmentDrafts}
        followUpDrafts={followUpDrafts}
        customerDocumentDrafts={customerDocumentDrafts}
        pendingPromises={pendingPromises}
        pendingFollowUps={pendingFollowUps}
        createLoanPromisePending={createLoanPromiseMutation.isPending}
        onPromiseDraftChange={(loanId, field, value) => setPromiseDrafts((current) => ({
          ...current,
          [loanId]: { ...(current[loanId] || emptyPromiseDraft), [field]: value },
        }))}
        onCreatePromise={handleCreatePromise}
        onFollowUpDraftChange={(loanId, field, value) => setFollowUpDrafts((current) => ({
          ...current,
          [loanId]: { ...(current[loanId] || {}), [field]: value },
        }))}
        onCreateFollowUp={handleCreateFollowUp}
        onResolveAlert={handleResolveAlert}
        onUpdatePromiseStatus={handlePromiseStatus}
        onAttachmentDraftChange={(loanId, field, value) => setAttachmentDrafts((current) => ({
          ...current,
          [loanId]: { ...(current[loanId] || emptyAttachmentDraft), [field]: value },
        }))}
        onCreateAttachment={handleCreateAttachment}
        onCustomerDocumentDraftChange={(customerId, field, value) => setCustomerDocumentDrafts((current) => ({
          ...current,
          [customerId]: { ...(current[customerId] || emptyCustomerDocumentDraft), [field]: value },
        }))}
        onUploadCustomerDocument={handleUploadCustomerDocument}
        onDownloadLoanAttachment={handleDownloadLoanAttachment}
        onDownloadCustomerDocument={handleDownloadCustomerDocument}
        onDeleteCustomerDocument={handleDeleteCustomerDocument}
        onDownloadPromise={handleDownloadPromise}
      />
    </div>
  );
}

export default LoansWorkspace;
