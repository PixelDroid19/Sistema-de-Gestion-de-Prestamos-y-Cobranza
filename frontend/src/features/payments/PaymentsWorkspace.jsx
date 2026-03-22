import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useTranslation } from 'react-i18next';

import StatePanel from '@/components/ui/StatePanel';
import {
  useExecutePayoffMutation,
  useLoanAttachmentsQuery,
  useLoanCalendarQuery,
  useLoanPayoffQuoteQuery,
  useLoansQuery,
} from '@/hooks/useLoans';
import {
  useAnnulInstallmentMutation,
  useCreateCapitalPaymentMutation,
  useCreatePartialPaymentMutation,
  useCreatePaymentMutation,
  usePaymentDocumentsQuery,
  usePaymentsByLoanQuery,
  useUploadPaymentDocumentMutation,
} from '@/hooks/usePayments';
import { downloadFile } from '@/lib/api/download';
import { extractApiErrorDetails, handleApiError } from '@/lib/api/errors';
import { loanService } from '@/services/loanService';
import { paymentService } from '@/services/paymentService';

import {
  initialFormState,
  PAYMENT_TYPES_BY_ROLE,
  PAYABLE_LOAN_STATUSES,
} from '@/features/payments/paymentsWorkspace.constants';
import {
  buildClientEligibility,
  buildEligibilityButtonTitle,
  buildEligibilityState,
  buildPaymentPayload,
  formReducer,
  getEligibilityPanelCopy,
  getLoanDetails,
  getPayoffQuoteTotal,
  getStructuredDenialReasons,
} from '@/features/payments/paymentsWorkspace.utils';
import PaymentsFormSection from '@/features/payments/sections/PaymentsFormSection';
import PaymentsHeroSection from '@/features/payments/sections/PaymentsHeroSection';
import PaymentsHistorySection from '@/features/payments/sections/PaymentsHistorySection';
import { usePaginationStore } from '@/store/paginationStore';

const PAYMENTS_HISTORY_SCOPE = 'workspace-payments-history';
const DEFAULT_PAGINATION = { page: 1, pageSize: 25 };

