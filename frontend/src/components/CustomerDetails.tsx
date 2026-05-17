import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Download, Trash2, CheckCircle, Clock, DollarSign, AlertTriangle, CreditCard } from 'lucide-react';
import { useTranslation } from '../i18n';
import { formatCurrency as formatLocaleCurrency, formatDate as formatLocaleDate, formatDateTime, formatNumber } from '../i18n/format';
import { useCustomerById, useCustomerDocuments } from '../services/customerService';
import { useCustomerReports } from '../services/reportService';
import { useLoans } from '../services/loanService';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';
import { confirmDanger } from '../lib/confirmModal';
import { extractRawErrorMessage } from '../services/safeErrorMessages';
import {
  ActionButton,
  CheckboxInput,
  ClickableSurface,
  EmptyState,
  FormField,
  IconActionButton,
  IconActionLink,
  InsightStrip,
  PageHeader,
  PageShell,
  SectionSurface,
  SelectInput,
  TextInput,
  ViewTabs,
} from './shared/Surfaces';

const CUSTOMER_DOCUMENT_ACCEPT = '.pdf,image/jpeg,image/png,image/webp';

/**
 * CustomerDetails displays a customer's profile, documents, credit history,
 * and credit history timeline. Provides document management and navigation
 * to individual credit details.
 */
