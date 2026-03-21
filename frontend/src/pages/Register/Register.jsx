import React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import { useLoginMutation, useRegisterMutation } from '@/hooks/useAuth'
import { handleApiError } from '@/lib/api/errors'

import './Register.scss'

const EMPTY_FORM = { name: '', email: '', password: '', role: 'customer', phone: '' }

function Register({ onLogin, onSwitchToLogin }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const registerMutation = useRegisterMutation()
  const loginMutation = useLoginMutation()
  const loading = registerMutation.isPending || loginMutation.isPending

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const payload = { ...form }
      delete payload.phone

      await registerMutation.mutateAsync(payload)
      await loginMutation.mutateAsync({ email: form.email, password: form.password })
      setSuccess(t('auth.register.success'))
      setForm(EMPTY_FORM)
      onLogin?.()
    } catch (mutationError) {
      handleApiError(mutationError, setError)
    }
  }

  return (
    <form className="register-form" onSubmit={handleSubmit}>
      <div className="register-form__header">
        <h3>{t('auth.register.title')}</h3>
        <p>{t('auth.register.description')}</p>
      </div>

      {error ? <div className="inline-message inline-message--error">{error}</div> : null}
      {success ? <div className="inline-message inline-message--success">{success}</div> : null}

      <label className="field-group">
        <span className="field-label">{t('auth.register.name')}</span>
        <input className="field-control" name="name" value={form.name} onChange={handleChange} required />
      </label>

      <label className="field-group">
        <span className="field-label">{t('auth.register.email')}</span>
        <input className="field-control" type="email" name="email" value={form.email} onChange={handleChange} required />
      </label>

      <label className="field-group">
        <span className="field-label">{t('auth.register.password')}</span>
        <input className="field-control" type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} />
      </label>

      <label className="field-group">
        <span className="field-label">{t('auth.register.role')}</span>
        <select className="field-control" name="role" value={form.role} onChange={handleChange}>
          <option value="customer">{t('auth.register.customer')}</option>
        </select>
      </label>

      <Button type="submit" disabled={loading}>
        {loading ? t('auth.register.submitting') : t('auth.register.submit')}
      </Button>

      {onSwitchToLogin ? (
        <Button className="register-form__secondary-action" type="button" variant="outline" onClick={onSwitchToLogin}>
          {t('auth.register.switch')}
        </Button>
      ) : null}
    </form>
  )
}

export default Register
