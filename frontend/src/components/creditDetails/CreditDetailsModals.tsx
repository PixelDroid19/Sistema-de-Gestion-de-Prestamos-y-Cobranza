import { tTerm } from '../../i18n/terminology';
import { BACKEND_SUPPORTED_LOAN_STATUSES, LOAN_STATUS_LABELS } from '../../constants/loanStates';
import { CAPITAL_STRATEGIES, type PaymentMethod, type CapitalStrategy } from '../../services/loanService';
import { ActionButton, FormField, ModalShell, SelectInput, TextAreaInput, TextInput } from '../shared/Surfaces';
import type { CapitalPreview } from './creditDetailsHelpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PaymentMethodOption = { value: string; label: string };

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
  capitalPreview: CapitalPreview;
  capitalPaymentGuard: { executable: boolean; reason?: string };
  capitalUnavailableDescription: string;
  onCapitalAmountChange: (v: string) => void;
  onCapitalDateChange: (v: string) => void;
  onCapitalMethodChange: (v: PaymentMethod) => void;
  onCapitalStrategyChange: (v: CapitalStrategy) => void;
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
  return (
    <>
      {/* Status */}
      {props.showStatusModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.status.title')}
          footer={<>
            <ActionButton onClick={props.onCloseStatusModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onUpdateStatus} disabled={!props.newStatus} variant="primary" fullWidth>{tTerm('creditDetails.modal.status.save')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.status.field')}>
            <SelectInput id="credit-status-select" value={props.newStatus} onChange={(e) => props.onNewStatusChange(e.target.value)}>
              <option value="">{tTerm('creditDetails.modal.status.placeholder')}</option>
              {BACKEND_SUPPORTED_LOAN_STATUSES.map((status) => (
                <option key={status} value={status}>{LOAN_STATUS_LABELS[status]}</option>
              ))}
            </SelectInput>
          </FormField>
        </ModalShell>
      )}

      {/* Record payment */}
      {props.isRecordPaymentModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.payment.title')}
          footer={<>
            <ActionButton onClick={props.onClosePaymentModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton
              onClick={props.onRecordPayment}
              disabled={!props.paymentAmount || parseFloat(props.paymentAmount) <= 0 || Boolean(props.installmentQuote && !props.installmentQuote.canPay)}
              variant="primary" fullWidth
            >{tTerm('creditDetails.modal.payment.submit')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            {props.selectedInstallmentNumber && (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{tTerm('creditDetails.paymentQuote.installmentQuoteTitle', { number: props.selectedInstallmentNumber })}</span>
                  {props.installmentQuoteFetching && <span className="text-xs">{tTerm('creditDetails.paymentQuote.calculating')}</span>}
                </div>
                {props.installmentQuote ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-blue-700 dark:text-blue-300">{tTerm('creditDetails.paymentQuote.outstandingBase')}</span>
                      <span className="font-semibold text-text-primary">{props.formatCurrency(props.installmentQuote.outstandingAmount)}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 dark:text-blue-300">{tTerm('creditDetails.label.lateFee')}</span>
                      <span className="font-semibold text-red-700 dark:text-red-300">{props.formatCurrency(props.installmentQuote.lateFeeDue)}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 dark:text-blue-300">{tTerm('creditDetails.paymentQuote.daysOverdue')}</span>
                      <span className="font-semibold text-text-primary">{props.installmentQuote.daysOverdue || 0}</span>
                    </div>
                    <div>
                      <span className="block text-blue-700 dark:text-blue-300">{tTerm('creditDetails.paymentQuote.suggestedTotal')}</span>
                      <ActionButton
                        type="button"
                        onClick={() => props.onPaymentAmountChange(String(props.installmentQuote.totalDue ?? ''))}
                        variant="ghost"
                        className="!min-h-0 !border-0 !bg-transparent !p-0 !font-semibold !text-brand-primary hover:!bg-transparent"
                      >
                        {props.formatCurrency(props.installmentQuote.totalDue)}
                      </ActionButton>
                    </div>
                    {!props.installmentQuote.canPay && props.installmentQuote.disabledReason && (
                      <div className="col-span-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                        {props.installmentQuote.disabledReason}
                      </div>
                    )}
                  </div>
                ) : props.installmentQuoteError ? (
                  <p className="text-xs text-red-700 dark:text-red-300">No se pudo calcular la cotización. Revisa la cuota y la fecha.</p>
                ) : (
                  <p className="text-xs text-blue-700 dark:text-blue-300">{tTerm('creditDetails.paymentQuote.ruleApplied')}</p>
                )}
              </div>
            )}
            <FormField label={tTerm('creditDetails.modal.payment.amount')}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                <TextInput id="credit-payment-amount" type="number" value={props.paymentAmount} onChange={(e) => props.onPaymentAmountChange(e.target.value)} className="pl-8" placeholder="0.00" min="0" step="0.01" />
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={tTerm('creditDetails.modal.payment.date')}>
                <TextInput id="credit-payment-date" type="date" value={props.paymentDate} onChange={(e) => props.onPaymentDateChange(e.target.value)} />
              </FormField>
              <FormField label={tTerm('creditDetails.modal.payment.method')}>
                <SelectInput id="credit-payment-method" value={props.paymentMethod} onChange={(e) => props.onPaymentMethodChange(e.target.value as PaymentMethod)}>
                  {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </SelectInput>
              </FormField>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Promise */}
      {props.isPromiseModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.promise.title')}
          footer={<>
            <ActionButton onClick={props.onClosePromiseModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onCreatePromise} variant="primary" fullWidth>{tTerm('creditDetails.modal.promise.save')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <FormField label={tTerm('creditDetails.modal.promise.amount')}>
              <TextInput id="credit-promise-amount" type="number" value={props.promiseAmount} onChange={(e) => props.onPromiseAmountChange(e.target.value)} />
            </FormField>
            <FormField label={tTerm('creditDetails.modal.promise.date')}>
              <TextInput id="credit-promise-date" type="date" value={props.promiseDateInput} onChange={(e) => props.onPromiseDateChange(e.target.value)} />
            </FormField>
            <FormField label={tTerm('creditDetails.modal.promise.notes')}>
              <TextAreaInput id="credit-promise-notes" value={props.promiseNotes} onChange={(e) => props.onPromiseNotesChange(e.target.value)} rows={3} />
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Follow-up */}
      {props.isFollowUpModalOpen && (
        <ModalShell
          title={tTerm('creditDetails.modal.followUp.title')}
          footer={<>
            <ActionButton onClick={props.onCloseFollowUpModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onCreateFollowUp} variant="primary" fullWidth>{tTerm('creditDetails.modal.followUp.save')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <FormField label={tTerm('creditDetails.modal.followUp.detail')}>
              <TextAreaInput id="credit-follow-up-notes" value={props.followUpNotes} onChange={(e) => props.onFollowUpNotesChange(e.target.value)} rows={4} />
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Annul */}
      {props.showAnnulModal && (
        <ModalShell
          title={<span className="text-red-600 dark:text-red-400">{tTerm('creditDetails.modal.annul.title', { number: props.annulInstallmentNumber ?? '' })}</span>}
          subtitle={tTerm('creditDetails.modal.annul.subtitle')}
          footer={<>
            <ActionButton onClick={props.onCloseAnnulModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onAnnulInstallment} variant="danger" fullWidth>{tTerm('creditDetails.modal.annul.confirm')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.annul.reason')}>
            <TextAreaInput id="credit-annul-reason" value={props.annulReason} onChange={(e) => props.onAnnulReasonChange(e.target.value)} rows={3} />
          </FormField>
        </ModalShell>
      )}

      {/* Capital */}
      {props.showCapitalModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.capital.title')}
          subtitle={tTerm('creditDetails.modal.capital.subtitle')}
          maxWidthClassName="max-w-2xl"
          footer={<>
            <ActionButton onClick={props.onCloseCapitalModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton
              onClick={props.onRecordCapital}
              disabled={!props.capitalPaymentGuard.executable || !props.capitalAmount || parseFloat(props.capitalAmount) <= 0}
              title={props.capitalPaymentGuard.executable ? undefined : props.capitalPaymentGuard.reason}
              variant="primary" fullWidth
            >{tTerm('creditDetails.modal.capital.submit')}</ActionButton>
          </>}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={tTerm('creditDetails.modal.capital.amount')}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <TextInput id="credit-capital-amount" type="number" value={props.capitalAmount} onChange={(e) => props.onCapitalAmountChange(e.target.value)} className="pl-8" placeholder="0.00" min="0" step="0.01" />
                </div>
              </FormField>
              <FormField label={tTerm('creditDetails.modal.capital.date')}>
                <TextInput id="credit-capital-date" type="date" value={props.capitalPaymentDate} onChange={(e) => props.onCapitalDateChange(e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={tTerm('creditDetails.modal.capital.method')}>
                <SelectInput id="credit-capital-method" value={props.capitalMethod} onChange={(e) => props.onCapitalMethodChange(e.target.value as PaymentMethod)}>
                  {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </SelectInput>
              </FormField>
              <FormField label={tTerm('creditDetails.modal.capital.strategy')}>
                <SelectInput id="credit-capital-strategy" value={props.capitalStrategy} onChange={(e) => props.onCapitalStrategyChange(e.target.value as CapitalStrategy)}>
                  {CAPITAL_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </SelectInput>
              </FormField>
            </div>
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
            </div>
          </div>
        </ModalShell>
      )}

      {/* Edit payment method */}
      {props.showEditPaymentMethodModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.editMethod.title')}
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
              <SelectInput id="credit-payment-method-select" value={props.newPaymentMethod} onChange={(e) => props.onNewPaymentMethodChange(e.target.value as PaymentMethod)} disabled={props.editingPaymentReconciled}>
                {props.paymentMethodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </SelectInput>
            </FormField>
          </div>
        </ModalShell>
      )}

      {/* Late fee rate */}
      {props.showLateFeeModal && (
        <ModalShell
          title={tTerm('creditDetails.modal.lateFee.title')}
          footer={<>
            <ActionButton onClick={props.onCloseLateFeeModal} fullWidth>{tTerm('common.cta.cancel')}</ActionButton>
            <ActionButton onClick={props.onUpdateLateFeeRate} variant="primary" fullWidth>{tTerm('creditDetails.modal.lateFee.save')}</ActionButton>
          </>}
        >
          <FormField label={tTerm('creditDetails.modal.lateFee.field')}>
            <div className="relative">
              <TextInput id="credit-late-fee-rate" type="number" value={props.lateFeeRate} onChange={(e) => props.onLateFeeRateChange(e.target.value)} className="pr-8" placeholder="0.00" min="0" max="100" step="0.01" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
            </div>
          </FormField>
        </ModalShell>
      )}
    </>
  );
}