export default function CustomerDetails() {
  useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const {
    data: customerResponse,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
  } = useCustomerById(customerId);
  const customer = customerResponse?.data?.customer || customerResponse?.data || null;

  const { documents, uploadDocument, deleteDocument, downloadDocumentUrl } = useCustomerDocuments(customerId);
  const { history, creditProfile } = useCustomerReports(customerId);
  const { data: loansData } = useLoans({ pageSize: 100 });

  const loans = Array.isArray(loansData?.data?.loans)
    ? loansData.data.loans
    : Array.isArray(loansData?.data)
      ? loansData.data
      : [];
  const customerLoans = loans.filter((l: any) => l.customerId === customerId);
  const customerDocumentOptions = [
    { value: 'identification', label: tTerm('customerDetails.documentType.identification') },
    { value: 'proof_of_address', label: tTerm('customerDetails.documentType.proofOfAddress') },
    { value: 'income_proof', label: tTerm('customerDetails.documentType.incomeProof') },
    { value: 'other', label: tTerm('customerDetails.documentType.other') },
  ] as const;

  const customerName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim() || customer?.email || tTerm('customerDetails.fallback.customerName');
  const customerPhone = customer?.phoneNumber || customer?.phone || tTerm('common.notAvailable');
  const customerCreditProfile = creditProfile?.data?.profile || creditProfile?.profile || null;
  const customerCreditSummary = customerCreditProfile?.summary || {};
  const historyEntries = Array.isArray(history?.data?.timeline)
    ? history.data.timeline
    : Array.isArray(history?.timeline)
      ? history.timeline
      : [];
  const normalizedCustomerStatus = String(customer?.status || '').toLowerCase();
  const getOutstandingPrincipal = (loan: any) => {
    const explicitOutstanding = Number(loan?.principalOutstanding);
    const calculatedOutstanding = Number(loan?.amount || 0) - Number(loan?.totalPaid || 0);
    const outstanding = Number.isFinite(explicitOutstanding)
      ? explicitOutstanding
      : calculatedOutstanding;

    return Math.max(0, Number.isFinite(outstanding) ? outstanding : 0);
  };

  // Calculate loan statistics
  const activeLoans = customerLoans.filter((l: any) => l.status === 'active' || l.status === 'ACTIVE');
  const completedLoans = customerLoans.filter((l: any) => l.status === 'closed' || l.status === 'CLOSED' || l.status === 'completed');
  const overdueLoans = customerLoans.filter((l: any) => l.status === 'overdue' || l.status === 'OVERDUE' || l.daysLate > 0);
  const totalDisbursed = customerLoans.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'loans' | 'history'>('profile');
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('identification');
  const [customerVisible, setCustomerVisible] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);

  const formatDisplayDate = (value: unknown, includeTime = false) => {
    return includeTime
      ? formatDateTime(value) || tTerm('common.dateUnavailable')
      : formatLocaleDate(value) || tTerm('common.dateUnavailable');
  };

  const formatLoanId = (value: unknown) => {
    const rawId = value == null ? '' : String(value);
    return rawId ? rawId.slice(0, 8) : tTerm('common.notAvailable');
  };

  const formatLoanDate = (dateStr: string) => {
    return formatLocaleDate(dateStr, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) || '-';
  };

  const formatDisplayNumber = (value: unknown, fallback = tTerm('common.notAvailable')) => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? formatNumber(numericValue) : fallback;
  };

  const getDocumentTypeLabel = (value: unknown) => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return customerDocumentOptions.find((option) => option.value === normalizedValue)?.label || tTerm('customerDetails.documentType.fallback');
  };

  const getLoanStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'active': { label: tTerm('common.status.active'), className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      'ACTIVE': { label: tTerm('common.status.active'), className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
      'closed': { label: tTerm('common.status.closed'), className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'CLOSED': { label: tTerm('common.status.closed'), className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'completed': { label: tTerm('common.status.completed'), className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'COMPLETED': { label: tTerm('common.status.completed'), className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400' },
      'overdue': { label: tTerm('schedule.status.overdue'), className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
      'OVERDUE': { label: tTerm('schedule.status.overdue'), className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
      'pending': { label: tTerm('schedule.status.pending'), className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
      'PENDING': { label: tTerm('schedule.status.pending'), className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    };

    const config = statusMap[status] || {
      label: status,
      className: 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400',
    };

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (isCustomerLoading) {
    return (
      <PageShell className="mx-auto max-w-6xl">
        <EmptyState title={tTerm('customerDetails.loading')} compact />
      </PageShell>
    );
  }

  if (isCustomerError || !customer) {
    return (
      <PageShell className="mx-auto max-w-6xl">
        <EmptyState
          title={tTerm('customerDetails.error.title')}
          description={tTerm('customerDetails.error.description')}
          action={(
            <ActionButton onClick={() => navigate('/customers')} icon={<ArrowLeft size={16} />}>
              {tTerm('newCustomer.actions.back')}
            </ActionButton>
          )}
        />
      </PageShell>
    );
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      await uploadDocument.mutateAsync({
        file,
        metadata: {
          category: docType,
          customerVisible,
        },
      });
      setFile(null);
      setFileInputKey((current) => current + 1);
      toast.success({ title: tTerm('customerDetails.toast.document.upload.success') });
    } catch (error) {
      const rawMessage = extractRawErrorMessage(error);
      if (/unsupported attachment file type/i.test(rawMessage)) {
        toast.error({
          title: tTerm('customerDetails.toast.document.upload.invalidType.title'),
          description: tTerm('customerDetails.toast.document.upload.invalidType.description'),
        });
        return;
      }

      toast.apiErrorSafe(error, {
        domain: 'customers',
        action: 'customer.update',
        fallbackMessage: tTerm('customerDetails.toast.document.upload.error'),
      });
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    const confirmed = await confirmDanger({
      title: tTerm('confirm.document.delete.title'),
      message: tTerm('confirm.document.delete.message'),
      confirmLabel: tTerm('confirm.document.delete.confirm'),
    });
    if (!confirmed) return;
    try {
      await deleteDocument.mutateAsync(docId);
    } catch (error) {
      toast.apiErrorSafe(error, {
        domain: 'customers',
        action: 'customer.update',
        fallbackMessage: tTerm('customerDetails.toast.document.delete.error'),
      });
    }
  };

  return (
    <PageShell className="mx-auto max-w-6xl" data-tour="customer-details-page">
      <PageHeader
        title={customerName}
        subtitle={tTerm('customerDetails.header.subtitle', {
          id: formatNumber(customer.id),
          documentNumber: customer.documentNumber || tTerm('common.notAvailable'),
        })}
        guideKey="customer-details"
        tourId="customer-details-header"
        actions={(
          <>
            <ActionButton onClick={() => navigate('/customers')} icon={<ArrowLeft size={16} />}>
              {tTerm('customerDetails.cta.back')}
            </ActionButton>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            normalizedCustomerStatus === 'active'
              ? 'bg-status-success-bg text-status-success'
              : normalizedCustomerStatus === 'blacklisted'
                ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-status-warning-bg text-status-warning'
          }`}>
            {normalizedCustomerStatus === 'active'
              ? tTerm('common.status.active')
              : normalizedCustomerStatus === 'blacklisted'
                ? tTerm('common.status.blacklisted')
                : tTerm('common.status.inactive')}
          </span>
          </>
        )}
      />

      <ViewTabs
        data-tour="customer-details-tabs"
        ariaLabel={tTerm('customerDetails.tabs.ariaLabel')}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={[
          { id: 'profile', label: tTerm('customerDetails.tab.profile') },
          { id: 'documents', label: tTerm('customerDetails.tab.documents') },
          { id: 'loans', label: tTerm('customerDetails.tab.loans') },
          { id: 'history', label: tTerm('customerDetails.tab.history') },
        ]}
      />

      <SectionSurface>
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold mb-4">{tTerm('customerDetails.section.personal')}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">{tTerm('customerDetails.field.email')}</span>
                  <span className="font-medium">{customer.email}</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">{tTerm('customerDetails.field.phone')}</span>
                   <span className="font-medium">{customerPhone}</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-secondary">{tTerm('customerDetails.field.address')}</span>
                  <span className="font-medium">{customer.address || tTerm('common.notAvailable')}</span>
                </div>
              </div>
            </div>
            {customerCreditProfile && (
              <div>
                <h3 className="font-bold mb-4">{tTerm('customerDetails.section.creditProfile')}</h3>
                <div className="rounded-xl border border-border-subtle bg-bg-base p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{tTerm('customerDetails.metric.internalScore')}</span>
                    <span className="font-bold text-brand-primary">{formatDisplayNumber(customerCreditSummary?.score)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{tTerm('customerDetails.metric.totalLoans')}</span>
                    <span className="font-medium">{formatNumber(customerCreditSummary?.totalLoans ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{tTerm('customerDetails.metric.paymentBehavior')}</span>
                    <span className="font-medium">{customerCreditSummary?.paymentBehavior || tTerm('common.notAvailable')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold">{tTerm('customerDetails.documents.title')}</h3>
            </div>
            
            <SectionSurface
              as="form"
              onSubmit={handleUpload}
              className="mb-8 border-dashed"
              bodyClassName="grid gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_auto_auto] lg:items-end"
            >
              <FormField label={tTerm('customerDetails.documents.field.type')} htmlFor="customer-document-type">
                <SelectInput id="customer-document-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {customerDocumentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label={tTerm('customerDetails.documents.field.file')} htmlFor="customer-document-file" helper={tTerm('customerDetails.documents.field.fileHelper')}>
                <TextInput
                  id="customer-document-file"
                  key={fileInputKey}
                  type="file"
                  accept={CUSTOMER_DOCUMENT_ACCEPT}
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </FormField>
              <label className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary">
                <CheckboxInput
                  checked={customerVisible}
                  onChange={(e) => setCustomerVisible(e.target.checked)}
                />
                {tTerm('customerDetails.documents.visibleToCustomer')}
              </label>
              <ActionButton type="submit" disabled={!file || uploadDocument.isPending} isLoading={uploadDocument.isPending} icon={<Upload size={16} />} variant="primary">
                {tTerm('customerDetails.documents.cta.upload')}
              </ActionButton>
            </SectionSurface>

            <div className="space-y-3">
              {documents?.map((doc: any) => (
                <div key={doc.id} className="flex flex-col gap-3 rounded-xl border border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="text-text-secondary" size={20} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={doc.originalName}>{doc.originalName}</p>
                      <p className="text-xs text-text-secondary">
                        {getDocumentTypeLabel(doc.category)}
                        {doc.customerVisible === false
                          ? ` • ${tTerm('customerDetails.documents.visibility.internal')}`
                          : ` • ${tTerm('customerDetails.documents.visibility.customer')}`}
                        {' • '}
                        {formatDisplayDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconActionLink
                      href={downloadDocumentUrl(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      label={tTerm('customerDetails.documents.download')}
                      title={tTerm('customerDetails.documents.download')}
                      icon={<Download size={16} />}
                    />
                    <IconActionButton
                      onClick={() => handleDeleteDoc(doc.id)}
                      label={tTerm('customerDetails.documents.delete')}
                      title={tTerm('customerDetails.documents.delete')}
                      variant="danger"
                      icon={<Trash2 size={16} />}
                    />
                  </div>
                </div>
              ))}
              {(!documents || documents.length === 0) && (
                <EmptyState title={tTerm('customerDetails.documents.empty')} compact />
              )}
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div>
            {/* Loan Statistics */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-text-secondary mb-4">{tTerm('customerDetails.loans.summaryTitle')}</h4>
              <InsightStrip
                aria-label={tTerm('customerDetails.loans.summaryAriaLabel')}
                items={[
                  { id: 'customer-loans-total', label: tTerm('customerDetails.loans.metric.total'), value: formatNumber(customerLoans.length), helper: tTerm('customerDetails.loans.metric.totalHelper'), icon: <CreditCard size={18} />, accent: 'blue' },
                  { id: 'customer-loans-active', label: tTerm('customerDetails.loans.metric.active'), value: formatNumber(activeLoans.length), helper: tTerm('customerDetails.loans.metric.activeHelper'), icon: <CheckCircle size={18} />, accent: 'emerald' },
                  { id: 'customer-loans-completed', label: tTerm('customerDetails.loans.metric.completed'), value: formatNumber(completedLoans.length), helper: tTerm('customerDetails.loans.metric.completedHelper'), icon: <Clock size={18} />, accent: 'slate' },
                  { id: 'customer-loans-overdue', label: tTerm('customerDetails.loans.metric.overdue'), value: formatNumber(overdueLoans.length), helper: tTerm('customerDetails.loans.metric.overdueHelper'), icon: <AlertTriangle size={18} />, accent: 'rose' },
                  { id: 'customer-loans-disbursed', label: tTerm('customerDetails.loans.metric.disbursed'), value: formatLocaleCurrency(totalDisbursed), helper: tTerm('customerDetails.loans.metric.disbursedHelper'), icon: <DollarSign size={18} />, accent: 'teal' },
                ]}
              />
            </div>

            <h3 className="font-bold mb-4">{tTerm('customerDetails.loans.title')}</h3>
            <div className="space-y-3">
              {customerLoans.map((loan: any) => (
                <ClickableSurface
                  key={loan.id}
                  onClick={() => navigate(`/credits/${loan.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard size={16} className="text-text-secondary" />
                        <p className="font-medium">{tTerm('customerDetails.loans.card.title', { loanId: formatLoanId(loan.id) })}</p>
                        {getLoanStatusBadge(loan.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-text-secondary mt-3">
                        <div>
                          <p className="text-text-secondary">{tTerm('customerDetails.loans.field.amount')}</p>
                          <p className="font-medium text-text-primary">{formatLocaleCurrency(loan.amount)}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">{tTerm('customerDetails.loans.field.rate')}</p>
                          <p className="font-medium text-text-primary">{`${formatNumber(loan.interestRate ?? 0, { maximumFractionDigits: 2 })}%`}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">{tTerm('customerDetails.loans.field.term')}</p>
                          <p className="font-medium text-text-primary">{tTerm('customerDetails.loans.termMonths', { months: formatNumber(loan.termMonths ?? 0) })}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary">{tTerm('customerDetails.loans.field.startDate')}</p>
                          <p className="font-medium text-text-primary">{formatLoanDate(loan.startDate)}</p>
                        </div>
                      </div>
                      {loan.daysLate > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle size={12} />
                          <span>{tTerm('customerDetails.loans.daysOverdue', { days: formatNumber(loan.daysLate) })}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-secondary mb-1">{tTerm('customerDetails.loans.field.outstanding')}</p>
                      <p className="text-lg font-bold text-text-primary">{formatLocaleCurrency(getOutstandingPrincipal(loan))}</p>
                      <p className="text-xs text-text-secondary mt-2">{tTerm('customerDetails.loans.field.paid', { amount: formatLocaleCurrency(loan.totalPaid || 0) })}</p>
                    </div>
                  </div>
                </ClickableSurface>
              ))}
              {customerLoans.length === 0 && (
                <EmptyState title={tTerm('customerDetails.loans.empty')} icon={<CreditCard size={28} />} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="font-bold mb-4">{tTerm('customerDetails.history.title')}</h3>
            <div className="space-y-4">
              {historyEntries.map((event: any, i: number) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1"><Clock size={16} className="text-text-secondary" /></div>
                  <div>
                    <p className="text-sm font-medium">{event.action || event.eventType || tTerm('customerDetails.history.eventFallback')}</p>
                    <p className="text-sm text-text-secondary">{event.description || event.entityType || tTerm('customerDetails.history.descriptionFallback')}</p>
                    <p className="text-xs text-text-secondary mt-1">{formatDisplayDate(event.date || event.occurredAt, true)}</p>
                  </div>
                </div>
              ))}
              {historyEntries.length === 0 && (
                <EmptyState title={tTerm('customerDetails.history.empty')} compact />
              )}
            </div>
          </div>
        )}
      </SectionSurface>
    </PageShell>
  );
}
