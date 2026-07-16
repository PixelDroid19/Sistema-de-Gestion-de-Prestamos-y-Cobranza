import type { ReactNode } from 'react';
import { tTerm } from '../../i18n/terminology';
import { BACKEND_SUPPORTED_LOAN_STATUSES, getBackendLoanStatusLabel } from '../../constants/loanStates';
import { parsePositiveIntegerInput, parsePositiveMoneyInput } from '../../lib/moneyInput';
import { CAPITAL_STRATEGIES, type PaymentMethod, type CapitalStrategy } from '../../services/loanService';
import { ActionButton, AppInput, CurrencyInput, FormField, ModalShell, OperationalSelect } from '../shared/Surfaces';
import type { CapitalPreview } from './creditDetailsHelpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PaymentMethodOption = { value: string; label: string };

const toMoneyInputValue = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '';
};

type QuoteMetricTone = 'neutral' | 'danger' | 'accent';

const quoteMetricCardClassNames: Record<QuoteMetricTone, string> = {
  neutral: 'border-border-subtle bg-bg-elevated/75',
  danger: 'border-red-200 bg-red-50/80 dark:border-red-500/25 dark:bg-red-500/10',
  accent: 'border-brand-primary/25 bg-brand-primary/10',
};

const quoteMetricValueClassNames: Record<QuoteMetricTone, string> = {
  neutral: 'text-text-primary',
  danger: 'text-red-700 dark:text-red-200',
  accent: 'text-brand-primary',
};

