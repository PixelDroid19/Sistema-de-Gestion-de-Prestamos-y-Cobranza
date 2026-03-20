import React from 'react';
import { useTranslation } from 'react-i18next';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatePanel from '@/components/ui/StatePanel';

function EligibilityPanel({ action, eligibilityState, quoteTotal, payoffDate, onPayoffDateChange, payoffLoading, getConfig }) {
  const { t } = useTranslation()
  if (!eligibilityState) {
    return null;
  }

  const config = getConfig(action);
  const isBlocked = eligibilityState.status === 'blocked';
  const isLoading = eligibilityState.status === 'loading';
  const isPayoff = action === 'payoff';

  return (
    <div className={`eligibility-panel eligibility-panel--${isBlocked ? 'blocked' : isLoading ? 'loading' : 'ready'}`}>
      <div className="eligibility-panel__header">
        <div>
          <div className="eligibility-panel__eyebrow">{config.actionLabel}</div>
          <div className="eligibility-panel__title">{isBlocked ? config.blockedTitle : isLoading ? t('payments.form.eligibility.loadingTitle') : config.readyTitle}</div>
          <div className="eligibility-panel__text">
            {isBlocked
              ? eligibilityState.source === 'backend'
                ? t('payments.form.eligibility.backendBlocked')
                : t('payments.form.eligibility.clientBlocked')
              : isLoading
                ? t('payments.form.eligibility.loadingHelper')
                : config.helperText}
          </div>
        </div>
        <Badge variant={isBlocked ? 'danger' : isLoading ? 'warning' : 'success'}>
          {isBlocked ? t('payments.form.eligibility.blocked') : isLoading ? t('payments.form.eligibility.validating') : t('payments.form.eligibility.available')}
        </Badge>
      </div>

      {isBlocked && (
        <ul className="eligibility-panel__list">
          {eligibilityState.reasons.map((reason) => (
            <li key={reason.key}>
              <strong>{reason.title}:</strong> {reason.message}
              {reason.metadata ? ` (${reason.metadata})` : ''}
            </li>
          ))}
        </ul>
      )}

      {!isBlocked && isPayoff && (
        <div className="eligibility-panel__grid">
          <label className="field-group">
            <span className="field-label">{t('payments.form.eligibility.payoffDate')}</span>
            <input
              id="payoff-date"
              className="field-control"
              type="date"
              value={payoffDate}
              onChange={(event) => onPayoffDateChange(event.target.value)}
            />
          </label>
          <div className="detail-card">
            <div className="detail-card__label">{t('payments.form.eligibility.quotedTotal')}</div>
            <div className="detail-card__value detail-card__value--warning">
              {payoffLoading ? t('payments.form.eligibility.calculating') : `₹${quoteTotal.toFixed(2)}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentsFormSection(props) {
  const { t } = useTranslation()
  const {
    error,
    formState,
    payableLoans,
    allowedPaymentTypes,
    canManagePayments,
    isAdmin,
    isCustomer,
    loanDetails,
    selectedLoan,
    submitting,
    capitalEligibilityState,
    payoffEligibilityState,
    payoffQuoteTotal,
    payoffLoading,
    resolvedAlertMessage,
    success,
    capitalButtonDisabled,
    payoffButtonDisabled,
    onFormChange,
    onPaymentTypeChange,
    onSubmit,
    onPartialPayment,
    onCapitalPayment,
    onPayoff,
    onPayoffDateChange,
    buildEligibilityButtonTitle,
    getEligibilityPanelCopy,
  } = props;

  return (
    <section className="surface-card">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">{t('payments.form.eyebrow')}</div>
          <div className="section-title">{t('payments.form.title')}</div>
          <div className="section-subtitle">
            {t('payments.form.subtitle')}
          </div>
        </div>
      </div>
      <div className="surface-card__body">
        {error && !formState.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}

        {payableLoans.length === 0 ? (
          <StatePanel
            icon="📭"
            title={t('payments.form.noPayableTitle')}
            message={t('payments.form.noPayableMessage')}
          />
        ) : (
          <>
            <form onSubmit={onSubmit} className="dashboard-form-grid">
              <label className="field-group loan-select-wrap">
                <span className="field-label">{t('payments.form.loan')}</span>
                <select className="field-control" name="loanId" value={formState.loanId} onChange={onFormChange} required>
                  <option value="" disabled>{t('payments.form.selectLoan')}</option>
                  {payableLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>{`${t('payments.form.loan')} #${loan.id} — ₹${loan.amount} (${loan.status})`}</option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span className="field-label">{t('payments.form.paymentType')}</span>
                <select
                  className="field-control"
                  value={formState.paymentType}
                  onChange={(event) => onPaymentTypeChange(event.target.value)}
                  disabled={!canManagePayments}
                >
                  {allowedPaymentTypes.includes('installment') && <option value="installment">{t('payments.form.types.installment')}</option>}
                  {allowedPaymentTypes.includes('partial') && <option value="partial">{t('payments.form.types.partial')}</option>}
                  {allowedPaymentTypes.includes('capital') && <option value="capital">{t('payments.form.types.capital')}</option>}
                  {allowedPaymentTypes.includes('payoff') && <option value="payoff">{t('payments.form.types.payoff')}</option>}
                </select>
              </label>

              <label className="field-group">
                <span className="field-label">{t('payments.form.paymentAmount')}</span>
                <input
                  id="payment-amount"
                  className="field-control"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder={formState.paymentType === 'partial' ? t('payments.form.placeholders.freeAmount') : formState.paymentType === 'payoff' ? t('payments.form.placeholders.autoCalculated') : t('payments.form.placeholders.defaultAmount')}
                  value={formState.amount}
                  onChange={onFormChange}
                  required={formState.paymentType !== 'payoff'}
                  disabled={!canManagePayments || formState.paymentType === 'payoff' || (formState.loanId && loanDetails.balance === '0.00')}
                />
              </label>

              <div className="field-group">
                <span className="field-label">{t('payments.form.submit')}</span>
                {formState.paymentType === 'installment' && (
                  <Button variant="success" type="submit" disabled={(formState.loanId && loanDetails.balance === '0.00') || submitting || !isCustomer}>
                    {submitting ? t('payments.form.buttons.processing') : t('payments.form.buttons.payInstallment')}
                  </Button>
                )}
                {formState.paymentType === 'partial' && (
                  <Button variant="primary" type="button" onClick={onPartialPayment} disabled={!formState.loanId || submitting || !canManagePayments}>
                    {submitting ? t('payments.form.buttons.processing') : t('payments.form.buttons.partial')}
                  </Button>
                )}
                {formState.paymentType === 'capital' && isAdmin && (
                  <Button
                    variant="warning"
                    type="button"
                    onClick={onCapitalPayment}
                    disabled={capitalButtonDisabled}
                    title={buildEligibilityButtonTitle(capitalEligibilityState)}
                  >
                    {submitting ? t('payments.form.buttons.processing') : t('payments.form.buttons.capital')}
                  </Button>
                )}
                {formState.paymentType === 'payoff' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onPayoff}
                    disabled={payoffButtonDisabled}
                    title={buildEligibilityButtonTitle(payoffEligibilityState)}
                  >
                    {submitting ? t('payments.form.buttons.processing') : t('payments.form.buttons.payoff')}
                  </Button>
                )}
              </div>
            </form>

            {formState.loanId && (
              <div className="summary-grid section-margin-top">
                <div className="detail-card"><div className="detail-card__label">{t('payments.form.selectedLoan')}</div><div className="detail-card__value">{`${t('payments.form.loan')} #${selectedLoan?.id || '—'}`}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('payments.form.emiAmount')}</div><div className="detail-card__value detail-card__value--success">₹{loanDetails.emi}</div></div>
                <div className="detail-card"><div className="detail-card__label">{t('payments.form.remainingBalance')}</div><div className="detail-card__value detail-card__value--warning">₹{loanDetails.balance}</div></div>
              </div>
            )}

            {formState.loanId && formState.paymentType === 'capital' && isAdmin && (
              <EligibilityPanel action="capital" eligibilityState={capitalEligibilityState} getConfig={getEligibilityPanelCopy} />
            )}

            {isCustomer && formState.loanId && formState.paymentType === 'payoff' && payoffEligibilityState && (
              <div className="surface-card surface-card--compact section-margin-top">
                <div className="surface-card__body">
                  <EligibilityPanel
                    action="payoff"
                    eligibilityState={payoffEligibilityState}
                    quoteTotal={payoffQuoteTotal}
                    payoffDate={formState.payoffDate}
                    onPayoffDateChange={onPayoffDateChange}
                    payoffLoading={payoffLoading}
                    getConfig={getEligibilityPanelCopy}
                  />
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="inline-message inline-message--success">ℹ️ {t('payments.form.adminInfo')}</div>
            )}
            {!isAdmin && !isCustomer && (
              <div className="inline-message inline-message--error">ℹ️ {t('payments.form.readonlyInfo')}</div>
            )}
            {formState.loanId && loanDetails.balance === '0.00' && <div className="inline-message inline-message--success">✅ {t('payments.form.fullyPaid')}</div>}
            {resolvedAlertMessage && <div className="inline-message inline-message--success">✅ {resolvedAlertMessage}</div>}
            {error && formState.loanId && <div className="inline-message inline-message--error">⚠️ {error}</div>}
            {success && <div className="inline-message inline-message--success">✅ {success}</div>}
          </>
        )}
      </div>
    </section>
  );
}

export default PaymentsFormSection;
