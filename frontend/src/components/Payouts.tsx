import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { usePayments, downloadVoucher } from '../services/paymentService';
import { usePaginationStore } from '../store/paginationStore';
import { toast } from '../lib/toast';
import { useSessionStore } from '../store/sessionStore';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { useQueryClient } from '@tanstack/react-query';
import { useOperationalActions } from './hooks/useOperationalActions';
import { resolveOperationalGuard } from '../services/operationalGuards';
import { useNavigate } from 'react-router-dom';
import { formatCurrency as formatCurrencyValue, formatDateTime as formatDateTimeValue, isValidOperationalDateOnly } from '../i18n/format';
import { useTranslation } from '../i18n';
import { tTerm } from '../i18n/terminology';
import {
  AppTable,
  RowActionsWithOverflow,
  type RowActionOverflowItem,
  TableActionsCell,
  TableActionsHeader,
} from './shared/tables';
import { getChipClassName } from '../constants/uiChips';
import { parsePositiveIntegerInput, parsePositiveMoneyInput } from '../lib/moneyInput';
import { CAPITAL_STRATEGIES, PAYMENT_METHODS as FALLBACK_PAYMENT_METHODS, type CapitalStrategy, type PaymentMethod } from '../services/loanService';
import { useConfig } from '../services/configService';
import {
  ActionButton,
  AppInput,
  CheckboxInput,
  CurrencyInput,
  FormField,
  LoanSearchSelect,
  ModalShell,
  OperationalSelect,
  PageHeader,
  PageShell,
  ToolbarSurface,
} from './shared/Surfaces';
import { HelpLabel } from './shared/HelpSupport';
import { getLocalDateInputValue } from '../lib/dateInput';

