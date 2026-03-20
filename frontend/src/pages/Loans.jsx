import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import Agents from './Agents';
import { downloadFile } from '../lib/api/download';
import { queryKeys } from '../lib/api/queryKeys';
import {
  useAssignAgentMutation,
  useCreateLoanMutation,
  useCreateLoanPromiseMutation,
  useDeleteLoanMutation,
  useLoanServicingQueries,
  useLoansQuery,
  useSimulateLoanMutation,
  useUpdateLoanStatusMutation,
  useUpdateRecoveryStatusMutation,
  useUploadLoanAttachmentMutation,
} from '../hooks/useLoans';
import { useUploadCustomerDocumentMutation, useDeleteCustomerDocumentMutation } from '../hooks/useCustomers';
import { customerService } from '../services/customerService';
import { loanService } from '../services/loanService';
import { reportService } from '../services/reportService';
import { handleApiError } from '../lib/api/errors';

const LOAN_STATUS_TONE_MAP = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  active: 'success',
  defaulted: 'danger',
  closed: 'info',
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

const emptyPromiseDraft = { promisedDate: '', amount: '', notes: '' };
const emptyAttachmentDraft = { category: '', description: '', customerVisible: false, file: null };
const emptyCustomerDocumentDraft = { category: '', description: '', customerVisible: false, file: null };

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatLoanStatus = (status) => (status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '-');
const formatRecoveryStatus = (status) => RECOVERY_STATUS_LABELS[status] || status || '-';

const calculateSuggestedInterestRate = (amount, termMonths) => {
  const parsedAmount = Number(amount);
  const parsedTerm = Number(termMonths);

  if (!Number.isFinite(parsedAmount) || !Number.isFinite(parsedTerm) || parsedAmount <= 0 || parsedTerm <= 0) {
    return '';
  }

  let rate = 2.5;

  if (parsedAmount >= 10000) rate -= 0.5;
  if (parsedAmount >= 20000) rate -= 0.3;
  if (parsedTerm >= 12) rate -= 0.3;

  return Math.max(1.5, Math.min(rate, 3.5)).toFixed(1);
};

