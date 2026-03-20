import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import { LOAN_TERM_OPTIONS } from '@/features/loans/loansWorkspace.constants';
import { formatCurrency, formatDate } from '@/features/loans/loansWorkspace.utils';

function LoanApplicationSection({
  role,
  applicationForm,
  simulation,
  onChange,
  onSubmit,
  onSimulate,
  createLoanPending,
  simulateLoanPending,
}) {
  const { t } = useTranslation()

  if (role !== 'customer') {
    return null;
  }

  return (
    <section className="surface-card">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">{t('loans.application.eyebrow')}</div>
          <div className="section-title">{t('loans.application.title')}</div>
          <div className="section-subtitle">
            {t('loans.application.subtitle')}
          </div>
        </div>
      </div>
      <div className="surface-card__body">
        <form onSubmit={onSubmit} className="dashboard-form-grid">
          <label className="field-group">
            <span className="field-label">{t('loans.application.loanAmount')}</span>
            <input
              className="field-control"
              name="amount"
              value={applicationForm.amount}
              onChange={onChange}
              placeholder={t('loans.application.loanAmountPlaceholder')}
              required
            />
          </label>
          <label className="field-group">
            <span className="field-label">{t('loans.application.repaymentTerm')}</span>
            <select className="field-control" name="termMonths" value={applicationForm.termMonths} onChange={onChange} required>
              <option value="" disabled>{t('loans.application.selectTerm')}</option>
              {LOAN_TERM_OPTIONS.map((term) => (
                <option key={term} value={term}>{t('loans.application.months', { count: term })}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">{t('loans.application.estimatedRate')}</span>
            <input className="field-control" name="interestRate" value={applicationForm.interestRate} readOnly />
          </label>
          <div className="field-group">
            <span className="field-label">{t('loans.application.simulation')}</span>
            <Button
              type="button"
              variant="outline"
              onClick={onSimulate}
              disabled={!applicationForm.amount || !applicationForm.termMonths || !applicationForm.interestRate || simulateLoanPending}
            >
              {simulateLoanPending ? t('loans.application.generating') : t('loans.application.generateSimulation')}
            </Button>
          </div>
          <div className="field-group">
            <span className="field-label">{t('loans.application.submit')}</span>
            <Button variant="success" type="submit" disabled={createLoanPending}>
              {createLoanPending ? t('loans.application.submitting') : t('loans.application.apply')}
            </Button>
          </div>
        </form>

        {simulation && (
          <div className="surface-card surface-card--compact section-margin-top">
            <div className="surface-card__body">
              <div className="summary-grid section-margin-bottom">
                <div className="detail-card">
                  <div className="detail-card__label">{t('loans.application.monthlyInstallment')}</div>
                  <div className="detail-card__value detail-card__value--success">{formatCurrency(simulation.summary?.installmentAmount)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-card__label">{t('loans.application.totalPayable')}</div>
                  <div className="detail-card__value detail-card__value--warning">{formatCurrency(simulation.summary?.totalPayable)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-card__label">{t('loans.application.totalInterest')}</div>
                  <div className="detail-card__value">{formatCurrency(simulation.summary?.totalInterest)}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('loans.application.headers.installment')}</th>
                      <th>{t('loans.application.headers.dueDate')}</th>
                      <th className="table-cell-right">{t('loans.application.headers.principal')}</th>
                      <th className="table-cell-right">{t('loans.application.headers.interest')}</th>
                      <th className="table-cell-right">{t('loans.application.headers.total')}</th>
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
  );
}

export default LoanApplicationSection;