export default function Payouts() {
  const { locale } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSessionStore();
  const { executeGuardedAction } = useOperationalActions(queryClient);
  const { paymentMethods: configuredPaymentMethods } = useConfig({ enabled: user?.role === 'admin' });
  const { page, setPage, pageSize, setPageSize } = usePaginationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();
  const previousNormalizedSearchQuery = useRef(normalizedSearchQuery);
  const { data: paymentsData, isLoading, isError, createPayment, createPartialPayment, createCapitalPayment, updatePaymentMetadata } = usePayments({
    page,
    pageSize,
    search: normalizedSearchQuery || undefined,
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'regular' | 'partial' | 'capital'>('regular');
  const [capitalStrategy, setCapitalStrategy] = useState<CapitalStrategy>('reduce_term');
  const [capitalNewTermMonths, setCapitalNewTermMonths] = useState('');
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    loanId: '',
    amount: '',
    paymentDate: getLocalDateInputValue(),
    paymentMethod: 'cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [showEditMethodModal, setShowEditMethodModal] = useState(false);
  const [editedMethod, setEditedMethod] = useState<PaymentMethod>('transfer');
  const [editedReference, setEditedReference] = useState('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);
  const paymentMethodOptions = useMemo(() => {
    const activeConfiguredMethods = configuredPaymentMethods
      .filter((method: any) => method?.isActive !== false)
      .map((method: any) => ({
        value: String(method?.key ?? method?.type ?? '').trim().toLowerCase(),
        label: String(method?.label ?? method?.name ?? '').trim() || tTerm('settings.paymentMethods.methodUnnamed'),
      }))
      .filter((method) => method.value);

    return activeConfiguredMethods.length > 0
      ? activeConfiguredMethods
      : [...FALLBACK_PAYMENT_METHODS];
  }, [configuredPaymentMethods]);
  const defaultPaymentMethod = paymentMethodOptions[0]?.value || 'transfer';

  const role = user?.role;
  const permissions = useResolvedPermissionNames(user);

  const payoutTypeOptions = useMemo(() => {
    const options = [
      {
        value: 'regular' as const,
        label: tTerm('payouts.type.regular.label'),
        description: tTerm('payouts.type.regular.description'),
      },
      {
        value: 'partial' as const,
        label: tTerm('payouts.type.partial.label'),
        description: tTerm('payouts.type.partial.description'),
      },
      {
        value: 'capital' as const,
        label: tTerm('payouts.type.capital.label'),
        description: tTerm('payouts.type.capital.description'),
      },
    ];

    return options
      .map((option) => ({
        ...option,
        guard: resolveOperationalGuard('payout.register', { role, permissions, payoutType: option.value }),
      }))
      .filter((option) => option.guard.visible);
  }, [locale, permissions, role]);

  const selectedPayoutTypeGuard = useMemo(
    () => resolveOperationalGuard('payout.register', { role, permissions, payoutType: paymentType }),
    [permissions, paymentType, role],
  );
  const firstExecutablePayoutType = payoutTypeOptions.find((option) => option.guard.executable);
  const canOpenPaymentModal = Boolean(firstExecutablePayoutType);

  const payments = Array.isArray(paymentsData?.data?.payments)
    ? paymentsData.data.payments
    : Array.isArray(paymentsData?.data)
      ? paymentsData.data
      : [];
  const pagination = paymentsData?.data?.pagination ?? paymentsData?.pagination ?? paymentsData?.meta;
  useEffect(() => {
    if (previousNormalizedSearchQuery.current === normalizedSearchQuery) {
      return;
    }

    previousNormalizedSearchQuery.current = normalizedSearchQuery;
    setPage(1);
  }, [normalizedSearchQuery, setPage]);

  useEffect(() => {
    const currentOption = payoutTypeOptions.find((option) => option.value === paymentType && option.guard.executable);

    if (!currentOption && firstExecutablePayoutType) {
      setPaymentType(firstExecutablePayoutType.value);
    }
  }, [firstExecutablePayoutType, paymentType, payoutTypeOptions]);

  useEffect(() => {
    const configuredMethod = paymentMethodOptions.some((method) => method.value === formData.paymentMethod);

    if (!configuredMethod) {
      setFormData((current) => ({ ...current, paymentMethod: defaultPaymentMethod }));
    }
  }, [defaultPaymentMethod, formData.paymentMethod, paymentMethodOptions]);

  useEffect(() => {
    const visiblePaymentIds = new Set(
      payments
        .map((payment: any) => Number(payment?.id))
        .filter((paymentId: number): paymentId is number => Number.isFinite(paymentId)),
    );

    setSelectedPaymentIds((current) => {
      const nextSelection = current.filter((paymentId) => visiblePaymentIds.has(paymentId));
      const didSelectionChange = nextSelection.length !== current.length
        || nextSelection.some((paymentId, index) => paymentId !== current[index]);

      return didSelectionChange ? nextSelection : current;
    });
  }, [payments]);

  const selectedPayments = useMemo(
    () => payments.filter((payment: any) => selectedPaymentIds.includes(Number(payment.id))),
    [payments, selectedPaymentIds],
  );

  const allVisibleSelected = payments.length > 0 && selectedPayments.length === payments.length;

  const formatPaymentDate = (payment: any) => {
    const rawDate = payment?.paymentDate ?? payment?.date ?? payment?.createdAt;
    return formatDateTimeValue(rawDate) || tTerm('common.dateUnavailable');
  };

  const formatPaymentMethod = (payment: any) => {
    const rawMethod = String(
      payment?.paymentMethod
      || '',
    ).trim().toLowerCase();

    if (!rawMethod) {
      return tTerm('common.notSpecified');
    }

    const matchingMethod = paymentMethodOptions.find((method) => method.value === rawMethod);
    return matchingMethod?.label || tTerm('settings.paymentMethods.methodUnnamed');
  };

  const getPaymentStatusPresentation = (payment: any) => {
    const normalizedStatus = String(payment?.status || '').toLowerCase();

    if (normalizedStatus === 'applied' || normalizedStatus === 'completed') {
      return { label: tTerm('payouts.status.applied'), tone: 'success' as const };
    }

    if (normalizedStatus === 'annulled') {
      return { label: tTerm('payouts.status.annulled'), tone: 'neutral' as const };
    }

    if (normalizedStatus === 'failed') {
      return { label: tTerm('payouts.status.failed'), tone: 'danger' as const };
    }

    return { label: tTerm('payouts.status.pending'), tone: 'warning' as const };
  };

  const handleDownloadVoucher = async (paymentId: number) => {
    await executeGuardedAction({
      action: 'payout.voucher.download',
      context: { role, permissions },
      run: async () => {
        await downloadVoucher(paymentId);
      },
      successMessage: tTerm('payouts.toast.voucher.success'),
    });
  };

  const handleViewCredit = async (loanId?: number) => {
    if (!loanId) {
      toast.error({ title: tTerm('payouts.toast.loanNotFound') });
      return;
    }

    await executeGuardedAction({
      action: 'payout.credit.view',
      context: { role, permissions },
      run: async () => {
        navigate(`/credits/${loanId}`);
      },
    });
  };

  const handleEditPayment = async (payment: any) => {
    const editGuard = resolveOperationalGuard('payout.metadata.edit', {
      role,
      permissions,
      paymentStatus: payment?.status,
      paymentReconciled: Boolean(payment?.reconciled || payment?.isReconciled || payment?.paymentMetadata?.reconciled),
    });

    if (!editGuard.executable) {
      toast.error({ title: editGuard.reason || tTerm('credits.action.unavailable') });
      return;
    }

    const normalizedMethod = String(payment?.paymentMethod || defaultPaymentMethod).toLowerCase();
    const hasMethod = paymentMethodOptions.some((method) => method.value === normalizedMethod);
    setEditedMethod((hasMethod ? normalizedMethod : defaultPaymentMethod) as PaymentMethod);
    setEditedReference(payment?.paymentMetadata?.reference || '');
    setEditingPayment(payment);
    setShowEditMethodModal(true);
  };

  const handleSavePaymentMethod = async () => {
    if (!editingPayment) return;

    await executeGuardedAction({
      action: 'payout.metadata.edit',
      context: {
        role,
        permissions,
        paymentStatus: editingPayment?.status,
        paymentReconciled: Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled),
      },
      confirmationMessage: tTerm('payouts.confirm.editMethod'),
      run: async () => {
        await updatePaymentMetadata.mutateAsync({
          paymentId: Number(editingPayment.id),
          payload: {
            loanId: editingPayment?.loanId,
            paymentMethod: editedMethod,
            paymentMetadata: {
              ...(editingPayment?.paymentMetadata || {}),
              reference: editedReference,
            },
          },
        });
      },
      onSuccess: () => {
        setShowEditMethodModal(false);
        setEditingPayment(null);
      },
      successMessage: tTerm('payouts.toast.edit.success'),
    });
  };

  const handleToggleSelection = (paymentId: number, checked: boolean) => {
    setSelectedPaymentIds((previous) => {
      if (checked) {
        if (previous.includes(paymentId)) return previous;
        return [...previous, paymentId];
      }
      return previous.filter((id) => id !== paymentId);
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedPaymentIds([]);
      return;
    }

    setSelectedPaymentIds(payments.map((payment: any) => Number(payment.id)).filter((value: number) => Number.isFinite(value)));
  };

  const handleBulkDownloadVouchers = async () => {
    if (selectedPayments.length === 0) {
      toast.error({ title: tTerm('payouts.bulk.empty') });
      return;
    }

    await executeGuardedAction({
      action: 'payout.voucher.download',
      context: { role, permissions },
      run: async () => {
        await Promise.all(
          selectedPayments.map((payment: any) => downloadVoucher(Number(payment.id))),
        );
      },
      successMessage: tTerm('payouts.bulk.downloadSuccess', { count: selectedPayments.length }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const loanId = parsePositiveIntegerInput(formData.loanId);
    const amount = parsePositiveMoneyInput(formData.amount);

    if (loanId === null) {
      toast.error({ title: tTerm('payouts.validation.loanId') });
      return;
    }

    if (amount === null) {
      toast.error({ title: tTerm('payouts.validation.amount') });
      return;
    }

    if (!isValidOperationalDateOnly(formData.paymentDate)) {
      toast.error({ title: tTerm('creditDetails.error.paymentDate') });
      return;
    }
    const newTermMonths = parsePositiveIntegerInput(capitalNewTermMonths);
    if (paymentType === 'capital' && capitalStrategy === 'reduce_payment' && newTermMonths === null) {
      toast.error({ title: tTerm('creditDetails.modal.capital.newTermValidation') });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      loanId,
      amount,
      paymentDate: `${formData.paymentDate}T00:00:00.000Z`,
      paymentMethod: formData.paymentMethod,
      ...(paymentType === 'capital' ? { strategy: capitalStrategy } : {}),
      ...(paymentType === 'capital' && capitalStrategy === 'reduce_payment' ? { newTermMonths: newTermMonths as number } : {}),
    };
    const guardedAction = paymentType === 'capital' ? 'capital.payment' : 'payout.register';

    const wasExecuted = await executeGuardedAction({
      action: guardedAction,
      context: { role, permissions, payoutType: paymentType },
      run: async () => {
        if (paymentType === 'regular') {
          await createPayment.mutateAsync(payload);
        } else if (paymentType === 'partial') {
          await createPartialPayment.mutateAsync(payload);
        } else if (paymentType === 'capital') {
          await createCapitalPayment.mutateAsync(payload);
        }
      },
      onSuccess: () => {
        setShowPaymentModal(false);
        setFormData({ loanId: '', amount: '', paymentDate: getLocalDateInputValue(), paymentMethod: defaultPaymentMethod });
        setLoanSearchQuery('');
        setCapitalNewTermMonths('');
      },
      successMessage: tTerm('payouts.toast.register.success'),
    });

    if (!wasExecuted) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  const openPaymentModal = () => {
    if (!firstExecutablePayoutType) {
      toast.error({ title: selectedPayoutTypeGuard.reason || tTerm('payouts.toast.actionUnavailableUser') });
      return;
    }

    if (paymentType !== firstExecutablePayoutType.value && !selectedPayoutTypeGuard.executable) {
      setPaymentType(firstExecutablePayoutType.value);
    }

    setFormData((current) => ({ ...current, paymentMethod: defaultPaymentMethod }));
    setLoanSearchQuery('');
    setShowPaymentModal(true);
  };

  return (
    <PageShell className="h-full" data-tour="payouts-page">
      <PageHeader
        title={tTerm('payouts.module.title')}
        subtitle={tTerm('payouts.module.subtitle')}
        guideKey="payouts"
        tourId="payouts-header"
        actions={(
        <ActionButton
          onClick={openPaymentModal}
          disabled={!canOpenPaymentModal}
          title={canOpenPaymentModal ? tTerm('payouts.cta.recordPayment') : (selectedPayoutTypeGuard.reason || tTerm('credits.action.unavailable'))}
          variant="primary"
          icon={<Plus size={16} />}
        >
          {tTerm('payouts.cta.recordPayment')}
        </ActionButton>
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {selectedPayments.length > 0 && (
          <ToolbarSurface>
            <p className="text-sm text-text-secondary">
              {tTerm('payouts.bulk.selected', { count: selectedPayments.length })}
            </p>
            <div className="flex items-center gap-2">
              <ActionButton
                type="button"
                onClick={handleBulkDownloadVouchers}
                variant="primary"
              >
                {tTerm('payouts.bulk.download')}
              </ActionButton>
              <ActionButton
                type="button"
                onClick={() => setSelectedPaymentIds([])}
                variant="ghost"
              >
                {tTerm('payouts.bulk.clear')}
              </ActionButton>
            </div>
          </ToolbarSurface>
        )}

        <ToolbarSurface data-tour="payouts-search">
          <div className="w-full sm:w-72">
            <AppInput
              variant="text"
              value={searchQuery}
              onValueChange={(v, _detail, e) => setSearchQuery(v)}
              placeholder={tTerm('payouts.search.placeholder')}
              icon={<Search size={16} />}
            />
          </div>
        </ToolbarSurface>

        <AppTable variant="operational"
          data-tour="payouts-table"
          isLoading={isLoading}
          isError={isError}
          hasData={payments.length > 0}
          loadingContent={<div className="py-4 text-center text-text-secondary">{tTerm('payouts.state.loading')}</div>}
          errorContent={<div className="py-4 text-center text-red-500">{tTerm('payouts.state.error')}</div>}
          emptyContent={<div className="py-4 text-center text-text-secondary">{tTerm('payouts.state.empty')}</div>}
          recordsLabel={tTerm('payouts.recordsLabel')}
          pagination={pagination ? {
            page,
            pageSize,
            totalItems: pagination?.totalItems ?? pagination?.total ?? 0,
            totalPages: pagination?.totalPages ?? 1,
            onPrev: () => setPage(page - 1),
            onNext: () => setPage(page + 1),
            onPageSizeChange: (nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            },
          } : undefined}
          className="data-table-surface"
          minWidthClassName="min-w-[760px]"
        >
            <thead>
              <tr>
                <th className="pb-3 font-medium w-10">
                  <CheckboxInput
                    aria-label={tTerm('payouts.table.selectAll')}
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleSelectAll(event.target.checked)}
                  />
                </th>
                <th className="pb-3 font-medium">{tTerm('payouts.table.loanId')}</th>
                <th className="pb-3 font-medium">{tTerm('payouts.table.date')}</th>
                <th className="pb-3 font-medium">{tTerm('payouts.table.amount')}</th>
                <th className="pb-3 font-medium">
                  <HelpLabel label={tTerm('payouts.table.method')} text={tTerm('payouts.table.methodHelp')} />
                </th>
                <th className="pb-3 font-medium">
                  <HelpLabel label={tTerm('payouts.table.status')} text={tTerm('payouts.table.statusHelp')} />
                </th>
                <TableActionsHeader className="pb-3 font-medium">{tTerm('payouts.table.actions')}</TableActionsHeader>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: any) => {
                const viewGuard = resolveOperationalGuard('payout.credit.view', { role, permissions });
                const viewCreditTitle = viewGuard.executable
                  ? tTerm('payouts.action.viewCredit')
                  : (viewGuard.reason || tTerm('credits.action.unavailable'));

                return (
                <tr key={payment.id} className="hover:bg-hover-bg transition-colors">
                  <td className="py-4">
                    <CheckboxInput
                      aria-label={tTerm('payouts.table.selectOne')}
                      checked={selectedPaymentIds.includes(Number(payment.id))}
                      onChange={(event) => handleToggleSelection(Number(payment.id), event.target.checked)}
                    />
                  </td>
                  <td className="py-4">
                    {viewGuard.visible ? (
                      <button
                        type="button"
                        className="text-brand-primary transition hover:underline disabled:cursor-not-allowed disabled:text-text-secondary disabled:no-underline"
                        onClick={() => handleViewCredit(Number(payment.loanId))}
                        disabled={!viewGuard.executable}
                        title={viewCreditTitle}
                      >
                        {tTerm('payouts.table.linkedLoan')}
                      </button>
                    ) : (
                      <span className="text-text-secondary">{tTerm('payouts.table.linkedLoan')}</span>
                    )}
                  </td>
                  <td className="py-4 text-text-secondary">{formatPaymentDate(payment)}</td>
                  <td className="py-4 font-medium">{formatCurrencyValue(payment.amount)}</td>
                  <td className="py-4 text-text-secondary capitalize">{formatPaymentMethod(payment)}</td>
                  <td className="py-4">
                    {(() => {
                      const status = getPaymentStatusPresentation(payment);
                      return (
                        <span className={`px-2 py-1 rounded text-xs ${getChipClassName(status.tone)}`}>
                          {status.label}
                        </span>
                      );
                    })()}
                  </td>
                  <TableActionsCell className="py-4">
                    {(() => {
                      const editGuard = resolveOperationalGuard('payout.metadata.edit', {
                        role,
                        permissions,
                        paymentStatus: payment?.status,
                        paymentReconciled: Boolean(payment?.reconciled || payment?.isReconciled || payment?.paymentMetadata?.reconciled),
                      });
                      const deleteGuard = resolveOperationalGuard('payout.delete', {
                        role,
                        permissions,
                        paymentStatus: payment?.status,
                      });
                      const items: RowActionOverflowItem[] = [
                        {
                          id: 'voucher',
                          label: tTerm('payouts.action.downloadVoucher'),
                          icon: <FileText size={16} />,
                          onClick: () => handleDownloadVoucher(payment.id),
                        },
                      ];
                      if (viewGuard.visible) {
                        items.push({
                          id: 'view',
                          label: viewGuard.executable
                            ? tTerm('payouts.action.viewCredit')
                            : (viewGuard.reason || tTerm('credits.action.unavailable')),
                          icon: <Eye size={16} />,
                          onClick: () => handleViewCredit(Number(payment.loanId)),
                          disabled: !viewGuard.executable,
                        });
                      }
                      if (editGuard.visible) {
                        items.push({
                          id: 'edit',
                          label: editGuard.executable
                            ? tTerm('payouts.action.editPaymentMethodTitle')
                            : (editGuard.reason || tTerm('credits.action.unavailable')),
                          icon: <Edit size={16} />,
                          onClick: () => handleEditPayment(payment),
                          disabled: !editGuard.executable,
                        });
                      }
                      if (deleteGuard.visible) {
                        items.push({
                          id: 'delete',
                          label: deleteGuard.reason || tTerm('payouts.action.deleteTitle'),
                          icon: <Trash2 size={16} />,
                          onClick: () => toast.error({ title: deleteGuard.reason || tTerm('credits.action.unavailable') }),
                          disabled: !deleteGuard.executable,
                          iconVariant: 'danger',
                          menuTone: 'danger',
                        });
                      }
                      return (
                        <RowActionsWithOverflow
                          variant="icon"
                          align="center"
                          items={items}
                          ariaLabel={tTerm('payouts.table.actions')}
                        />
                      );
                    })()}
                  </TableActionsCell>
                </tr>
                );
              })}
            </tbody>
        </AppTable>
      </div>

      {showPaymentModal && (
        <ModalShell title={tTerm('payouts.cta.recordPayment')} onClose={() => setShowPaymentModal(false)}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                label={tTerm('payouts.form.paymentType')}
                tooltip={tTerm('payouts.form.paymentTypeTooltip')}
                helper={payoutTypeOptions.find((option) => option.value === paymentType)?.description || selectedPayoutTypeGuard.reason}
              >
                <OperationalSelect
                  id="payout-type"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                >
                  {payoutTypeOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={!option.guard.executable}>
                      {option.label}
                    </option>
                  ))}
                </OperationalSelect>
              </FormField>

              <FormField
                label={tTerm('payouts.form.loanId')}
                helper={formData.loanId ? tTerm('payouts.form.loanSearch.selected') : tTerm('payouts.form.loanSearch.helper')}
              >
                <LoanSearchSelect
                  id="payout-loan-search"
                  selectedLoanId={formData.loanId}
                  searchValue={loanSearchQuery}
                  onSearchValueChange={setLoanSearchQuery}
                  onSelectedLoanIdChange={(value) => setFormData((prev) => ({ ...prev, loanId: value }))}
                  pageSize={12}
                  includeOutstanding
                  enabled={showPaymentModal}
                />
              </FormField>

              <FormField label={tTerm('payouts.form.amount')}>
                <CurrencyInput
                  id="payout-amount"
                  allowCents
                  required
                  value={formData.amount}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, amount: value }))}
                  minValue={0}
                  allowZero
                />
              </FormField>

              <FormField label={tTerm('payouts.form.date')}>
                <AppInput
                  id="payout-date"
                  variant="date"
                  required
                  value={formData.paymentDate}
                  onValueChange={(v, _detail, e) => setFormData((prev) => ({ ...prev, paymentDate: v }))}
                />
              </FormField>

              <FormField label={tTerm('payouts.form.paymentMethod')}>
                <OperationalSelect
                  id="payout-method"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </OperationalSelect>
              </FormField>

              {paymentType === 'capital' && (
                <>
                  <FormField label={tTerm('payouts.form.capitalStrategy')}>
                    <OperationalSelect
                      id="payout-capital-strategy"
                      value={capitalStrategy}
                      onChange={(event) => setCapitalStrategy(event.target.value as CapitalStrategy)}
                    >
                      {CAPITAL_STRATEGIES.map((strategy) => (
                        <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                      ))}
                    </OperationalSelect>
                  </FormField>
                  {capitalStrategy === 'reduce_payment' && (
                    <FormField label={tTerm('creditDetails.modal.capital.newTermMonths')}>
                      <AppInput
                        id="payout-capital-new-term"
                        variant="integer"
                        value={capitalNewTermMonths}
                        onValueChange={setCapitalNewTermMonths}
                        placeholder="12"
                        minValue={1}
                      />
                    </FormField>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4">
                <ActionButton
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  variant="secondary"
                  fullWidth
                >
                  {tTerm('common.cta.cancel')}
                </ActionButton>
                <ActionButton
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  fullWidth
                >
                  {isSubmitting ? tTerm('payouts.form.submitting') : tTerm('payouts.form.submit')}
                </ActionButton>
              </div>
            </form>
        </ModalShell>
      )}

      {showEditMethodModal && editingPayment && (
        <ModalShell
          title={tTerm('payouts.edit.title')}
          subtitle={tTerm('payouts.edit.subtitle')}
          onClose={() => {
            setShowEditMethodModal(false);
            setEditingPayment(null);
          }}
        >
            {Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled) && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {tTerm('payouts.edit.locked')}
              </div>
            )}
            <div className="space-y-4">
              <FormField label={tTerm('payouts.edit.method')}>
                <OperationalSelect
                  id="edit-payment-method"
                  value={editedMethod}
                  onChange={(event) => setEditedMethod(event.target.value as PaymentMethod)}
                  disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </OperationalSelect>
              </FormField>
              <FormField label={tTerm('payouts.edit.reference')}>
                <AppInput
                  id="edit-payment-reference"
                  variant="text"
                  value={editedReference}
                  onValueChange={(v, _detail, e) => setEditedReference(v)}
                  placeholder={tTerm('payouts.edit.referencePlaceholder')}
                  disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                />
              </FormField>
            </div>
            <div className="flex gap-3 pt-4">
              <ActionButton
                type="button"
                onClick={() => {
                  setShowEditMethodModal(false);
                  setEditingPayment(null);
                }}
                variant="secondary"
                fullWidth
              >
                {tTerm('common.cta.cancel')}
              </ActionButton>
              <ActionButton
                type="button"
                onClick={handleSavePaymentMethod}
                disabled={Boolean(editingPayment?.reconciled || editingPayment?.isReconciled || editingPayment?.paymentMetadata?.reconciled)}
                variant="primary"
                fullWidth
              >
                {tTerm('payouts.edit.save')}
              </ActionButton>
            </div>
        </ModalShell>
      )}
    </PageShell>
  );
}