function QuoteMetricCard({
  label,
  children,
  tone = 'neutral',
}: {
  label: ReactNode;
  children: ReactNode;
  tone?: QuoteMetricTone;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${quoteMetricCardClassNames[tone]}`}>
      <span className="block text-[11px] font-bold uppercase leading-4 tracking-[0.08em] text-text-secondary">
        {label}
      </span>
      <div className={`mt-1 text-sm font-bold leading-5 ${quoteMetricValueClassNames[tone]}`}>
        {children}
      </div>
    </div>
  );
}

export type CreditDetailsModalsProps = {
  formatCurrency: (v: unknown) => string;
  paymentMethodOptions: PaymentMethodOption[];

  // Status
  showStatusModal: boolean;
  newStatus: string;
  onNewStatusChange: (v: string) => void;
  onUpdateStatus: () => void;
  onCloseStatusModal: () => void;

  // Record payment
  isRecordPaymentModalOpen: boolean;
  selectedInstallmentNumber: number | null;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  installmentQuote: any;
  installmentQuoteFetching: boolean;
  installmentQuoteError: boolean;
  onPaymentAmountChange: (v: string) => void;
  onPaymentDateChange: (v: string) => void;
  onPaymentMethodChange: (v: PaymentMethod) => void;
  onRecordPayment: () => void;
  onClosePaymentModal: () => void;

  // Promise
  isPromiseModalOpen: boolean;
  promiseAmount: string;
  promiseDateInput: string;
  promiseNotes: string;
  onPromiseAmountChange: (v: string) => void;
  onPromiseDateChange: (v: string) => void;
  onPromiseNotesChange: (v: string) => void;
  onCreatePromise: () => void;
  onClosePromiseModal: () => void;

  // Follow-up
  isFollowUpModalOpen: boolean;
  followUpNotes: string;
  onFollowUpNotesChange: (v: string) => void;
  onCreateFollowUp: () => void;
  onCloseFollowUpModal: () => void;

  // Annul
  showAnnulModal: boolean;
  annulInstallmentNumber: number | null;
  annulReason: string;
  onAnnulReasonChange: (v: string) => void;
  onAnnulInstallment: () => void;
  onCloseAnnulModal: () => void;

  // Capital
  showCapitalModal: boolean;
  capitalAmount: string;
  capitalPaymentDate: string;
  capitalMethod: PaymentMethod;
  capitalStrategy: CapitalStrategy;
  capitalNewTermMonths: string;
  capitalPreview: CapitalPreview;
  isCapitalSubmitting: boolean;
  capitalPaymentGuard: { executable: boolean; reason?: string };
  capitalUnavailableDescription: string;
  onCapitalAmountChange: (v: string) => void;
  onCapitalDateChange: (v: string) => void;
  onCapitalMethodChange: (v: PaymentMethod) => void;
  onCapitalStrategyChange: (v: CapitalStrategy) => void;
  onCapitalNewTermMonthsChange: (v: string) => void;
  onRecordCapital: () => void;
  onCloseCapitalModal: () => void;

  // Edit payment method
  showEditPaymentMethodModal: boolean;
  editingPaymentReconciled: boolean;
  newPaymentMethod: PaymentMethod;
  onNewPaymentMethodChange: (v: PaymentMethod) => void;
  onUpdatePaymentMethod: () => void;
  onCloseEditPaymentMethodModal: () => void;

  // Late fee
  showLateFeeModal: boolean;
  lateFeeRate: string;
  onLateFeeRateChange: (v: string) => void;
  onUpdateLateFeeRate: () => void;
  onCloseLateFeeModal: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditDetailsModals(props: CreditDetailsModalsProps) {
  const capitalAmountExceedsPrincipal = props.capitalPreview.amount > props.capitalPreview.currentPrincipal
    && props.capitalPreview.currentPrincipal > 0;

  return (
    <>
      {/* Status */}
      {props.showStatusModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.status.title')}
          onClose={props.onCloseStatusModal}
          footer={<>
            <ActionButton onClick={props.onCloseStatusModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onUpdateStatus} disabled={!props.newStatus} variant="primary" fullWidth>{tTerm('creditDetails.modal.status.save')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.status.field')}>
            <OperationalSelect id="credit-status-select" value={props.newStatus} onChange={(e) => props.onNewStatusChange(e.target.value)}>
              <option value="">{tTerm('creditDetails.modal.status.placeholder')}</option>
              {BACKEND_SUPPORTED_LOAN_STATUSES.map((status) => (
                <option key={status} value={status}>{getBackendLoanStatusLabel(status)}</option>
              ))}
            </OperationalSelect>
          </FormField>
        </ModalShell>
      )}

      {/* Record payment */}
      {props.isRecordPaymentModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.payment.title')}
          maxWidthClassName="max-w-lg"
          onClose={props.onClosePaymentModal}
          footer={<>
            <ActionButton onClick={props.onClosePaymentModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton
              onClick={props.onRecordPayment}
              disabled={parsePositiveMoneyInput(props.paymentAmount) === null || Boolean(props.installmentQuote && !props.installmentQuote.canPay)}
              variant="primary" fullWidth
            >{tTerm('creditDetails.modal.payment.submit')}</ActionButton>
          </>}
        >
          <div className="space-y-5">
            {props.selectedInstallmentNumber && (
              <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-base/70 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-border-subtle bg-bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold text-text-primary">
                      {tTerm('creditDetails.paymentQuote.installmentQuoteTitle', { number: props.selectedInstallmentNumber })}
                    </p>
                    {!props.installmentQuote && !props.installmentQuoteError && (
                      <p className="mt-1 text-xs leading-5 text-text-secondary">
                        {tTerm('creditDetails.paymentQuote.ruleApplied')}
                      </p>
                    )}
                  </div>
                  {props.installmentQuoteFetching && (
                    <span className="shrink-0 rounded-full border border-border-subtle bg-bg-base px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                      {tTerm('creditDetails.paymentQuote.calculating')}
                    </span>
                  )}
                </div>
                {props.installmentQuote ? (
                  <div className="space-y-3 px-4 py-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <QuoteMetricCard label={tTerm('creditDetails.paymentQuote.outstandingBase')}>
                        {props.formatCurrency(props.installmentQuote.outstandingAmount)}
                      </QuoteMetricCard>
                      <QuoteMetricCard label={tTerm('creditDetails.label.lateFee')} tone={props.installmentQuote.lateFeeDue > 0 ? 'danger' : 'neutral'}>
                        {props.formatCurrency(props.installmentQuote.lateFeeDue)}
                      </QuoteMetricCard>
                      <QuoteMetricCard label={tTerm('creditDetails.paymentQuote.daysOverdue')}>
                        {props.installmentQuote.daysOverdue || 0}
                      </QuoteMetricCard>
                      <QuoteMetricCard label={tTerm('creditDetails.paymentQuote.suggestedTotal')} tone="accent">
                        <button
                          type="button"
                          aria-label={`${tTerm('creditDetails.paymentQuote.suggestedTotal')} ${props.formatCurrency(props.installmentQuote.totalDue)}`}
                          onClick={() => props.onPaymentAmountChange(toMoneyInputValue(props.installmentQuote.totalDue))}
                          className="rounded text-left font-extrabold leading-5 tracking-tight text-brand-primary underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                        >
                          {props.formatCurrency(props.installmentQuote.totalDue)}
                        </button>
                      </QuoteMetricCard>
                    </div>
                    {!props.installmentQuote.canPay && props.installmentQuote.disabledReason && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        {props.installmentQuote.disabledReason}
                      </div>
                    )}
                  </div>
                ) : props.installmentQuoteError ? (
                  <div className="px-4 py-3">
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                      {tTerm('creditDetails.paymentQuote.error')}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
            <FormField label={tTerm('creditDetails.modal.payment.amount')}>
              <CurrencyInput
                id="credit-payment-amount"
                allowCents
                value={props.paymentAmount}
                onValueChange={(value) => props.onPaymentAmountChange(value)}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={tTerm('creditDetails.modal.payment.date')}>
                <AppInput id="credit-payment-date" variant="date" value={props.paymentDate} onValueChange={(value) => props.onPaymentDateChange(value)} />
              </FormField>
              <FormField label={tTerm('creditDetails.modal.payment.method')}>
                <OperationalSelect id="credit-payment-method" value={props.paymentMethod} onChange={(e) => props.onPaymentMethodChange(e.target.value as PaymentMethod)}>
                  {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </OperationalSelect>
              </FormField>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Promise */}
      {props.isPromiseModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.promise.title')}
          onClose={props.onClosePromiseModal}
          footer={<>
            <ActionButton onClick={props.onClosePromiseModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onCreatePromise} variant="primary" fullWidth>{tTerm('creditDetails.modal.promise.save')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <FormField label={tTerm('creditDetails.modal.promise.amount')}>
              <CurrencyInput
                id="credit-promise-amount"
                allowCents
                value={props.promiseAmount}
                onValueChange={(value) => props.onPromiseAmountChange(value)}
              />
            </FormField>
            <FormField label={tTerm('creditDetails.modal.promise.date')}>
              <AppInput id="credit-promise-date" variant="date" value={props.promiseDateInput} onValueChange={(value) => props.onPromiseDateChange(value)} />
            </FormField>
            <FormField label={tTerm('creditDetails.modal.promise.notes')}>
              <textarea
                id="credit-promise-notes"
                className="operational-control-input w-full min-h-[80px] resize-y"
                value={props.promiseNotes}
                onChange={(e) => props.onPromiseNotesChange(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Follow-up */}
      {props.isFollowUpModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.followUp.title')}
          onClose={props.onCloseFollowUpModal}
          footer={<>
            <ActionButton onClick={props.onCloseFollowUpModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onCreateFollowUp} variant="primary" fullWidth>{tTerm('creditDetails.modal.followUp.save')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <FormField label={tTerm('creditDetails.modal.followUp.detail')}>
              <textarea
                id="credit-follow-up-notes"
                className="operational-control-input w-full min-h-[100px] resize-y"
                value={props.followUpNotes}
                onChange={(e) => props.onFollowUpNotesChange(e.target.value)}
                rows={4}
              />
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Annul */}
      {props.showAnnulModal && (
        <ModalShell
          title={<span className="text-red-600 dark:text-red-400">{tTerm('creditDetails.modal.annul.title', { number: props.annulInstallmentNumber ?? '' })}</span>}
          subtitle={tTerm('creditDetails.modal.annul.subtitle')}
          onClose={props.onCloseAnnulModal}
          footer={<>
            <ActionButton onClick={props.onCloseAnnulModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onAnnulInstallment} variant="danger" fullWidth>{tTerm('creditDetails.modal.annul.confirm')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.annul.reason')}>
            <textarea
              id="credit-annul-reason"
              className="operational-control-input w-full min-h-[80px] resize-y"
              value={props.annulReason}
              onChange={(e) => props.onAnnulReasonChange(e.target.value)}
              rows={3}
            />
          </FormField>
        </ModalShell>
      )}

      {/* Capital */}
      {props.showCapitalModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.capital.title')}
          subtitle={tTerm('creditDetails.modal.capital.subtitle')}
          maxWidthClassName="max-w-2xl"
          onClose={props.onCloseCapitalModal}
          footer={<>
            <ActionButton onClick={props.onCloseCapitalModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton
              onClick={props.onRecordCapital}
              disabled={
                !props.capitalPaymentGuard.executable
                || props.isCapitalSubmitting
                || parsePositiveMoneyInput(props.capitalAmount) === null
                || capitalAmountExceedsPrincipal
                || (props.capitalStrategy === 'reduce_payment' && parsePositiveIntegerInput(props.capitalNewTermMonths) === null)
              }
              title={capitalAmountExceedsPrincipal
                ? tTerm('creditDetails.modal.capital.amountExceedsPrincipal')
                : (props.capitalPaymentGuard.executable ? undefined : props.capitalPaymentGuard.reason)}
              variant="primary" fullWidth
            >{tTerm('creditDetails.modal.capital.submit')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={tTerm('creditDetails.modal.capital.amount')}>
                <CurrencyInput
                  id="credit-capital-amount"
                  allowCents
                  value={props.capitalAmount}
                  onValueChange={(value) => props.onCapitalAmountChange(value)}
                />
              </FormField>
              <FormField label={tTerm('creditDetails.modal.capital.date')}>
                <AppInput id="credit-capital-date" variant="date" value={props.capitalPaymentDate} onValueChange={(value) => props.onCapitalDateChange(value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={tTerm('creditDetails.modal.capital.method')}>
                <OperationalSelect id="credit-capital-method" value={props.capitalMethod} onChange={(e) => props.onCapitalMethodChange(e.target.value as PaymentMethod)}>
                  {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </OperationalSelect>
              </FormField>
              <FormField label={tTerm('creditDetails.modal.capital.strategy')}>
                <OperationalSelect id="credit-capital-strategy" value={props.capitalStrategy} onChange={(e) => props.onCapitalStrategyChange(e.target.value as CapitalStrategy)}>
                  {CAPITAL_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </OperationalSelect>
              </FormField>
            </div>
            {props.capitalStrategy === 'reduce_payment' && (
              <FormField
                label={tTerm('creditDetails.modal.capital.newTermMonths')}
                tooltip={tTerm('creditDetails.modal.capital.newTermMonthsTooltip')}
              >
                <AppInput
                  id="credit-capital-new-term"
                  variant="integer"
                  value={props.capitalNewTermMonths}
                  onValueChange={props.onCapitalNewTermMonthsChange}
                  placeholder={String(props.capitalPreview.remainingInstallments || 1)}
                  minValue={1}
                />
              </FormField>
            )}
            <div className="rounded-xl border border-border-subtle bg-bg-base/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">{tTerm('creditDetails.capitalPreview.title')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-text-secondary">{tTerm('creditDetails.capitalPreview.currentPrincipal')}</p>
                  <p className="mt-1 font-semibold text-text-primary">{props.formatCurrency(props.capitalPreview.currentPrincipal)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">{tTerm('creditDetails.capitalPreview.newPrincipal')}</p>
                  <p className="mt-1 font-semibold text-text-primary">{props.formatCurrency(props.capitalPreview.newPrincipal)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">
                    {props.capitalStrategy === 'reduce_payment'
                      ? tTerm('creditDetails.capitalPreview.estimatedPayment')
                      : tTerm('creditDetails.capitalPreview.remainingInstallments')}
                  </p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {props.capitalStrategy === 'reduce_payment'
                      ? props.formatCurrency(props.capitalPreview.estimatedPayment)
                      : `${props.capitalPreview.estimatedInstallments} de ${props.capitalPreview.remainingInstallments}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">{tTerm('creditDetails.capitalPreview.expectedEffect')}</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {props.capitalStrategy === 'reduce_payment'
                      ? tTerm('creditDetails.capitalPreview.effect.reducePayment')
                      : tTerm('creditDetails.capitalPreview.effect.reduceTerm')}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-text-secondary">{tTerm('creditDetails.capitalPreview.note')}</p>
              {!props.capitalPaymentGuard.executable && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                  {props.capitalPaymentGuard.reason || props.capitalUnavailableDescription}
                </p>
              )}
              {capitalAmountExceedsPrincipal && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                  {tTerm('creditDetails.modal.capital.amountExceedsPrincipal')}
                </p>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* Edit payment method */}
      {props.showEditPaymentMethodModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.editMethod.title')}
          onClose={props.onCloseEditPaymentMethodModal}
          footer={<>
            <ActionButton onClick={props.onCloseEditPaymentMethodModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onUpdatePaymentMethod} disabled={props.editingPaymentReconciled} variant="primary" fullWidth>{tTerm('creditDetails.modal.editMethod.save')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            {props.editingPaymentReconciled && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {tTerm('creditDetails.modal.editMethod.warning')}
              </div>
            )}
            <FormField label={tTerm('creditDetails.modal.editMethod.field')}>
              <OperationalSelect id="credit-payment-method-select" value={props.newPaymentMethod} onChange={(e) => props.onNewPaymentMethodChange(e.target.value as PaymentMethod)} disabled={props.editingPaymentReconciled}>
                {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </OperationalSelect>
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Late fee rate */}
      {props.showLateFeeModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.lateFee.title')}
          onClose={props.onCloseLateFeeModal}
          footer={<>
            <ActionButton onClick={props.onCloseLateFeeModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onUpdateLateFeeRate} variant="primary" fullWidth>{tTerm('creditDetails.modal.lateFee.save')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.lateFee.field')}>
            <AppInput
              id="credit-late-fee-rate"
              variant="percent"
              suffix="%"
              value={props.lateFeeRate}
              onValueChange={props.onLateFeeRateChange}
              placeholder="0.00"
              maxDecimals={2}
            />
          </FormField>
        </ModalShell>
      )}
    </>
  );
}
