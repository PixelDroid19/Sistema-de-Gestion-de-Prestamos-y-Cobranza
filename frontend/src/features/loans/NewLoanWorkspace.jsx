import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Calculator, Calendar, DollarSign, Percent, Save, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import FormSection from '@/components/ui/workspace/FormSection'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useCustomersQuery } from '@/hooks/useCustomers'
import { useCreateLoanMutation, useSimulateLoanMutation } from '@/hooks/useLoans'
import { handleApiError } from '@/lib/api/errors'
import { customerService } from '@/services/customerService'
import { useSessionStore } from '@/store/sessionStore'
import { useUiStore } from '@/store/uiStore'

const initialForm = {
  customerId: '',
  customerDocumentNumber: '',
  amount: '',
  interestRate: '',
  termMonths: '',
  startDate: '',
  paymentFrequency: 'monthly',
  lateFeeRate: '2.0',
}

const PAYMENT_FREQUENCY_OPTIONS = [
  { value: 'monthly', labelKey: 'newLoan.fields.monthly' },
  { value: 'quarterly', labelKey: 'newLoan.fields.quarterly' },
  { value: 'semiannual', labelKey: 'newLoan.fields.semiannual' },
  { value: 'annual', labelKey: 'newLoan.fields.annual' },
]

const NEW_LOAN_FORM_ID = 'new-loan-form'

