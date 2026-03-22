import React, { useState } from 'react'
import { ArrowLeft, Briefcase, CreditCard, Mail, MapPin, Phone, Save, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import FormSection from '@/components/ui/workspace/FormSection'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useCreateCustomerMutation } from '@/hooks/useCustomers'
import { handleApiError } from '@/lib/api/errors'
import { useUiStore } from '@/store/uiStore'

const initialForm = {
  name: '',
  email: '',
  phone: '',
  documentNumber: '',
  occupation: '',
  birthDate: '',
  address: '',
}

function NewCustomerWorkspace() {
  const { t } = useTranslation()
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const createCustomerMutation = useCreateCustomerMutation()
  const [form, setForm] = useState(initialForm)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      await createCustomerMutation.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        documentNumber: form.documentNumber || undefined,
        occupation: form.occupation || undefined,
        birthDate: form.birthDate || undefined,
        address: form.address || undefined,
      })

      setSuccess(t('customers.form.success'))
      setForm(initialForm)
      window.setTimeout(() => setCurrentView('customers'), 700)
    } catch (mutationError) {
      handleApiError(mutationError, setError)
    }
  }

  return (
    <div className="dashboard-page-stack lf-workspace lf-workspace--form">
      <Toolbar
        title={t('customers.form.title')}
        subtitle={t('customers.form.subtitle')}
        actions={(
          <div className="action-stack">
            <Button variant="outline" icon={ArrowLeft} onClick={() => setCurrentView('customers')}>
              {t('customers.actions.back')}
            </Button>
            <Button icon={Save} onClick={handleSubmit} disabled={createCustomerMutation.isPending}>
              {createCustomerMutation.isPending ? t('customers.actions.saving') : t('customers.actions.save')}
            </Button>
          </div>
        )}
      />

      {success ? <div className="inline-message inline-message--success">✅ {success}</div> : null}
      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}

      <WorkspaceCard>
        <form className="dashboard-form-grid lf-form-grid" onSubmit={handleSubmit}>
          <FormSection title={t('customers.form.sections.personal')}>
            <div className="dashboard-form-grid">
              <label className="field-group"><span className="field-label"><User size={14} /> {t('customers.form.fields.name')}</span><input className="field-control" name="name" value={form.name} onChange={handleChange} required /></label>
              <label className="field-group"><span className="field-label"><CreditCard size={14} /> {t('customers.form.fields.documentNumber')}</span><input className="field-control" name="documentNumber" value={form.documentNumber} onChange={handleChange} /></label>
              <label className="field-group"><span className="field-label">{t('customers.form.fields.birthDate')}</span><input type="date" className="field-control" name="birthDate" value={form.birthDate} onChange={handleChange} /></label>
              <label className="field-group"><span className="field-label"><Briefcase size={14} /> {t('customers.form.fields.occupation')}</span><input className="field-control" name="occupation" value={form.occupation} onChange={handleChange} /></label>
            </div>
          </FormSection>
          <FormSection title={t('customers.form.sections.contact')}>
            <div className="dashboard-form-grid">
              <label className="field-group"><span className="field-label"><Phone size={14} /> {t('customers.form.fields.phone')}</span><input className="field-control" name="phone" value={form.phone} onChange={handleChange} /></label>
              <label className="field-group"><span className="field-label"><Mail size={14} /> {t('customers.form.fields.email')}</span><input type="email" className="field-control" name="email" value={form.email} onChange={handleChange} required /></label>
              <label className="field-group" style={{ gridColumn: '1 / -1' }}><span className="field-label"><MapPin size={14} /> {t('customers.form.fields.address')}</span><textarea className="field-control" name="address" value={form.address} onChange={handleChange} rows={4} /></label>
            </div>
          </FormSection>
        </form>
      </WorkspaceCard>
    </div>
  )
}

export default NewCustomerWorkspace
