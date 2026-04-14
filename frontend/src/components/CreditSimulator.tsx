import React, { useState } from 'react';
import { Calculator, DollarSign, Calendar, Percent, BarChart3, TrendingUp, ArrowRight, Download } from 'lucide-react';
import { useCalculateLoan } from '../services/creditSimulatorService';
import type { SimulatorPaymentMethod } from '../types/reportSimulation';
import { toast } from '../lib/toast';
import { tTerm } from '../i18n/terminology';

/**
 * CreditSimulator component provides an interactive loan calculation interface
 * where users can input principal, term, interest rate, and payment method
 * to see real-time calculation results and amortization schedules.
 */
export default function CreditSimulator() {
  const [principal, setPrincipal] = useState('');
  const [term, setTerm] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SimulatorPaymentMethod>('french');
  const { calculateLoan, result, isLoading } = useCalculateLoan();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const handleSimulate = async () => {
    const principalValue = parseFloat(principal);
    const termValue = parseInt(term);
    const rateValue = parseFloat(interestRate);

    if (!principalValue || principalValue <= 0) {
      toast.warning({ title: tTerm('simulator.toast.missing.amount' as any) });
      return;
    }

    if (!termValue || termValue <= 0) {
      toast.warning({ title: tTerm('simulator.toast.missing.term' as any) });
      return;
    }

    if (!rateValue || rateValue <= 0) {
      toast.warning({ title: tTerm('simulator.toast.missing.rate' as any) });
      return;
    }

    try {
      await calculateLoan.mutateAsync({
        principal: principalValue,
        term: termValue,
        interestRate: rateValue,
        paymentMethod,
      });
    } catch (error: any) {
      toast.apiErrorSafe(error, { domain: 'credits', action: 'credit.simulate' });
    }
  };

  const handleReset = () => {
    setPrincipal('');
    setTerm('');
    setInterestRate('');
    setPaymentMethod('french');
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-3">
            <Calculator size={28} className="text-brand-primary" />
            {tTerm('simulator.module.title' as any)}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            {tTerm('simulator.module.subtitle' as any)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input Form */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
              <BarChart3 size={20} className="text-blue-500" />
              {tTerm('simulator.form.title' as any)}
            </h3>

            <div className="flex flex-col gap-5">
              {/* Principal */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">{tTerm('simulator.form.amount' as any)}</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder={tTerm('simulator.form.amount.placeholder' as any)}
                  />
                </div>
              </div>

              {/* Term */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">{tTerm('simulator.form.term' as any)}</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="number"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder={tTerm('simulator.form.term.placeholder' as any)}
                  />
                </div>
              </div>

              {/* Interest Rate */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">{tTerm('simulator.form.rate' as any)}</label>
                <div className="relative">
                  <Percent size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder={tTerm('simulator.form.rate.placeholder' as any)}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary">{tTerm('simulator.form.method' as any)}</label>
                <div className="relative">
                  <ArrowRight size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as SimulatorPaymentMethod)}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="french">{tTerm('simulator.form.method.french' as any)}</option>
                    <option value="simple">{tTerm('simulator.form.method.simple' as any)}</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
                >
                  {tTerm('simulator.form.reset' as any)}
                </button>
                <button
                  onClick={handleSimulate}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Calculator size={16} />
                  )}
                  {tTerm('simulator.form.simulate' as any)}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="flex flex-col gap-6">
            {result ? (
              <>
                {/* Summary Cards */}
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                  <h3 className="text-lg font-medium mb-6 flex items-center gap-2 border-b border-border-subtle pb-4">
                    <TrendingUp size={20} className="text-emerald-500" />
                    {tTerm('simulator.summary.title' as any)}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">{tTerm('simulator.summary.monthlyPayment' as any)}</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(result.monthlyPayment)}
                      </p>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">{tTerm('simulator.summary.totalPayment' as any)}</p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(result.totalPayment)}
                      </p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">{tTerm('simulator.summary.totalInterest' as any)}</p>
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(result.totalInterest)}
                      </p>
                    </div>

                    <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4">
                      <p className="text-xs text-text-secondary mb-1">{tTerm('simulator.summary.principal' as any)}</p>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(result.principal)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border-subtle flex justify-between items-center">
                    <span className="text-sm text-text-secondary">{tTerm('simulator.summary.interestRate' as any)}</span>
                    <span className="font-semibold text-text-primary">{formatPercent(result.interestRate)}</span>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-sm text-text-secondary">{tTerm('simulator.summary.term' as any)}</span>
                    <span className="font-semibold text-text-primary">{result.term} meses</span>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-sm text-text-secondary">{tTerm('simulator.summary.method' as any)}</span>
                    <span className="font-semibold text-text-primary">
                      {result.paymentMethod === 'french' ? tTerm('simulator.summary.method.french' as any) : tTerm('simulator.summary.method.simple' as any)}
                    </span>
                  </div>
                </div>

                {/* Amortization Schedule */}
                <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <BarChart3 size={20} className="text-blue-500" />
                      {tTerm('simulator.schedule.title' as any)}
                    </h3>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg-surface border-b border-border-subtle">
                        <tr>
                          <th className="text-left py-2 px-2 text-xs font-medium text-text-secondary">{tTerm('simulator.schedule.header.period' as any)}</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-text-secondary">{tTerm('simulator.schedule.header.payment' as any)}</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-text-secondary">{tTerm('simulator.schedule.header.principal' as any)}</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-text-secondary">{tTerm('simulator.schedule.header.interest' as any)}</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-text-secondary">{tTerm('simulator.schedule.header.balance' as any)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.schedule.map((entry) => (
                          <tr key={entry.period} className="border-b border-border-subtle hover:bg-hover-bg">
                            <td className="py-2 px-2 font-medium text-text-primary">{entry.period}</td>
                            <td className="py-2 px-2 text-right text-text-primary">{formatCurrency(entry.payment)}</td>
                            <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(entry.principal)}
                            </td>
                            <td className="py-2 px-2 text-right text-amber-600 dark:text-amber-400">
                              {formatCurrency(entry.interest)}
                            </td>
                            <td className="py-2 px-2 text-right font-medium text-text-primary">
                              {formatCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-bg-surface border border-border-subtle rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <Calculator size={64} className="text-border-strong mb-4" strokeWidth={1} />
                <h3 className="text-xl font-semibold text-text-primary mb-2">{tTerm('simulator.empty.title' as any)}</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  {tTerm('simulator.empty.message' as any)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
