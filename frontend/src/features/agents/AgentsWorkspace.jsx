import React, { useEffect, useMemo, useReducer } from 'react'
import { AlertCircle, Mail, Phone, ShieldCheck, User, UserPlus, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import PaginationControls from '@/components/ui/PaginationControls'
import StatePanel from '@/components/ui/StatePanel'
import { useAgentsQuery } from '@/hooks/useAgents'
import { handleApiError } from '@/lib/api/errors'
import { authService } from '@/services/authService'
import { usePaginationStore } from '@/store/paginationStore'

const AGENTS_SCOPE = 'workspace-agents-roster'
const DEFAULT_PAGINATION = { page: 1, pageSize: 25 }

const emptyAgentForm = { name: '', email: '', phone: '', password: '' }

const initialState = {
  agentForm: emptyAgentForm,
  error: '',
  success: '',
  showModal: false,
  isCreating: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, agentForm: { ...state.agentForm, [action.field]: action.value } }
    case 'SET_ERROR':
      return { ...state, error: action.payload, success: '' }
    case 'SET_SUCCESS':
      return { ...state, success: action.payload, error: '' }
    case 'CLEAR_MESSAGES':
      return { ...state, error: '', success: '' }
    case 'OPEN_MODAL':
      return { ...state, showModal: true, agentForm: emptyAgentForm, error: '', success: '' }
    case 'CLOSE_MODAL':
      return { ...state, showModal: false, agentForm: emptyAgentForm, error: '', success: '' }
    case 'SET_CREATING':
      return { ...state, isCreating: action.payload }
    case 'RESET_FORM':
      return { ...state, agentForm: emptyAgentForm }
    default:
      return state
  }
}

function AgentsAlert({ message, tone = 'danger' }) {
  return (
    <div className={`agents-page__alert agents-page__alert--${tone}`} role="status">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  )
}

function AgentsSummary({ metrics, label }) {
  return (
    <section className="agents-page__summary" aria-label={label}>
      {metrics.map((metric) => (
        <Card key={metric.label} className="agents-page__summary-card">
          <div className={`agents-page__summary-icon agents-page__summary-icon--${metric.tone}`}>
            <metric.icon size={18} />
          </div>
          <div className="agents-page__summary-copy">
            <span className="agents-page__summary-label">{metric.label}</span>
            <strong className="agents-page__summary-value">{metric.value}</strong>
            <span className="agents-page__summary-caption">{metric.caption}</span>
          </div>
        </Card>
      ))}
    </section>
  )
}

function AgentIdentity({ agent, fallbackLabel }) {
  const initial = agent.name ? agent.name.charAt(0).toUpperCase() : null

  return (
    <div className="agents-page__identity">
      <div className="agents-page__avatar" aria-hidden="true">
        {initial || <User size={16} />}
      </div>
      <div>
        <div className="agents-page__identity-name">{agent.name || fallbackLabel}</div>
        <div className="agents-page__identity-id">#{agent.id}</div>
      </div>
    </div>
  )
}

function AgentContact({ email, phone, missingLabel }) {
  return (
    <div className="agents-page__contact-list">
      <span>
        <Mail size={12} />
        {email || missingLabel}
      </span>
      <span>
        <Phone size={12} />
        {phone || missingLabel}
      </span>
    </div>
  )
}

