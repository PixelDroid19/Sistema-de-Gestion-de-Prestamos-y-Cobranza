import React, { useMemo, useState } from 'react'
import { ArrowLeft, Calculator, Calendar, DollarSign, Percent, Save, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import FormSection from '@/components/ui/workspace/FormSection'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useCustomersQuery } from '@/hooks/useCustomers'
import { useCreateLoanMutation, useSimulateLoanMutation } from '@/hooks/useLoans'
import { handleApiError } from '@/lib/api/errors'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

const initialForm = {
  customerId: '',
  amount: '',
  interestRate: '',
  termMonths: '',
  paymentFrequency: 'monthly',
}

function NewLoanWorkspace() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const customersQuery = useCustomersQuery({ pagination: { page: 1, pageSize: 100 } })
  const createLoanMutation = useCreateLoanMutation(user)
  const simulateLoanMutation = useSimulateLoanMutation()
  const [form, setForm] = useState(initialForm)
  const [simulation, setSimulation] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const customers = Array.isArray(customersQuery.data?.items) ? customersQuery.data.items : []

  const summaryRows = useMemo(() => {
    const installmentAmount = simulation?.installmentAmount || simulation?.monthlyInstallment || 0
    const totalPayable = simulation?.totalPayable || 0
    const totalInterest = simulation?.totalInterest || 0

    return [
      { label: t('newLoan.summary.principal'), value: form.amount || '0' },
      { label: t('newLoan.summary.installment'), value: installmentAmount ? Number(installmentAmount).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.totalInterest'), value: totalInterest ? Number(totalInterest).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.totalPayable'), value: totalPayable ? Number(totalPayable).toFixed(2) : '0.00' },
    ]
  }, [form.amount, simulation, t])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSimulate = async () => {
    setError('')
    setSuccess('')
    try {
      const response = await simulateLoanMutation.mutateAsync({
        amount: Number(form.amount),
        interestRate: Number(form.interestRate),
        termMonths: Number(form.termMonths),
      })
      setSimulation(response?.data?.simulation || response?.data || null)
    } catch (mutationError) {
      handleApiError(mutationError, setError)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      await createLoanMutation.mutateAsync({
        customerId: Number(form.customerId),
        amount: Number(form.amount),
        interestRate: Number(form.interestRate),
        termMonths: Number(form.termMonths),
      })
      setSuccess(t('newLoan.messages.created'))
      window.setTimeout(() => setCurrentView('loans'), 700)
    } catch (mutationError) {
      handleApiError(mutationError, setError)
    }
  }

  return (
    <div className="dashboard-page-stack lf-workspace lf-workspace--form">
      <Toolbar
        title={t('newLoan.title')}
        subtitle={t('newLoan.subtitle')}
        actions={(
          <div className="action-stack">
            <Button variant="outline" icon={ArrowLeft} onClick={() => setCurrentView('loans')}>
              {t('newLoan.actions.back')}
            </Button>
            <Button variant="outline" icon={Calculator} onClick={handleSimulate} disabled={simulateLoanMutation.isPending}>
              {simulateLoanMutation.isPending ? t('newLoan.actions.simulating') : t('newLoan.actions.simulate')}
            </Button>
            <Button icon={Save} onClick={handleSubmit} disabled={createLoanMutation.isPending}>
              {createLoanMutation.isPending ? t('newLoan.actions.saving') : t('newLoan.actions.save')}
            </Button>
          </div>
        )}
      />

      {success ? <div className="inline-message inline-message--success">✅ {success}</div> : null}
      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}

      <div className="lf-two-column">
        <WorkspaceCard>
          <form className="dashboard-form-grid lf-form-grid" onSubmit={handleSubmit}>
            <FormSection title={t('newLoan.sections.borrower')}>
              <label className="field-group">
                <span className="field-label"><User size={14} /> {t('newLoan.fields.customer')}</span>
                <select className="field-control" name="customerId" value={form.customerId} onChange={handleChange} required>
                  <option value="">{t('newLoan.fields.selectCustomer')}</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </label>
            </FormSection>
            <FormSection title={t('newLoan.sections.details')}>
              <div className="dashboard-form-grid">
                <label className="field-group"><span className="field-label"><DollarSign size={14} /> {t('newLoan.fields.amount')}</span><input className="field-control" name="amount" type="number" value={form.amount} onChange={handleChange} required /></label>
                <label className="field-group"><span className="field-label"><Percent size={14} /> {t('newLoan.fields.interestRate')}</span><input className="field-control" name="interestRate" type="number" value={form.interestRate} onChange={handleChange} required /></label>
                <label className="field-group"><span className="field-label"><Calendar size={14} /> {t('newLoan.fields.termMonths')}</span><input className="field-control" name="termMonths" type="number" value={form.termMonths} onChange={handleChange} required /></label>
                <label className="field-group"><span className="field-label"><Calendar size={14} /> {t('newLoan.fields.frequency')}</span><select className="field-control" name="paymentFrequency" value={form.paymentFrequency} onChange={handleChange}><option value="monthly">{t('newLoan.fields.monthly')}</option><option value="biweekly">{t('newLoan.fields.biweekly')}</option><option value="weekly">{t('newLoan.fields.weekly')}</option></select></label>
              </div>
            </FormSection>
          </form>
        </WorkspaceCard>

        <WorkspaceCard eyebrow={t('newLoan.summary.eyebrow')} title={t('newLoan.summary.title')} subtitle={t('newLoan.summary.subtitle')} compact>
          <div className="lf-summary-stack">
            {summaryRows.map((row) => (
              <div className="detail-card" key={row.label}>
                <span className="detail-card__label">{row.label}</span>
                <strong className="detail-card__value">{row.value}</strong>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      </div>
    </div>
  )
}

export default NewLoanWorkspace