function NewLoanWorkspace() {
  const { t } = useTranslation()
  const user = useSessionStore((state) => state.user)
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const loanDraftCustomerId = useUiStore((state) => state.loanDraftCustomerId)
  const clearLoanDraftCustomerId = useUiStore((state) => state.clearLoanDraftCustomerId)
  const customersQuery = useCustomersQuery({ pagination: { page: 1, pageSize: 100 } })
  const createLoanMutation = useCreateLoanMutation(user)
  const simulateLoanMutation = useSimulateLoanMutation()
  const [form, setForm] = useState(initialForm)
  const [simulation, setSimulation] = useState(null)
  const [resolvedCustomer, setResolvedCustomer] = useState(null)
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const redirectTimeoutRef = useRef(null)

  const customers = useMemo(
    () => (Array.isArray(customersQuery.data?.items) ? customersQuery.data.items : []),
    [customersQuery.data?.items],
  )

  const canEditLoanFields = Boolean(form.customerId && resolvedCustomer)
  const isCreatingLoan = createLoanMutation.isPending
  const isSimulatingLoan = simulateLoanMutation.isPending
  const isBusy = searchingCustomer || isSimulatingLoan || isCreatingLoan

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current)
    }
  }, [])

  const summaryRows = useMemo(() => {
    const simulationSummary = simulation?.summary || simulation || null
    const installmentAmount = simulationSummary?.installmentAmount || simulationSummary?.monthlyInstallment || 0
    const totalPayable = simulationSummary?.totalPayable || 0
    const totalInterest = simulationSummary?.totalInterest || 0
    const firstInstallment = Array.isArray(simulation?.schedule) ? simulation.schedule[0] : null

    return [
      { label: t('newLoan.summary.principal'), value: form.amount || '0' },
      { label: t('newLoan.summary.installment'), value: installmentAmount ? Number(installmentAmount).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.firstInterest'), value: firstInstallment ? Number(firstInstallment.interestComponent || 0).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.firstPrincipal'), value: firstInstallment ? Number(firstInstallment.principalComponent || 0).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.totalInterest'), value: totalInterest ? Number(totalInterest).toFixed(2) : '0.00' },
      { label: t('newLoan.summary.totalPayable'), value: totalPayable ? Number(totalPayable).toFixed(2) : '0.00' },
    ]
  }, [form.amount, simulation, t])

  useEffect(() => {
    if (!loanDraftCustomerId) {
      return
    }
    const preselectedCustomer = customers.find((entry) => Number(entry.id) === Number(loanDraftCustomerId))
    if (preselectedCustomer) {
      setResolvedCustomer(preselectedCustomer)
      setForm((current) => ({
        ...current,
        customerId: String(preselectedCustomer.id),
        customerDocumentNumber: preselectedCustomer.documentNumber || '',
      }))
      clearLoanDraftCustomerId()
    }
  }, [clearLoanDraftCustomerId, customers, loanDraftCustomerId])

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'customerDocumentNumber') {
      setResolvedCustomer(null)
      setForm((current) => ({ ...current, customerDocumentNumber: value, customerId: '' }))
      setSimulation(null)
      return
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleLookupCustomerByDocument = async () => {
    if (isBusy) {
      return
    }

    setError('')
    setSuccess('')
    setResolvedCustomer(null)

    const documentNumber = String(form.customerDocumentNumber || '').trim()
    if (!documentNumber) {
      setError(t('newLoan.messages.documentRequired'))
      return
    }

    setSearchingCustomer(true)
    try {
      const response = await customerService.findByDocumentNumber(documentNumber)
      const customer = response?.data?.customer || response?.data || null
      if (!customer?.id) {
        setError(t('newLoan.messages.customerNotFound'))
        return
      }
      setResolvedCustomer(customer)
      setForm((current) => ({ ...current, customerId: String(customer.id) }))
      setSuccess(t('newLoan.messages.customerFound'))
    } catch (lookupError) {
      handleApiError(lookupError, setError)
    } finally {
      setSearchingCustomer(false)
    }
  }

  const handleSimulate = async () => {
    if (isBusy) {
      return
    }

    setError('')
    setSuccess('')
    try {
      if (!canEditLoanFields) {
        setError(t('newLoan.messages.customerRequired'))
        return
      }
      const response = await simulateLoanMutation.mutateAsync({
        amount: Number(form.amount),
        interestRate: Number(form.interestRate),
        termMonths: Number(form.termMonths),
        startDate: form.startDate || undefined,
      })
      setSimulation(response?.data?.simulation || response?.data || null)
    } catch (mutationError) {
      handleApiError(mutationError, setError)
    }
  }

  const handleSubmit = async (event) => {
    event?.preventDefault()
    if (isBusy) {
      return
    }

    setError('')
    setSuccess('')

    try {
      if (!canEditLoanFields) {
        setError(t('newLoan.messages.customerRequired'))
        return
      }
      await createLoanMutation.mutateAsync({
        customerId: Number(form.customerId),
        amount: Number(form.amount),
        interestRate: Number(form.interestRate),
        termMonths: Number(form.termMonths),
        paymentFrequency: form.paymentFrequency,
        startDate: form.startDate || undefined,
        lateFeeRate: Number(form.lateFeeRate || 0),
      })
      setSuccess(t('newLoan.messages.created'))
      redirectTimeoutRef.current = window.setTimeout(() => setCurrentView('credits'), 700)
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
            <Button type="button" variant="outline" icon={ArrowLeft} onClick={() => setCurrentView('credits')} disabled={isBusy}>
              {t('newLoan.actions.back')}
            </Button>
            <Button type="button" variant="outline" icon={Calculator} onClick={handleSimulate} disabled={isBusy || !canEditLoanFields}>
              {isSimulatingLoan ? t('newLoan.actions.simulating') : t('newLoan.actions.simulate')}
            </Button>
            <Button type="submit" form={NEW_LOAN_FORM_ID} icon={Save} disabled={isBusy || !canEditLoanFields}>
              {isCreatingLoan ? t('newLoan.actions.saving') : t('newLoan.actions.save')}
            </Button>
          </div>
        )}
      />

      {success ? <div className="inline-message inline-message--success">✅ {success}</div> : null}
      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}

      <div className="lf-two-column">
        <WorkspaceCard>
          <form id={NEW_LOAN_FORM_ID} className="dashboard-form-grid lf-form-grid" onSubmit={handleSubmit} aria-busy={isBusy}>
            <FormSection title={t('newLoan.sections.borrower')}>
              <label className="field-group">
                <span className="field-label"><User size={14} /> {t('newLoan.fields.customerDocumentNumber')}</span>
                <div className="inline-action-group">
                  <input
                    className="field-control"
                    name="customerDocumentNumber"
                    value={form.customerDocumentNumber}
                    onChange={handleChange}
                    placeholder={t('newLoan.fields.customerDocumentPlaceholder')}
                    required
                    disabled={isBusy}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupCustomerByDocument}
                    disabled={isBusy}
                  >
                    {searchingCustomer ? t('newLoan.actions.searchingCustomer') : t('newLoan.actions.searchCustomer')}
                  </Button>
                </div>
              </label>
              <label className="field-group">
                <span className="field-label"><User size={14} /> {t('newLoan.fields.customer')}</span>
                <select className="field-control" name="customerId" value={form.customerId} onChange={handleChange} required disabled>
                  <option value="">{t('newLoan.fields.selectCustomer')}</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </label>
            </FormSection>
            <FormSection title={t('newLoan.sections.details')}>
              <div className="dashboard-form-grid">
                <label className="field-group"><span className="field-label"><DollarSign size={14} /> {t('newLoan.fields.amount')}</span><input className="field-control" name="amount" type="number" value={form.amount} onChange={handleChange} required disabled={isBusy || !canEditLoanFields} /></label>
                <label className="field-group"><span className="field-label"><Percent size={14} /> {t('newLoan.fields.interestRate')}</span><input className="field-control" name="interestRate" type="number" value={form.interestRate} onChange={handleChange} required disabled={isBusy || !canEditLoanFields} /></label>
                <label className="field-group"><span className="field-label"><Calendar size={14} /> {t('newLoan.fields.termMonths')}</span><input className="field-control" name="termMonths" type="number" value={form.termMonths} onChange={handleChange} required disabled={isBusy || !canEditLoanFields} /></label>
                <label className="field-group"><span className="field-label"><Calendar size={14} /> {t('newLoan.fields.startDate')}</span><input className="field-control" name="startDate" type="date" value={form.startDate} onChange={handleChange} disabled={isBusy || !canEditLoanFields} /></label>
                <label className="field-group"><span className="field-label"><Calendar size={14} /> {t('newLoan.fields.frequency')}</span><select className="field-control" name="paymentFrequency" value={form.paymentFrequency} onChange={handleChange} disabled={isBusy || !canEditLoanFields}>{PAYMENT_FREQUENCY_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{t(entry.labelKey)}</option>)}</select></label>
                <label className="field-group"><span className="field-label"><Percent size={14} /> {t('newLoan.fields.lateFeeRate')}</span><input className="field-control" name="lateFeeRate" type="number" step="0.01" value={form.lateFeeRate} onChange={handleChange} disabled={isBusy || !canEditLoanFields} /></label>
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