function AgentsTable({ agents, emptyTitle, emptyMessage, statusLabels, columns }) {
  if (agents.length === 0) {
    return (
      <div className="agents-page__empty-state">
        <Users size={20} />
        <strong>{emptyTitle}</strong>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="agents-page__table-wrap">
      <table className="data-table agents-page__table">
        <thead>
          <tr>
            <th>{columns.agent}</th>
            <th>{columns.contact}</th>
            <th>{columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const isActive = agent.isActive !== false

            return (
              <tr key={agent.id}>
                <td>
                  <AgentIdentity agent={agent} fallbackLabel={columns.unnamed} />
                </td>
                <td>
                  <AgentContact email={agent.email} phone={agent.phone} missingLabel={columns.notAvailable} />
                </td>
                <td>
                  <Badge variant={isActive ? 'active' : 'danger'}>
                    {isActive ? statusLabels.active : statusLabels.inactive}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AgentModal({
  isOpen,
  onClose,
  onSubmit,
  isCreating,
  form,
  onChange,
  labels,
}) {
  if (!isOpen) return null

  return (
    <div className="agents-page__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="agents-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agents-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="agents-page__modal-header">
          <div>
            <span className="section-eyebrow">{labels.modalEyebrow}</span>
            <h2 id="agents-modal-title">{labels.modalTitle}</h2>
            <p>{labels.modalDescription}</p>
          </div>
          <button
            type="button"
            className="agents-page__modal-close"
            onClick={onClose}
            aria-label={labels.close}
          >
            <X size={20} />
          </button>
        </div>

        <form className="agents-page__modal-form" onSubmit={onSubmit}>
          <Input
            id="agent-name"
            label={labels.name}
            name="name"
            value={form.name}
            onChange={onChange}
            required
            placeholder={labels.namePlaceholder}
            minLength={2}
            wrapperClassName="agents-page__field"
          />

          <Input
            id="agent-email"
            label={labels.email}
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
            placeholder={labels.emailPlaceholder}
            autoComplete="email"
            wrapperClassName="agents-page__field"
          />

          <Input
            id="agent-phone"
            label={labels.phone}
            type="tel"
            name="phone"
            value={form.phone}
            onChange={onChange}
            required
            placeholder={labels.phonePlaceholder}
            autoComplete="tel"
            wrapperClassName="agents-page__field"
          />

          <Input
            id="agent-password"
            label={labels.password}
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            required
            placeholder={labels.passwordPlaceholder}
            minLength={6}
            autoComplete="new-password"
            wrapperClassName="agents-page__field"
          />

          <div className="agents-page__modal-actions">
            <Button type="button" onClick={onClose} variant="outline">
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={isCreating} icon={UserPlus}>
              {isCreating ? labels.creating : labels.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AgentsWorkspace() {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(reducer, initialState)
  const agentsPagination = usePaginationStore((store) => store.scopes[AGENTS_SCOPE] || DEFAULT_PAGINATION)
  const ensureAgentsScope = usePaginationStore((store) => store.ensureScope)
  const setAgentsPage = usePaginationStore((store) => store.setPage)
  const agentsQuery = useAgentsQuery({ pagination: agentsPagination })

  useEffect(() => {
    ensureAgentsScope(AGENTS_SCOPE, DEFAULT_PAGINATION)
  }, [ensureAgentsScope])

  useEffect(() => {
    if (agentsQuery.error) {
      handleApiError(agentsQuery.error, (err) => dispatch({ type: 'SET_ERROR', payload: err }))
    }
  }, [agentsQuery.error])

  const agents = useMemo(
    () => (Array.isArray(agentsQuery.data?.items)
      ? agentsQuery.data.items
      : Array.isArray(agentsQuery.data?.data)
        ? agentsQuery.data.data
        : []),
    [agentsQuery.data],
  )
  const agentsPaginationMeta = agentsQuery.data?.pagination || agentsQuery.data?.data?.pagination || null

  const activeCount = agents.filter((agent) => agent.isActive !== false).length

  const summaryMetrics = useMemo(
    () => [
      {
        label: t('agents.summary.totalAgents'),
        value: agents.length,
        caption: t('agents.summary.totalAgentsCaption'),
        tone: 'brand',
        icon: Users,
      },
      {
        label: t('agents.summary.activeAgents'),
        value: activeCount,
        caption: t('agents.summary.activeAgentsCaption'),
        tone: 'success',
        icon: ShieldCheck,
      },
      {
        label: t('agents.summary.coverage'),
        value: `${Math.round((activeCount / Math.max(agents.length || 1, 1)) * 100)}%`,
        caption: t('agents.summary.coverageCaption'),
        tone: 'info',
        icon: Mail,
      },
    ],
    [activeCount, agents.length, t],
  )

  const handleFormChange = (event) => {
    const { name, value } = event.target
    dispatch({ type: 'SET_FIELD', field: name, value })
  }

  const handleCreateAgent = async (event) => {
    event.preventDefault()
    dispatch({ type: 'CLEAR_MESSAGES' })
    dispatch({ type: 'SET_CREATING', payload: true })

    try {
      await authService.adminRegister({
        name: state.agentForm.name,
        email: state.agentForm.email,
        password: state.agentForm.password,
        phone: state.agentForm.phone,
        role: 'agent',
      })

      dispatch({ type: 'SET_SUCCESS', payload: t('agents.messages.created') })
      dispatch({ type: 'RESET_FORM' })
      await agentsQuery.refetch()

      window.setTimeout(() => {
        dispatch({ type: 'CLOSE_MODAL' })
      }, 1200)
    } catch (error) {
      handleApiError(error, (message) => dispatch({ type: 'SET_ERROR', payload: message }))
    } finally {
      dispatch({ type: 'SET_CREATING', payload: false })
    }
  }

  if (agentsQuery.isLoading && !agents.length) {
    return (
      <StatePanel
        icon="⏳"
        title={t('agents.loading.title')}
        message={t('agents.loading.message')}
        loadingState
      />
    )
  }

  if (state.error && !agents.length) {
    return (
      <StatePanel
        icon="⚠️"
        title={t('agents.errorTitle')}
        message={state.error}
        action={<Button onClick={() => agentsQuery.refetch()}>{t('common.actions.tryAgain')}</Button>}
      />
    )
  }

  return (
    <div className="dashboard-page-stack agents-page fade-in">
      <section className="agents-page__hero">
        <div>
          <span className="section-eyebrow">{t('agents.eyebrow')}</span>
          <h1 className="page-title">{t('agents.title')}</h1>
          <p className="page-subtitle">{t('agents.subtitle')}</p>
        </div>
        <Button onClick={() => dispatch({ type: 'OPEN_MODAL' })} icon={UserPlus}>
          {t('agents.actions.add')}
        </Button>
      </section>

      <AgentsSummary metrics={summaryMetrics} label={t('agents.summary.ariaLabel')} />

      {state.error ? <AgentsAlert message={state.error} /> : null}
      {state.success ? <AgentsAlert message={state.success} tone="success" /> : null}

      <Card>
        <CardHeader
          eyebrow={t('agents.table.eyebrow')}
          title={t('agents.table.title')}
          subtitle={t('agents.table.subtitle')}
        />
        <CardBody className="agents-page__table-card">
          <PaginationControls pagination={agentsPaginationMeta} onPageChange={(page) => setAgentsPage(AGENTS_SCOPE, page)} />
          <AgentsTable
            agents={agents}
            emptyTitle={t('agents.table.emptyTitle')}
            emptyMessage={t('agents.table.emptyMessage')}
            statusLabels={{
              active: t('common.status.active'),
              inactive: t('common.status.inactive'),
            }}
            columns={{
              agent: t('agents.table.columns.agent'),
              contact: t('agents.table.columns.contact'),
              status: t('agents.table.columns.status'),
              unnamed: t('agents.table.unnamed'),
              notAvailable: t('common.values.notAvailable'),
            }}
          />
        </CardBody>
      </Card>

      <AgentModal
        isOpen={state.showModal}
        onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
        onSubmit={handleCreateAgent}
        isCreating={state.isCreating}
        form={state.agentForm}
        onChange={handleFormChange}
        labels={{
          modalEyebrow: t('agents.modal.eyebrow'),
          modalTitle: t('agents.modal.title'),
          modalDescription: t('agents.modal.description'),
          close: t('common.actions.close'),
          name: t('agents.modal.fields.name'),
          namePlaceholder: t('agents.modal.placeholders.name'),
          email: t('agents.modal.fields.email'),
          emailPlaceholder: t('agents.modal.placeholders.email'),
          phone: t('agents.modal.fields.phone'),
          phonePlaceholder: t('agents.modal.placeholders.phone'),
          password: t('agents.modal.fields.password'),
          passwordPlaceholder: t('agents.modal.placeholders.password'),
          cancel: t('common.actions.cancel'),
          creating: t('agents.actions.creating'),
          submit: t('agents.actions.submit'),
        }}
      />
    </div>
  )
}

export default AgentsWorkspace
