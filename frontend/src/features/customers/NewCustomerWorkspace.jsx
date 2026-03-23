import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Briefcase, CreditCard, Mail, MapPin, Phone, Save, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import FormSection from '@/components/ui/workspace/FormSection'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useCreateCustomerMutation } from '@/hooks/useCustomers'
import { handleApiError } from '@/lib/api/errors'
import { useUiStore } from '@/store/uiStore'
import { normalizePhoneNumber } from '@/utils/phone'

const initialForm = {
  name: '',
  email: '',
  phone: '',
  documentNumber: '',
  occupation: '',
  birthDate: '',
  department: '',
  city: '',
  status: 'active',
  address: '',
}

const DEPARTMENT_CITY_OPTIONS = {
  antioquia: ['Medellin', 'Envigado', 'Bello', 'Rionegro'],
  cundinamarca: ['Bogota', 'Soacha', 'Chia', 'Zipaquira'],
  valle_del_cauca: ['Cali', 'Palmira', 'Buenaventura', 'Tulua'],
  atlantico: ['Barranquilla', 'Soledad', 'Malambo', 'Puerto Colombia'],
}

const NEW_CUSTOMER_FORM_ID = 'new-customer-form'

function NewCustomerWorkspace() {
  const { t } = useTranslation()
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const createCustomerMutation = useCreateCustomerMutation()
  const [form, setForm] = useState(initialForm)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const redirectTimeoutRef = useRef(null)
  const selectedCities = DEPARTMENT_CITY_OPTIONS[form.department] || []
  const submitting = createCustomerMutation.isPending

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current)
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'department') {
      setForm((current) => ({ ...current, department: value, city: '' }))
      return
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event?.preventDefault()
    if (submitting) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: normalizePhoneNumber(form.phone),
        documentNumber: form.documentNumber || undefined,
        occupation: form.occupation || undefined,
        birthDate: form.birthDate || undefined,
        department: form.department || undefined,
        city: form.city || undefined,
        status: form.status || 'active',
        address: form.address || undefined,
      }

      await createCustomerMutation.mutateAsync(payload)
      setSuccess(t('customers.form.success'))
      setForm(initialForm)
      redirectTimeoutRef.current = window.setTimeout(() => setCurrentView('customers'), 700)
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
            <Button
              type="button"
              variant="outline"
              icon={ArrowLeft}
              onClick={() => setCurrentView('customers')}
              disabled={submitting}
            >
              {t('customers.actions.back')}
            </Button>
            <Button type="submit" form={NEW_CUSTOMER_FORM_ID} icon={Save} disabled={submitting}>
              {submitting ? t('customers.actions.saving') : t('customers.actions.save')}
            </Button>
          </div>
        )}
      />

      {success ? <div className="inline-message inline-message--success">✅ {success}</div> : null}
      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}

      <WorkspaceCard>
        <form id={NEW_CUSTOMER_FORM_ID} className="dashboard-form-grid lf-form-grid" onSubmit={handleSubmit} aria-busy={submitting}>
          <FormSection title={t('customers.form.sections.personal')}>
            <div className="dashboard-form-grid">
              <label className="field-group"><span className="field-label"><User size={14} /> {t('customers.form.fields.name')}</span><input className="field-control" name="name" value={form.name} onChange={handleChange} required disabled={submitting} /></label>
              <label className="field-group"><span className="field-label"><CreditCard size={14} /> {t('customers.form.fields.documentNumber')}</span><input className="field-control" name="documentNumber" value={form.documentNumber} onChange={handleChange} disabled={submitting} /></label>
              <label className="field-group"><span className="field-label">{t('customers.form.fields.birthDate')}</span><input type="date" className="field-control" name="birthDate" value={form.birthDate} onChange={handleChange} disabled={submitting} /></label>
              <label className="field-group"><span className="field-label"><Briefcase size={14} /> {t('customers.form.fields.occupation')}</span><input className="field-control" name="occupation" value={form.occupation} onChange={handleChange} disabled={submitting} /></label>
              <label className="field-group"><span className="field-label">{t('customers.form.fields.status')}</span><select className="field-control" name="status" value={form.status} onChange={handleChange} disabled={submitting}><option value="active">{t('common.status.active')}</option><option value="inactive">{t('common.status.inactive')}</option></select></label>
            </div>
          </FormSection>
          <FormSection title={t('customers.form.sections.contact')}>
            <div className="dashboard-form-grid">
              <label className="field-group"><span className="field-label"><Phone size={14} /> {t('customers.form.fields.phone')}</span><input className="field-control" name="phone" value={form.phone} onChange={handleChange} disabled={submitting} /></label>
              <label className="field-group"><span className="field-label"><Mail size={14} /> {t('customers.form.fields.email')}</span><input type="email" className="field-control" name="email" value={form.email} onChange={handleChange} required disabled={submitting} /></label>
              <label className="field-group"><span className="field-label">{t('customers.form.fields.department')}</span><select className="field-control" name="department" value={form.department} onChange={handleChange} disabled={submitting}><option value="">{t('customers.form.fields.selectDepartment')}</option>{Object.keys(DEPARTMENT_CITY_OPTIONS).map((department) => <option key={department} value={department}>{department.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</option>)}</select></label>
              <label className="field-group"><span className="field-label">{t('customers.form.fields.city')}</span><select className="field-control" name="city" value={form.city} onChange={handleChange} disabled={submitting || !form.department}><option value="">{t('customers.form.fields.selectCity')}</option>{selectedCities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label className="field-group" style={{ gridColumn: '1 / -1' }}><span className="field-label"><MapPin size={14} /> {t('customers.form.fields.address')}</span><textarea className="field-control" name="address" value={form.address} onChange={handleChange} rows={4} disabled={submitting} /></label>
            </div>
          </FormSection>
        </form>
      </WorkspaceCard>
    </div>
  )
}

export default NewCustomerWorkspace