const getLoanDetails = (loan, payments) => {
  if (!loan) return { emi: '0.00', balance: '0.00', totalDue: 0 };

  const financialSnapshot = loan.financialSnapshot || {};
  const snapshotInstallmentAmount = Number(financialSnapshot.installmentAmount ?? loan.installmentAmount);
  const snapshotOutstandingBalance = Number(financialSnapshot.outstandingBalance);
  const snapshotTotalPayable = Number(financialSnapshot.totalPayable ?? loan.totalPayable);

  const principal = Number(loan.amount || 0);
  const rate = Number(loan.interestRate || 0) / 100 / 12;
  const totalInstallments = Number(loan.termMonths || 0);

  if (Number.isFinite(snapshotInstallmentAmount) && Number.isFinite(snapshotOutstandingBalance) && Number.isFinite(snapshotTotalPayable)) {
    return {
      emi: snapshotInstallmentAmount.toFixed(2),
      balance: snapshotOutstandingBalance.toFixed(2),
      totalDue: snapshotTotalPayable,
    };
  }

  if (!principal || !totalInstallments) {
    return { emi: '0.00', balance: '0.00', totalDue: 0 };
  }

  const emi = rate === 0
    ? principal / totalInstallments
    : (principal * rate * Math.pow(1 + rate, totalInstallments)) / (Math.pow(1 + rate, totalInstallments) - 1);

  const totalPaid = (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalDue = emi * totalInstallments;
  const balance = Math.max(0, totalDue - totalPaid);

  return {
    emi: emi.toFixed(2),
    balance: balance < 1 ? '0.00' : balance.toFixed(2),
    totalDue,
  };
};

const getQueryArrayData = (query, selector, fallback = []) => {
  if (!query?.data) return fallback;
  const value = selector(query.data);
  return Array.isArray(value) ? value : fallback;
};

const mapQueriesById = (ids, queries, selector) => ids.reduce((result, id, index) => {
  result[id] = getQueryArrayData(queries[index], selector, []);
  return result;
}, {});

const getFirstQueryError = (queries) => queries.find((query) => query?.error)?.error || null;

function Loans({ user }) {
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

  const loansQuery = useLoansQuery({ user });
  const createLoanMutation = useCreateLoanMutation(user);
  const simulateLoanMutation = useSimulateLoanMutation();
  const updateLoanStatusMutation = useUpdateLoanStatusMutation(user);
  const assignAgentMutation = useAssignAgentMutation(user);
  const updateRecoveryStatusMutation = useUpdateRecoveryStatusMutation(user);
  const createLoanPromiseMutation = useCreateLoanPromiseMutation(user);
  const uploadLoanAttachmentMutation = useUploadLoanAttachmentMutation(user);
  const deleteLoanMutation = useDeleteLoanMutation(user);

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

  const uploadCustomerDocumentMutation = useUploadCustomerDocumentMutation();
  const deleteCustomerDocumentMutation = useDeleteCustomerDocumentMutation();

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
      showSuccess('Loan application submitted successfully.');
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
      showSuccess('Loan simulation generated successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleLoanStatus = async (loanId, status) => {
    clearMessages();
    setPendingStatusLoans((prev) => ({ ...prev, [loanId]: true }));

    try {
      await updateLoanStatusMutation.mutateAsync({ loanId, status });
      showSuccess(`Loan marked as ${status}.`);
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingStatusLoans((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleAssignAgent = async (loanId) => {
    clearMessages();
    setPendingAssignAgents((prev) => ({ ...prev, [loanId]: true }));

    try {
      await assignAgentMutation.mutateAsync({ loanId, agentId: Number(assignAgentId[loanId]) });
      showSuccess('Agent assigned successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingAssignAgents((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleRecoverySave = async (loanId) => {
    clearMessages();
    setPendingRecovery((prev) => ({ ...prev, [loanId]: true }));

    try {
      await updateRecoveryStatusMutation.mutateAsync({
        loanId,
        recoveryStatus: recoveryDrafts[loanId],
      });

      setEditingRecovery((current) => ({ ...current, [loanId]: false }));
      showSuccess('Recovery status updated successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingRecovery((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleDeleteLoan = async (loanId) => {
    if (!window.confirm('Are you sure you want to delete this rejected loan? This action cannot be undone.')) {
      return;
    }

    clearMessages();
    setPendingDeleteLoans((prev) => ({ ...prev, [loanId]: true }));

    try {
      await deleteLoanMutation.mutateAsync(loanId);
      showSuccess('Loan deleted successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingDeleteLoans((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleCreatePromise = async (loanId) => {
    clearMessages();
    setPendingPromises((prev) => ({ ...prev, [loanId]: true }));

    try {
      await createLoanPromiseMutation.mutateAsync({
        loanId,
        payload: promiseDrafts[loanId] || emptyPromiseDraft,
      });

      setPromiseDrafts((current) => ({ ...current, [loanId]: emptyPromiseDraft }));
      showSuccess('Promise to pay created successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    } finally {
      setPendingPromises((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleCreateAttachment = async (loanId) => {
    const attachmentDraft = attachmentDrafts[loanId] || emptyAttachmentDraft;

    if (!attachmentDraft.file) {
      setError('Please choose a file before uploading an attachment.');
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
      showSuccess('Loan attachment uploaded successfully.');
    } catch (mutationError) {
      handleApiError(mutationError, setError);
    }
  };

  const handleUploadCustomerDocument = async (customerId) => {
    const draft = customerDocumentDrafts[customerId] || emptyCustomerDocumentDraft;

    if (!draft.file) {
      setError('Please choose a file before uploading a customer document.');
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
      showSuccess('Customer document uploaded successfully.');
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
      showSuccess('Customer document deleted successfully.');
    } catch (deleteError) {
      handleApiError(deleteError, setError);
    }
  };

  const handleDownloadPromise = async (loanId, promiseId) => {
    clearMessages();

    try {
      const fileName = `promise-to-pay-${promiseId}.pdf`;
      await downloadFile({
        loader: () => loanService.downloadLoanPromise(loanId, promiseId),
        filename: fileName,
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
        label: user.role === 'agent' ? 'Assigned loans' : 'Visible loans',
        value: loans.length,
        caption: user.role === 'customer' ? 'Applications in your account' : 'Records available in this workspace',
        tone: 'brand',
      },
      {
        label: user.role === 'agent' ? 'Recovery queue' : 'Approved loans',
        value: user.role === 'agent' ? activeRecoveryCount : approvedCount,
        caption: user.role === 'agent' ? 'Loans currently in active follow-up' : 'Ready for repayment or assignment',
        tone: 'success',
      },
      {
        label: 'Pending review',
        value: pendingCount,
        caption: user.role === 'customer' ? 'Applications still waiting for a decision' : 'Loans that still need approval work',
        tone: 'warning',
      },
      {
        label: user.role === 'customer' ? 'Outstanding balance' : 'Active alerts',
        value: user.role === 'customer' ? formatCurrency(outstandingBalance) : activeAlerts,
        caption: user.role === 'customer' ? 'Calculated from loaded payment history' : 'Overdue servicing signals',
        tone: 'info',
      },
    ];
  }, [alertsByLoan, loans, paymentsByLoan, user.role]);

  const renderStatePanel = ({ icon, title, message, action, loadingState = false }) => (
    <div className={`state-panel${loadingState ? ' state-panel--loading' : ''}`}>
      <div className="state-panel__icon">{icon}</div>
      <div className="state-panel__title">{title}</div>
      <div className="state-panel__text">{message}</div>
      {action}
    </div>
  );

  const renderProgress = (loan) => {
    const totalInstallments = Number(loan.termMonths || 0);
    const financialSnapshot = loan.financialSnapshot || {};
    const outstandingInstallments = Number(financialSnapshot.outstandingInstallments);
    const completion = totalInstallments > 0
      ? Number.isFinite(outstandingInstallments)
        ? ((totalInstallments - outstandingInstallments) / totalInstallments) * 100
        : (((paymentsByLoan[loan.id] || []).length) / totalInstallments) * 100
      : 0;
    const completedInstallments = totalInstallments > 0
      ? Number.isFinite(outstandingInstallments)
        ? Math.max(totalInstallments - outstandingInstallments, 0)
        : (paymentsByLoan[loan.id] || []).length
      : 0;

    return (
      <div className="progress-pill">
        <span className="progress-pill__text">{completedInstallments}/{loan.termMonths}</span>
        <div className="progress-track">
          <div
            className={`progress-track__fill${completion < 50 ? ' progress-track__fill--danger' : ''}`}
            style={{ width: `${Math.min(completion, 100)}%` }}
          ></div>
        </div>
      </div>
    );
  };

  const renderAgentAssignment = (loan) => (
    <div className="table-inline-stack">
      <div>{loan.Agent?.name || '-'}</div>
      {user.role === 'admin' && loan.status === 'approved' && !loan.Agent && (
        <div className="table-inline-stack">
          <Agents onSelect={(agentId) => setAssignAgentId((current) => ({ ...current, [loan.id]: agentId }))} />
          <button
            className="btn btn-primary btn-sm"
            disabled={!assignAgentId[loan.id] || assignAgentMutation.isPending || pendingAssignAgents[loan.id]}
            onClick={() => handleAssignAgent(loan.id)}
          >
            {pendingAssignAgents[loan.id] ? 'Assigning...' : 'Assign agent'}
          </button>
        </div>
      )}
    </div>
  );

  const renderRecoveryEditor = (loan) => {
    const canEdit = user.role === 'admin' || (user.role === 'agent' && Number(loan.agentId) === Number(user.id));

    if (!canEdit) {
      return <span className="status-note">No action available</span>;
    }

    if (editingRecovery[loan.id]) {
      return (
        <div className="action-stack">
          <select
            className="form-control"
            value={recoveryDrafts[loan.id] || loan.recoveryStatus || ''}
            onChange={(event) => setRecoveryDrafts((current) => ({ ...current, [loan.id]: event.target.value }))}
          >
            <option value="">Select status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="recovered">Recovered</option>
          </select>
          <button
            className="btn btn-success btn-sm"
            disabled={!recoveryDrafts[loan.id] || updateRecoveryStatusMutation.isPending || pendingRecovery[loan.id]}
            onClick={() => handleRecoverySave(loan.id)}
          >
            {pendingRecovery[loan.id] ? 'Saving...' : 'Save status'}
          </button>
        </div>
      );
    }

    return (
      <button
        className="btn btn-outline-primary btn-sm"
        onClick={() => {
          setEditingRecovery((current) => ({ ...current, [loan.id]: true }));
          setRecoveryDrafts((current) => ({ ...current, [loan.id]: loan.recoveryStatus || 'pending' }));
        }}
      >
        Edit recovery
      </button>
    );
  };

  const renderTable = () => {
    if (loansQuery.isLoading) {
      return renderStatePanel({
        icon: '⏳',
        title: 'Loading loans',
        message: 'We are gathering the latest loan records, servicing updates, and balances for this workspace.',
        loadingState: true,
      });
    }

    if (loansQuery.error) {
      return renderStatePanel({
        icon: '⚠️',
        title: 'Unable to load loans',
        message: error || 'We could not load the current loan portfolio.',
        action: <button className="btn btn-primary" onClick={() => loansQuery.refetch()}>Try again</button>,
      });
    }

    if (!loans.length) {
      return renderStatePanel({
        icon: user.role === 'customer' ? '📄' : '🔍',
        title: user.role === 'customer' ? 'No loans yet' : 'No loans found',
        message: user.role === 'customer'
          ? 'Submit a loan request above and it will appear here as soon as it enters review.'
          : 'New lending records will appear here as soon as they are available for your role.',
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
              <th className="table-cell-center">Servicing</th>
              <th className="table-cell-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...loans]
              .sort((left, right) => {
                if (left.status === 'rejected' && right.status !== 'rejected') return 1;
                if (left.status !== 'rejected' && right.status === 'rejected') return -1;
                return Number(right.id) - Number(left.id);
              })
              .map((loan) => {
                const loanDetails = getLoanDetails(loan, paymentsByLoan[loan.id] || []);
                const customerId = Number(loan.customerId || loan.Customer?.id);
                const customerDocuments = customerId ? customerDocumentsByCustomer[customerId] || [] : [];
                const promises = promisesByLoan[loan.id] || [];
                const alerts = alertsByLoan[loan.id] || [];
                const attachments = attachmentsByLoan[loan.id] || [];
                const canDecision = user.role === 'admin' || (user.role === 'agent' && Number(loan.agentId) === Number(user.id));
                const canDelete = loan.status === 'rejected'
                  && (user.role === 'admin' || user.role === 'customer' || user.role === 'agent');

                return (
                  <tr key={loan.id}>
                    <td><span className="table-id-pill">#{loan.id}</span></td>
                    {(user.role === 'admin' || user.role === 'agent') && <td>{loan.Customer?.name || '-'}</td>}
                    <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                    <td className="table-cell-center">{Number(loan.interestRate || 0).toFixed(1)}%</td>
                    <td className="table-cell-center">{loan.termMonths}m</td>
                    <td className="table-cell-center">
                      <span className={`status-badge status-badge--${LOAN_STATUS_TONE_MAP[loan.status] || 'neutral'}`}>
                        {formatLoanStatus(loan.status)}
                      </span>
                    </td>
                    {(user.role === 'admin' || user.role === 'agent') && <td className="table-cell-center">{renderAgentAssignment(loan)}</td>}
                    <td className="table-cell-center">
                      <span className={`status-badge status-badge--${RECOVERY_STATUS_TONE_MAP[loan.recoveryStatus] || 'neutral'}`}>
                        {formatRecoveryStatus(loan.recoveryStatus)}
                      </span>
                    </td>
                    <td className="table-cell-center">{renderProgress(loan)}</td>
                    <td className="table-cell-right">
                      {loanDetails.balance === '0.00'
                        ? <span className="status-badge status-badge--success">Fully paid</span>
                        : formatCurrency(loanDetails.balance)}
                    </td>
                    <td className="table-cell-center">
                      <div className="table-inline-stack" style={{ alignItems: 'stretch' }}>
                        {(user.role === 'admin' || user.role === 'agent') && <span className="status-note">Alerts: {alerts.filter((alert) => alert.status === 'active').length}</span>}
                        {(user.role === 'admin' || user.role === 'agent') && <span className="status-note">Promises: {promises.length}</span>}
                        <span className="status-note">Attachments: {attachments.length}</span>
                        {customerId ? <span className="status-note">Customer docs: {customerDocuments.length}</span> : null}
                      </div>
                    </td>
                    <td className="table-cell-center">
                      <div className="action-stack">
                        {loan.status === 'pending' && canDecision && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              disabled={pendingStatusLoans[loan.id] || updateLoanStatusMutation.isPending}
                              onClick={() => handleLoanStatus(loan.id, 'approved')}
                            >
                              {pendingStatusLoans[loan.id] ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={pendingStatusLoans[loan.id] || updateLoanStatusMutation.isPending}
                              onClick={() => handleLoanStatus(loan.id, 'rejected')}
                            >
                              {pendingStatusLoans[loan.id] ? 'Processing...' : 'Reject'}
                            </button>
                          </>
                        )}
                        {(user.role === 'admin' || user.role === 'agent') && renderRecoveryEditor(loan)}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" disabled={pendingDeleteLoans[loan.id] || deleteLoanMutation.isPending} onClick={() => handleDeleteLoan(loan.id)}>
                            {pendingDeleteLoans[loan.id] ? 'Deleting...' : 'Delete'}
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
                ? 'Track assigned collections with query-backed servicing data'
                : user.role === 'admin'
                  ? 'Manage lending decisions and servicing from one aligned workspace'
                  : 'Apply for loans and follow every document and repayment milestone'}
            </div>
            <div className="section-subtitle">
              This page now reads portfolio, servicing, customer documents, and history through the shared TanStack Query foundation.
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

      {success && <div className="inline-message inline-message--success">✅ {success}</div>}
      {error && <div className="inline-message inline-message--error">⚠️ {error}</div>}

      {user.role === 'customer' && (
        <section className="surface-card">
          <div className="surface-card__header surface-card__header--compact">
            <div>
              <div className="section-eyebrow">Loan application</div>
              <div className="section-title">Create a new request</div>
              <div className="section-subtitle">
                Generate a simulation first, then submit the request with the same amount, term, and estimated rate.
              </div>
            </div>
          </div>
          <div className="surface-card__body">
            <form onSubmit={handleApply} className="dashboard-form-grid">
              <label className="field-group">
                <span className="field-label">Loan amount</span>
                <input
                  className="field-control"
                  name="amount"
                  value={applicationForm.amount}
                  onChange={handleApplicationFormChange}
                  placeholder="Loan amount"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-label">Repayment term</span>
                <select className="field-control" name="termMonths" value={applicationForm.termMonths} onChange={handleApplicationFormChange} required>
                  <option value="" disabled>Select a term</option>
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
                <input className="field-control" name="interestRate" value={applicationForm.interestRate} readOnly />
              </label>
              <div className="field-group">
                <span className="field-label">Simulation</span>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleSimulate}
                  disabled={!applicationForm.amount || !applicationForm.termMonths || !applicationForm.interestRate || simulateLoanMutation.isPending}
                >
                  {simulateLoanMutation.isPending ? 'Generating…' : 'Generate simulation'}
                </button>
              </div>
              <div className="field-group">
                <span className="field-label">Submit</span>
                <button className="btn btn-success" type="submit" disabled={createLoanMutation.isPending}>
                  {createLoanMutation.isPending ? 'Submitting…' : 'Apply for loan'}
                </button>
              </div>
            </form>

            {simulation && (
              <div className="surface-card surface-card--compact" style={{ marginTop: '1rem' }}>
                <div className="surface-card__body">
                  <div className="summary-grid" style={{ marginBottom: '1rem' }}>
                    <div className="detail-card">
                      <div className="detail-card__label">Monthly installment</div>
                      <div className="detail-card__value detail-card__value--success">{formatCurrency(simulation.summary?.installmentAmount)}</div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-card__label">Total payable</div>
                      <div className="detail-card__value detail-card__value--warning">{formatCurrency(simulation.summary?.totalPayable)}</div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-card__label">Total interest</div>
                      <div className="detail-card__value">{formatCurrency(simulation.summary?.totalInterest)}</div>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Installment</th>
                          <th>Due date</th>
                          <th className="table-cell-right">Principal</th>
                          <th className="table-cell-right">Interest</th>
                          <th className="table-cell-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(simulation.schedule || []).slice(0, 4).map((entry) => {
                          const principalAmount = entry.principalAmount ?? entry.principalComponent ?? 0;
                          const interestAmount = entry.interestAmount ?? entry.interestComponent ?? 0;
                          const installmentTotal = entry.totalDue ?? entry.scheduledPayment ?? 0;

                          return (
                          <tr key={entry.installmentNumber}>
                            <td>#{entry.installmentNumber}</td>
                            <td>{formatDate(entry.dueDate)}</td>
                            <td className="table-cell-right">{formatCurrency(principalAmount)}</td>
                            <td className="table-cell-right">{formatCurrency(interestAmount)}</td>
                            <td className="table-cell-right">{formatCurrency(installmentTotal)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="surface-card">
        <div className="surface-card__header surface-card__header--compact">
          <div>
            <div className="section-eyebrow">Portfolio view</div>
            <div className="section-title">
              {user.role === 'agent' ? 'Recovery queue' : user.role === 'admin' ? 'Loan operations overview' : 'Your loan history'}
            </div>
            <div className="section-subtitle">
              Status decisions, servicing counts, and repayment balances now share the same query-backed table.
            </div>
          </div>
        </div>
        <div className="surface-card__body">{renderTable()}</div>
      </section>

      {loans.length > 0 && (
        <section className="surface-card">
          <div className="surface-card__header surface-card__header--compact">
            <div>
              <div className="section-eyebrow">Servicing details</div>
              <div className="section-title">Promises, attachments, customer documents, and history</div>
              <div className="section-subtitle">
                Internal users can manage follow-up tasks and customer files; admins also see the canonical customer history timeline.
              </div>
            </div>
          </div>
          <div className="surface-card__body">
            {loadingServicing && loans.length > 0 && (
              <div className="inline-message inline-message--success">⏳ Refreshing servicing data…</div>
            )}

            <div className="dashboard-page-stack" style={{ gap: '1rem' }}>
              {loans.map((loan) => {
                const customerId = Number(loan.customerId || loan.Customer?.id);
                const customerDocuments = customerId ? customerDocumentsByCustomer[customerId] || [] : [];
                const customerHistory = customerId ? customerHistoryByCustomer[customerId] : null;
                const historySegments = customerHistory?.segments || {};
                const historyTimeline = customerHistory?.timeline || [];

                return (
                  <div key={`servicing-${loan.id}`} className="surface-card surface-card--compact">
                    <div className="surface-card__header surface-card__header--compact">
                      <div>
                        <div className="section-eyebrow">Loan #{loan.id}</div>
                        <div className="section-title" style={{ fontSize: '1rem' }}>
                          {(loan.Customer?.name || user.name)} · {formatCurrency(loan.amount)}
                        </div>
                      </div>
                    </div>
                    <div className="surface-card__body">
                      <div className="summary-grid" style={{ marginBottom: '1rem' }}>
                        <div className="detail-card">
                          <div className="detail-card__label">Alerts</div>
                          <div className="detail-card__value detail-card__value--warning">{(alertsByLoan[loan.id] || []).filter((alert) => alert.status === 'active').length}</div>
                        </div>
                        <div className="detail-card">
                          <div className="detail-card__label">Promises</div>
                          <div className="detail-card__value detail-card__value--info">{(promisesByLoan[loan.id] || []).length}</div>
                        </div>
                        <div className="detail-card">
                          <div className="detail-card__label">Loan attachments</div>
                          <div className="detail-card__value">{(attachmentsByLoan[loan.id] || []).length}</div>
                        </div>
                        <div className="detail-card">
                          <div className="detail-card__label">Customer documents</div>
                          <div className="detail-card__value">{customerDocuments.length}</div>
                        </div>
                      </div>

                      {(user.role === 'admin' || user.role === 'agent') && (
                        <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                          <label className="field-group">
                            <span className="field-label">Promise date</span>
                            <input
                              className="field-control"
                              type="date"
                              value={promiseDrafts[loan.id]?.promisedDate || ''}
                              onChange={(event) => setPromiseDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyPromiseDraft), promisedDate: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Promise amount</span>
                            <input
                              className="field-control"
                              type="number"
                              value={promiseDrafts[loan.id]?.amount || ''}
                              onChange={(event) => setPromiseDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyPromiseDraft), amount: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Notes</span>
                            <input
                              className="field-control"
                              value={promiseDrafts[loan.id]?.notes || ''}
                              onChange={(event) => setPromiseDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyPromiseDraft), notes: event.target.value },
                              }))}
                            />
                          </label>
                          <div className="field-group">
                            <span className="field-label">Create</span>
                            <button className="btn btn-primary" disabled={pendingPromises[loan.id] || createLoanPromiseMutation.isPending} onClick={() => handleCreatePromise(loan.id)}>
                              {pendingPromises[loan.id] ? 'Saving...' : 'Save promise'}
                            </button>
                          </div>
                        </div>
                      )}

                      {(user.role === 'admin' || user.role === 'agent') && (
                        <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                          <label className="field-group">
                            <span className="field-label">Loan attachment</span>
                            <input
                              className="field-control"
                              type="file"
                              onChange={(event) => setAttachmentDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyAttachmentDraft), file: event.target.files?.[0] || null },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Category</span>
                            <input
                              className="field-control"
                              value={attachmentDrafts[loan.id]?.category || ''}
                              onChange={(event) => setAttachmentDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyAttachmentDraft), category: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Description</span>
                            <input
                              className="field-control"
                              value={attachmentDrafts[loan.id]?.description || ''}
                              onChange={(event) => setAttachmentDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyAttachmentDraft), description: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group" style={{ justifyContent: 'center' }}>
                            <span className="field-label">Customer visible</span>
                            <input
                              type="checkbox"
                              checked={Boolean(attachmentDrafts[loan.id]?.customerVisible)}
                              onChange={(event) => setAttachmentDrafts((current) => ({
                                ...current,
                                [loan.id]: { ...(current[loan.id] || emptyAttachmentDraft), customerVisible: event.target.checked },
                              }))}
                            />
                          </label>
                          <div className="field-group">
                            <span className="field-label">Upload</span>
                            <button className="btn btn-primary" onClick={() => handleCreateAttachment(loan.id)}>
                              Upload attachment
                            </button>
                          </div>
                        </div>
                      )}

                      {(user.role === 'admin' || user.role === 'agent') && customerId && (
                        <div className="dashboard-form-grid" style={{ marginBottom: '1rem' }}>
                          <label className="field-group">
                            <span className="field-label">Customer document</span>
                            <input
                              className="field-control"
                              type="file"
                              onChange={(event) => setCustomerDocumentDrafts((current) => ({
                                ...current,
                                [customerId]: { ...(current[customerId] || emptyCustomerDocumentDraft), file: event.target.files?.[0] || null },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Category</span>
                            <input
                              className="field-control"
                              value={customerDocumentDrafts[customerId]?.category || ''}
                              onChange={(event) => setCustomerDocumentDrafts((current) => ({
                                ...current,
                                [customerId]: { ...(current[customerId] || emptyCustomerDocumentDraft), category: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Description</span>
                            <input
                              className="field-control"
                              value={customerDocumentDrafts[customerId]?.description || ''}
                              onChange={(event) => setCustomerDocumentDrafts((current) => ({
                                ...current,
                                [customerId]: { ...(current[customerId] || emptyCustomerDocumentDraft), description: event.target.value },
                              }))}
                            />
                          </label>
                          <label className="field-group" style={{ justifyContent: 'center' }}>
                            <span className="field-label">Customer visible</span>
                            <input
                              type="checkbox"
                              checked={Boolean(customerDocumentDrafts[customerId]?.customerVisible)}
                              onChange={(event) => setCustomerDocumentDrafts((current) => ({
                                ...current,
                                [customerId]: { ...(current[customerId] || emptyCustomerDocumentDraft), customerVisible: event.target.checked },
                              }))}
                            />
                          </label>
                          <div className="field-group">
                            <span className="field-label">Upload</span>
                            <button className="btn btn-primary" onClick={() => handleUploadCustomerDocument(customerId)}>
                              Upload document
                            </button>
                          </div>
                        </div>
                      )}

                      {user.role === 'admin' && customerHistory && (
                        <div className="surface-card surface-card--compact" style={{ marginBottom: '1rem' }}>
                          <div className="surface-card__body">
                            <div className="section-eyebrow">Customer history</div>
                            <div className="summary-grid" style={{ marginBottom: '1rem' }}>
                              <div className="detail-card"><div className="detail-card__label">Loans</div><div className="detail-card__value">{historySegments.loans?.length || 0}</div></div>
                              <div className="detail-card"><div className="detail-card__label">Payments</div><div className="detail-card__value detail-card__value--success">{historySegments.payments?.length || 0}</div></div>
                              <div className="detail-card"><div className="detail-card__label">Documents</div><div className="detail-card__value">{historySegments.documents?.length || 0}</div></div>
                              <div className="detail-card"><div className="detail-card__label">Notifications</div><div className="detail-card__value detail-card__value--info">{historySegments.notifications?.length || 0}</div></div>
                            </div>
                            <div className="table-wrap">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Event</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historyTimeline.slice(0, 5).map((entry) => (
                                    <tr key={entry.id}>
                                      <td>{entry.eventType.replaceAll('_', ' ')}</td>
                                      <td>{entry.entityType}</td>
                                      <td>{formatDate(entry.occurredAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {(user.role === 'admin' || user.role === 'agent') && (alertsByLoan[loan.id] || []).length > 0 && (
                        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Installment</th>
                                <th>Due date</th>
                                <th className="table-cell-right">Outstanding</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(alertsByLoan[loan.id] || []).map((alert) => (
                                <tr key={alert.id}>
                                  <td>#{alert.installmentNumber}</td>
                                  <td>{formatDate(alert.dueDate)}</td>
                                  <td className="table-cell-right">{formatCurrency(alert.outstandingAmount)}</td>
                                  <td>{alert.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {(promisesByLoan[loan.id] || []).length > 0 && (
                        <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Promised date</th>
                                <th className="table-cell-right">Amount</th>
                                <th>Status</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(promisesByLoan[loan.id] || []).map((promise) => (
                                <tr key={promise.id}>
                                  <td>{formatDate(promise.promisedDate)}</td>
                                  <td className="table-cell-right">{formatCurrency(promise.amount)}</td>
                                  <td>{promise.status}</td>
                                  <td>{promise.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Loan attachment</th>
                              <th>Category</th>
                              <th>Customer visible</th>
                              <th className="table-cell-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(attachmentsByLoan[loan.id] || []).length === 0 ? (
                              <tr><td colSpan="4" className="table-cell-center">No attachments available</td></tr>
                            ) : (
                              (attachmentsByLoan[loan.id] || []).map((attachment) => (
                                <tr key={attachment.id}>
                                  <td>{attachment.originalName}</td>
                                  <td>{attachment.category || '-'}</td>
                                  <td>{attachment.customerVisible ? 'Yes' : 'No'}</td>
                                  <td className="table-cell-center">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => handleDownloadLoanAttachment(loan.id, attachment.id, attachment.originalName)}
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

                      {(user.role === 'admin' || user.role === 'agent') && (
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Promise ID</th>
                                <th>Promised Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th className="table-cell-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(promisesByLoan[loan.id] || []).length === 0 ? (
                                <tr><td colSpan="5" className="table-cell-center">No promises to pay</td></tr>
                              ) : (
                                (promisesByLoan[loan.id] || []).map((promise) => (
                                  <tr key={promise.id}>
                                    <td>{promise.id}</td>
                                    <td>{formatDate(promise.promisedDate)}</td>
                                    <td>{formatCurrency(promise.amount)}</td>
                                    <td>{promise.status}</td>
                                    <td className="table-cell-center">
                                      <button
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() => handleDownloadPromise(loan.id, promise.id)}
                                      >
                                        Download PDF
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Customer document</th>
                              <th>Category</th>
                              <th>Visible to customer</th>
                              <th className="table-cell-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDocuments.length === 0 ? (
                              <tr><td colSpan="4" className="table-cell-center">No customer documents available</td></tr>
                            ) : (
                              customerDocuments.map((document) => (
                                <tr key={document.id}>
                                  <td>{document.originalName}</td>
                                  <td>{document.category || '-'}</td>
                                  <td>{document.customerVisible ? 'Yes' : 'No'}</td>
                                  <td className="table-cell-center">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => handleDownloadCustomerDocument(customerId, document.id, document.originalName)}
                                    >
                                      Download
                                    </button>
                                    {user.role === 'admin' && (
                                      <button
                                        className="btn btn-outline-danger btn-sm"
                                        style={{ marginLeft: '0.25rem' }}
                                        onClick={() => handleDeleteCustomerDocument(customerId, document.id)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default Loans;