function PaymentsWorkspace({ user }) {
  const { t } = useTranslation()
  const isAdmin = user.role === 'admin';
  const isCustomer = user.role === 'customer';
  const allowedPaymentTypes = useMemo(() => PAYMENT_TYPES_BY_ROLE[user.role] || [], [user.role]);
  const canManagePayments = allowedPaymentTypes.length > 0;
  const canAnnul = isAdmin || user.role === 'agent';

  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [resolvedAlertMessage, setResolvedAlertMessage] = useState('');
  const [actionErrorDetails, setActionErrorDetails] = useState(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [paymentDocumentDraft, setPaymentDocumentDraft] = useState({ file: null, category: '', description: '', customerVisible: false });
  const paymentHistoryPagination = usePaginationStore((state) => state.scopes[PAYMENTS_HISTORY_SCOPE] || DEFAULT_PAGINATION);
  const ensurePaymentHistoryScope = usePaginationStore((state) => state.ensureScope);
  const setPaymentHistoryPage = usePaginationStore((state) => state.setPage);

  useEffect(() => {
    ensurePaymentHistoryScope(PAYMENTS_HISTORY_SCOPE, DEFAULT_PAGINATION);
  }, [ensurePaymentHistoryScope]);

  const loansQuery = useLoansQuery({ user, pagination: { page: 1, pageSize: 100 } });
  const loans = useMemo(() => (
    Array.isArray(loansQuery.data?.items)
      ? loansQuery.data.items
      : Array.isArray(loansQuery.data?.data)
        ? loansQuery.data.data
        : []
  ), [loansQuery.data]);
  const selectedLoanId = formState.loanId || null;
  const selectedLoan = loans.find((loan) => loan.id === Number(formState.loanId));
  const isSelectedLoanPayable = Boolean(selectedLoan && PAYABLE_LOAN_STATUSES.has(selectedLoan.status));

  useEffect(() => {
    if (!selectedLoanId) {
      setPaymentHistoryPage(PAYMENTS_HISTORY_SCOPE, DEFAULT_PAGINATION.page);
    }
  }, [selectedLoanId, setPaymentHistoryPage]);

  const paymentsQuery = usePaymentsByLoanQuery(selectedLoanId, {
    enabled: Boolean(selectedLoanId),
    pagination: paymentHistoryPagination,
  });
  const calendarQuery = useLoanCalendarQuery(selectedLoanId, { enabled: Boolean(selectedLoanId) });
  const attachmentsQuery = useLoanAttachmentsQuery(selectedLoanId, { enabled: Boolean(selectedLoanId) });
  const payoffQuoteQuery = useLoanPayoffQuoteQuery(selectedLoanId, formState.payoffDate, {
    enabled: Boolean(selectedLoanId) && isCustomer && isSelectedLoanPayable && formState.paymentType === 'payoff',
  });
  const createPaymentMutation = useCreatePaymentMutation(selectedLoanId);
  const createPartialPaymentMutation = useCreatePartialPaymentMutation(selectedLoanId);
  const createCapitalPaymentMutation = useCreateCapitalPaymentMutation(selectedLoanId);
  const annulInstallmentMutation = useAnnulInstallmentMutation(selectedLoanId);
  const executePayoffMutation = useExecutePayoffMutation(user);

  const payments = useMemo(() => (
    Array.isArray(paymentsQuery.data?.items)
      ? paymentsQuery.data.items
      : Array.isArray(paymentsQuery.data?.data)
        ? paymentsQuery.data.data
        : []
  ), [paymentsQuery.data]);
  const paymentsPagination = paymentsQuery.data?.pagination || paymentsQuery.data?.data?.pagination || null;
  const effectivePaymentId = selectedPaymentId || payments[0]?.id || null;
  const paymentDocumentsQuery = usePaymentDocumentsQuery(effectivePaymentId, { enabled: Boolean(effectivePaymentId) });
  const uploadPaymentDocumentMutation = useUploadPaymentDocumentMutation(effectivePaymentId);
  const calendar = useMemo(() => (
    Array.isArray(calendarQuery.data?.data?.calendar?.entries) ? calendarQuery.data.data.calendar.entries : []
  ), [calendarQuery.data]);
  const attachments = useMemo(() => (
    Array.isArray(attachmentsQuery.data?.data?.attachments) ? attachmentsQuery.data.data.attachments : []
  ), [attachmentsQuery.data]);
  const paymentDocuments = useMemo(() => (
    Array.isArray(paymentDocumentsQuery.data?.data?.documents) ? paymentDocumentsQuery.data.data.documents : []
  ), [paymentDocumentsQuery.data]);
  const payableLoans = loans.filter((loan) => PAYABLE_LOAN_STATUSES.has(loan.status));
  const loading = loansQuery.isLoading;
  const historyLoading = paymentsQuery.isLoading || calendarQuery.isLoading || attachmentsQuery.isLoading;
  const submitting = createPaymentMutation.isPending || executePayoffMutation.isPending
    || createPartialPaymentMutation.isPending || createCapitalPaymentMutation.isPending || annulInstallmentMutation.isPending;
  const nearestCancellableInstallmentNumber = useMemo(
    () => calendar.find((entry) => (
      (entry.status === 'pending' || entry.status === 'overdue') && Number(entry.outstandingAmount || 0) > 0
    ))?.installmentNumber ?? null,
    [calendar],
  );
  const loanDetails = formState.loanId ? getLoanDetails(loans, payments, formState.loanId) : { emi: '', balance: '' };
  const payoffQuoteErrorDetails = useMemo(
    () => extractApiErrorDetails(payoffQuoteQuery.error),
    [payoffQuoteQuery.error],
  );
  const latestPayoffErrorDetails = actionErrorDetails?.action === 'payoff'
    ? actionErrorDetails.details
    : payoffQuoteErrorDetails;
  const latestCapitalErrorDetails = actionErrorDetails?.action === 'capital'
    ? actionErrorDetails.details
    : null;
  const payoffClientEligibility = useMemo(
    () => buildClientEligibility({
      action: 'payoff',
      loan: selectedLoan,
      calendar,
      balance: loanDetails.balance,
    }),
    [calendar, loanDetails.balance, selectedLoan],
  );
  const capitalClientEligibility = useMemo(
    () => buildClientEligibility({
      action: 'capital',
      loan: selectedLoan,
      calendar,
      balance: loanDetails.balance,
    }),
    [calendar, loanDetails.balance, selectedLoan],
  );
  const payoffEligibilityState = useMemo(
    () => (selectedLoan
      ? buildEligibilityState({
        action: 'payoff',
        clientEligibility: payoffClientEligibility,
        backendDetails: latestPayoffErrorDetails,
        loading: payoffQuoteQuery.isFetching,
      })
      : null),
    [latestPayoffErrorDetails, payoffClientEligibility, payoffQuoteQuery.isFetching, selectedLoan],
  );
  const capitalEligibilityState = useMemo(
    () => (selectedLoan
      ? buildEligibilityState({
        action: 'capital',
        clientEligibility: capitalClientEligibility,
        backendDetails: latestCapitalErrorDetails,
      })
      : null),
    [capitalClientEligibility, latestCapitalErrorDetails, selectedLoan],
  );
  const payoffQuote = payoffQuoteQuery.data?.data?.payoffQuote;
  const payoffQuoteTotal = getPayoffQuoteTotal(payoffQuote);
  const payoffButtonDisabled = !isCustomer
    || submitting
    || !selectedLoanId
    || payoffEligibilityState?.status !== 'ready'
    || payoffQuoteQuery.isFetching
    || payoffQuoteTotal <= 0;
  const capitalButtonDisabled = !formState.loanId || submitting || capitalEligibilityState?.status === 'blocked';

  const registerActionError = useCallback((action, err) => {
    const details = extractApiErrorDetails(err);
    const structuredReasons = getStructuredDenialReasons(details, action);

    if (structuredReasons.length > 0) {
      setActionErrorDetails({
        action,
        details: {
          ...details,
          denialReasons: structuredReasons,
        },
      });
      setError('');
      return;
    }

    setActionErrorDetails(null);
    handleApiError(err, setError);
  }, []);

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

  useEffect(() => {
    const sourceError = loansQuery.error
    || (selectedLoanId ? paymentsQuery.error || calendarQuery.error || attachmentsQuery.error : null)
      || (effectivePaymentId ? paymentDocumentsQuery.error : null)
      || (
        isSelectedLoanPayable
        && formState.paymentType === 'payoff'
        && getStructuredDenialReasons(payoffQuoteErrorDetails, 'payoff').length === 0
          ? payoffQuoteQuery.error
          : null
      );

    if (!sourceError) {
      setHistoryError('');
      return;
    }

    handleApiError(sourceError, setHistoryError);
  }, [
    attachmentsQuery.error,
    calendarQuery.error,
    formState.paymentType,
    isSelectedLoanPayable,
    loansQuery.error,
    paymentsQuery.error,
    paymentDocumentsQuery.error,
    payoffQuoteErrorDetails,
    payoffQuoteQuery.error,
    selectedLoanId,
  ]);

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

  useEffect(() => {
    if (!payments.length) {
      setSelectedPaymentId('');
      return;
    }

    if (!payments.some((payment) => Number(payment.id) === Number(selectedPaymentId))) {
      setSelectedPaymentId(String(payments[0].id));
    }
  }, [payments, selectedPaymentId]);

  const handleUploadPaymentDocument = async () => {
    if (!effectivePaymentId) {
      setError(t('payments.workspace.selectPaymentDocument'));
      return;
    }

    if (!paymentDocumentDraft.file) {
      setError(t('payments.workspace.choosePaymentDocument'));
      return;
    }

    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', paymentDocumentDraft.file);
      formData.append('customerVisible', String(Boolean(paymentDocumentDraft.customerVisible)));
      if (paymentDocumentDraft.category) formData.append('category', paymentDocumentDraft.category);
      if (paymentDocumentDraft.description) formData.append('description', paymentDocumentDraft.description);

      await uploadPaymentDocumentMutation.mutateAsync(formData);
      setPaymentDocumentDraft({ file: null, category: '', description: '', customerVisible: false });
      setSuccess(t('payments.workspace.paymentDocumentUploaded'));
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleDownloadPaymentDocument = async (documentId, fileName) => {
    try {
      await downloadFile({
        loader: () => paymentService.downloadPaymentDocument(effectivePaymentId, documentId),
        filename: fileName,
        fallbackFilename: `payment-document-${documentId}`,
      });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handlePay = async () => {
    setError('');
    setSuccess('');
    setShowSuccessAnimation(false);
    setActionErrorDetails(null);

    try {
      const previousOverdueCount = calendar.filter((entry) => entry.status === 'overdue').length;
      await createPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      const refreshedCalendar = await calendarQuery.refetch();
      const refreshedEntries = Array.isArray(refreshedCalendar.data?.data?.calendar?.entries) ? refreshedCalendar.data.data.calendar.entries : [];
      const refreshedOverdueCount = refreshedEntries.filter((entry) => entry.status === 'overdue').length;

       setShowSuccessAnimation(true);
       setSuccess(t('payments.workspace.paymentSuccess'));
       setResolvedAlertMessage(refreshedOverdueCount < previousOverdueCount ? t('payments.workspace.resolvedAlert') : '');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      registerActionError('installment', err);
    }
  };

  const handlePayoff = async () => {
    setError('');
    setSuccess('');
    setActionErrorDetails(null);

    try {
      if (!payoffQuote) {
        setError(t('payments.workspace.payoffUnavailable'));
        return;
      }

      if (payoffEligibilityState?.status === 'blocked') {
        return;
      }

      if (payoffQuoteTotal <= 0) {
        setError(t('payments.workspace.payoffUnavailable'));
        return;
      }

      await executePayoffMutation.mutateAsync({
        loanId: formState.loanId,
        payload: {
          asOfDate: formState.payoffDate,
          quotedTotal: payoffQuoteTotal,
        },
      });

      setSuccess(t('payments.workspace.payoffSuccess'));
      dispatch({ type: 'RESET' });
    } catch (err) {
      registerActionError('payoff', err);
    }
  };

  const handlePartialPayment = async () => {
    setError('');
    setSuccess('');
    setActionErrorDetails(null);

    try {
      await createPartialPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      setShowSuccessAnimation(true);
      setSuccess(t('payments.workspace.partialSuccess'));
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      registerActionError('partial', err);
    }
  };

  const handleCapitalPayment = async () => {
    setError('');
    setSuccess('');
    setActionErrorDetails(null);

    try {
      if (capitalEligibilityState?.status === 'blocked') {
        return;
      }

      await createCapitalPaymentMutation.mutateAsync(buildPaymentPayload(formState.loanId, formState.amount));
      setShowSuccessAnimation(true);
      setSuccess(t('payments.workspace.capitalSuccess'));
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSuccess('');
      }, 3000);
    } catch (err) {
      registerActionError('capital', err);
    }
  };

  const handleAnnulInstallment = async () => {
    setError('');
    setSuccess('');

    if (!window.confirm(t('payments.workspace.annulConfirm'))) {
      return;
    }

    try {
      await annulInstallmentMutation.mutateAsync({ loanId: formState.loanId });
      setSuccess(t('payments.workspace.annulSuccess'));
      await calendarQuery.refetch();
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setActionErrorDetails(null);
    dispatch({ type: 'SET_FIELD', field: name, value });

    if (name === 'loanId' && value) {
      const details = getLoanDetails(loans, payments, value);
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
      { label: t('payments.workspace.summary.payableLoans'), value: payableLoans.length, caption: t('payments.workspace.summary.payableLoansCaption'), tone: 'brand' },
      { label: t('payments.workspace.summary.selectedEmi'), value: loanDetails.emi ? `₹${loanDetails.emi}` : '—', caption: t('payments.workspace.summary.selectedEmiCaption'), tone: 'success' },
      { label: t('payments.workspace.summary.remainingBalance'), value: loanDetails.balance ? `₹${loanDetails.balance}` : '—', caption: t('payments.workspace.summary.remainingBalanceCaption'), tone: 'warning' },
      { label: t('payments.workspace.summary.recordedPayments'), value: payments.length, caption: t('payments.workspace.summary.recordedPaymentsCaption'), tone: 'info' },
    ],
    [loanDetails.balance, loanDetails.emi, payableLoans.length, payments.length, t],
  );

  if (loading) {
    return (
        <StatePanel
          icon="⏳"
          title={t('payments.workspace.loadingTitle')}
          message={t('payments.workspace.loadingMessage')}
          loadingState
        />
    );
  }

  return (
    <div className="dashboard-page-stack payments-page">
      <PaymentsHeroSection summaryCards={summaryCards} />

      <PaymentsFormSection
        error={error}
        formState={formState}
        payableLoans={payableLoans}
        allowedPaymentTypes={allowedPaymentTypes}
        canManagePayments={canManagePayments}
        isAdmin={isAdmin}
        isCustomer={isCustomer}
        loanDetails={loanDetails}
        selectedLoan={selectedLoan}
        submitting={submitting}
        capitalEligibilityState={capitalEligibilityState}
        payoffEligibilityState={payoffEligibilityState}
        payoffQuoteTotal={payoffQuoteTotal}
        payoffLoading={payoffQuoteQuery.isFetching}
        resolvedAlertMessage={resolvedAlertMessage}
        success={success}
        capitalButtonDisabled={capitalButtonDisabled}
        payoffButtonDisabled={payoffButtonDisabled}
        onFormChange={handleFormChange}
        onPaymentTypeChange={(paymentType) => {
          setActionErrorDetails(null);
          dispatch({ type: 'SET_PAYMENT_TYPE', paymentType });
        }}
        onSubmit={handleFormSubmit}
        onPartialPayment={handlePartialPayment}
        onCapitalPayment={handleCapitalPayment}
        onPayoff={handlePayoff}
        onPayoffDateChange={(payoffDate) => {
          setActionErrorDetails(null);
          dispatch({ type: 'SET_PAYOFF_DATE', payoffDate });
        }}
        buildEligibilityButtonTitle={buildEligibilityButtonTitle}
        getEligibilityPanelCopy={getEligibilityPanelCopy}
      />

      {showSuccessAnimation && (
        <div className="payments-success-overlay">
          <div className="surface-card payments-success-overlay__card">
            <DotLottieReact src="https://lottie.host/9701ac69-f35b-46ed-9f46-e58f84ffa77c/QUVXQRcA8Y.lottie" className="payments-success-overlay__animation" loop={false} autoplay />
            <div className="section-title section-title--medium">{t('payments.workspace.successOverlay')}</div>
          </div>
        </div>
      )}

      <PaymentsHistorySection
        formLoanId={formState.loanId}
        payments={payments}
        calendar={calendar}
        attachments={attachments}
        selectedPaymentId={selectedPaymentId}
        paymentDocuments={paymentDocuments}
        paymentDocumentDraft={paymentDocumentDraft}
        canManagePaymentDocuments={isAdmin || user.role === 'agent'}
        canAnnul={canAnnul}
        historyLoading={historyLoading}
        error={historyError}
        onRetry={() => {
          paymentsQuery.refetch();
          calendarQuery.refetch();
          attachmentsQuery.refetch();
        }}
        onDownloadAttachment={handleDownloadAttachment}
        onSelectPayment={setSelectedPaymentId}
        onPaymentDocumentDraftChange={(field, value) => setPaymentDocumentDraft((current) => ({ ...current, [field]: value }))}
        onUploadPaymentDocument={handleUploadPaymentDocument}
        onDownloadPaymentDocument={handleDownloadPaymentDocument}
        onAnnulInstallment={handleAnnulInstallment}
        annulMutation={annulInstallmentMutation}
        nearestCancellableInstallmentNumber={nearestCancellableInstallmentNumber}
        paymentsPagination={paymentsPagination}
        onPaymentsPageChange={(page) => setPaymentHistoryPage(PAYMENTS_HISTORY_SCOPE, page)}
      />
    </div>
  );
}

export default PaymentsWorkspace;
