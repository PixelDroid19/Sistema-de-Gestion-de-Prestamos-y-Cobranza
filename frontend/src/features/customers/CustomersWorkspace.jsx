import React, { useEffect, useMemo, useState } from 'react'
import { Calendar, Filter, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FilterBar from '@/components/ui/workspace/FilterBar'
import StatCard from '@/components/ui/workspace/StatCard'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useDeleteCustomerMutation, useCustomersQuery, useUpdateCustomerMutation } from '@/hooks/useCustomers'
import { handleApiError } from '@/lib/api/errors'
import { usePaginationStore } from '@/store/paginationStore'
import { useUiStore } from '@/store/uiStore'
import { normalizePhoneNumber } from '@/utils/phone'

const CUSTOMERS_SCOPE = 'workspace-customers-list'
const DEFAULT_PAGINATION = { page: 1, pageSize: 10 }

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getCustomerLoanSummary(customer) {
  return customer?.loanSummary || null
}

function getCustomerLoanCount(customer) {
  if (customer?.loanCount !== undefined && customer?.loanCount !== null) {
    return Number(customer.loanCount || 0)
  }

  return Number(getCustomerLoanSummary(customer)?.totalLoans || 0)
}

function getCustomerActiveLoans(customer) {
  if (customer?.activeLoans !== undefined && customer?.activeLoans !== null) {
    return Number(customer.activeLoans || 0)
  }

  return Number(getCustomerLoanSummary(customer)?.activeLoans || 0)
}

function hasCustomerLoans(customer) {
  return getCustomerActiveLoans(customer) > 0 || getCustomerLoanCount(customer) > 0
}

function CustomersWorkspace() {
  const { t } = useTranslation()
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const customerEditId = useUiStore((state) => state.customerEditId)
  const setCustomerEditId = useUiStore((state) => state.setCustomerEditId)
  const clearCustomerEditId = useUiStore((state) => state.clearCustomerEditId)
  const setLoanDraftCustomerId = useUiStore((state) => state.setLoanDraftCustomerId)
  const setLoanFilterCustomerId = useUiStore((state) => state.setLoanFilterCustomerId)
  const customersPagination = usePaginationStore((state) => state.scopes[CUSTOMERS_SCOPE] || DEFAULT_PAGINATION)
  const ensureCustomersScope = usePaginationStore((state) => state.ensureScope)
  const setCustomersPage = usePaginationStore((state) => state.setPage)
  const setCustomersPageSize = usePaginationStore((state) => state.setPageSize)
  const customersQuery = useCustomersQuery({ pagination: customersPagination })
  const deleteCustomerMutation = useDeleteCustomerMutation()
  const updateCustomerMutation = useUpdateCustomerMutation()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active',
  })

  useEffect(() => {
    ensureCustomersScope(CUSTOMERS_SCOPE, DEFAULT_PAGINATION)
  }, [ensureCustomersScope])

  const customers = useMemo(() => {
    if (Array.isArray(customersQuery.data?.items)) {
      return customersQuery.data.items
    }
    if (Array.isArray(customersQuery.data?.data?.customers)) {
      return customersQuery.data.data.customers
    }
    return []
  }, [customersQuery.data])

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const haystack = [customer.name, customer.email, customer.phone].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = haystack.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(customer.status || 'active').toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  }), [customers, searchTerm, statusFilter])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => Number(customer.id) === Number(customerEditId)) || null,
    [customerEditId, customers],
  )

  useEffect(() => {
    if (!selectedCustomer) {
      return
    }

    setProfileForm({
      name: selectedCustomer.name || '',
      email: selectedCustomer.email || '',
      phone: selectedCustomer.phone || '',
      status: selectedCustomer.status || 'active',
    })
  }, [selectedCustomer])

  const summaryCards = useMemo(() => {
    const activeCount = filteredCustomers.filter((customer) => String(customer.status || 'active').toLowerCase() === 'active').length
    const withLoansCount = filteredCustomers.filter((customer) => hasCustomerLoans(customer)).length

    return [
      { label: t('customers.summary.total'), value: filteredCustomers.length, caption: t('customers.summary.totalCaption'), tone: 'brand' },
      { label: t('customers.summary.active'), value: activeCount, caption: t('customers.summary.activeCaption'), tone: 'success' },
      { label: t('customers.summary.withLoans'), value: withLoansCount, caption: t('customers.summary.withLoansCaption'), tone: 'info' },
    ]
  }, [filteredCustomers, t])

  const selectedCustomerLoanSummary = getCustomerLoanSummary(selectedCustomer)

  const handleOpenCustomerProfile = (customer) => {
    setError('')
    setCustomerEditId(customer.id)
  }

  const handleOpenCustomerCredits = (customer) => {
    setError('')
    setCustomerEditId(customer.id)

    if (hasCustomerLoans(customer)) {
      setLoanFilterCustomerId(customer.id)
      setCurrentView('credits')
      return
    }

    setLoanDraftCustomerId(customer.id)
    setCurrentView('credits-new')
  }

  const handleProfileSave = async () => {
    if (!selectedCustomer) {
      return
    }

    setError('')

    try {
      await updateCustomerMutation.mutateAsync({
        customerId: selectedCustomer.id,
        payload: {
          name: String(profileForm.name || '').trim() || selectedCustomer.name,
          email: String(profileForm.email || '').trim() || selectedCustomer.email,
          phone: normalizePhoneNumber(String(profileForm.phone || '').trim()) || selectedCustomer.phone,
          status: String(profileForm.status || '').trim() || selectedCustomer.status || 'active',
        },
      })
    } catch (updateError) {
      handleApiError(updateError, setError)
    }
  }

  const columns = [
    { key: 'id', header: t('customers.table.headers.id'), render: (row) => <span className="table-id-pill">CUS-{row.id}</span> },
    { key: 'name', header: t('customers.table.headers.name'), render: (row) => <div className="table-inline-stack"><strong>{row.name}</strong><span>{row.email || '—'}</span></div> },
    { key: 'phone', header: t('customers.table.headers.contact'), render: (row) => row.phone || row.email || '—' },
    { key: 'status', header: t('customers.table.headers.status'), render: (row) => <span className={`status-badge status-badge--${String(row.status || 'active').toLowerCase() === 'active' ? 'success' : 'neutral'}`}>{String(row.status || 'active')}</span> },
    { key: 'createdAt', header: t('customers.table.headers.joined'), render: (row) => formatDate(row.createdAt) },
    { key: 'activeLoans', header: t('customers.table.headers.loans'), render: (row) => getCustomerActiveLoans(row) || getCustomerLoanCount(row) },
    {
      key: 'actions',
      header: t('customers.table.headers.actions'),
      render: (row) => (
        <div className="inline-action-group">
          <Button
            size="sm"
            variant="outline"
            disabled={updateCustomerMutation.isPending}
            onClick={async () => {
              const name = window.prompt(t('customers.prompts.editName'), row.name || '')
              if (name === null) return
              const phone = window.prompt(t('customers.prompts.editPhone'), row.phone || '')
              if (phone === null) return
              const status = window.prompt(t('customers.prompts.editStatus'), row.status || 'active')
              if (status === null) return
              setError('')
              try {
                await updateCustomerMutation.mutateAsync({
                  customerId: row.id,
                  payload: {
                    name: String(name).trim() || row.name,
                    phone: normalizePhoneNumber(String(phone).trim()) || row.phone,
                    status: String(status).trim() || row.status || 'active',
                  },
                })
              } catch (updateError) {
                handleApiError(updateError, setError)
              }
            }}
          >
            {t('common.actions.edit')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCustomerProfile(row)}
          >
            {t('customers.actions.viewProfile')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCustomerCredits(row)}
          >
            {hasCustomerLoans(row) ? t('customers.actions.viewLoans') : t('customers.actions.createLoan')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={deleteCustomerMutation.isPending}
            onClick={async () => {
              if (!window.confirm(t('customers.messages.confirmDelete'))) {
                return
              }
              setError('')
              try {
                await deleteCustomerMutation.mutateAsync(row.id)
              } catch (deleteError) {
                handleApiError(deleteError, setError)
              }
            }}
          >
            {t('common.actions.delete')}
          </Button>
        </div>
      ),
    },
  ]
  const paginationMeta = customersQuery.data?.pagination || customersQuery.data?.data?.pagination || null

  return (
    <div className="dashboard-page-stack lf-workspace">
      <Toolbar
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        actions={(
          <Button icon={Plus} onClick={() => setCurrentView('customers-new')}>
            {t('customers.actions.new')}
          </Button>
        )}
      />
      {error ? <div className="inline-message inline-message--error">⚠️ {error}</div> : null}

      <div className="metric-grid">
        {summaryCards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      {selectedCustomer ? (
        <WorkspaceCard
          eyebrow={t('customers.profile.eyebrow')}
          title={t('customers.profile.title', { name: selectedCustomer.name || t('common.values.notAvailable') })}
          subtitle={t('customers.profile.subtitle')}
        >
          <div className="dashboard-form-grid section-margin-bottom">
            <label className="field-group">
              <span className="field-label">{t('customers.form.fields.name')}</span>
              <input
                className="field-control"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('customers.form.fields.email')}</span>
              <input
                className="field-control"
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('customers.form.fields.phone')}</span>
              <input
                className="field-control"
                value={profileForm.phone}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="field-group">
              <span className="field-label">{t('customers.form.fields.status')}</span>
              <select
                className="field-control"
                value={profileForm.status}
                onChange={(event) => setProfileForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="active">{t('common.status.active')}</option>
                <option value="inactive">{t('common.status.inactive')}</option>
              </select>
            </label>
          </div>

          <div className="summary-grid section-margin-bottom">
            <StatCard
              label={t('customers.profile.relatedCredits')}
              value={getCustomerLoanCount(selectedCustomer)}
              caption={t('customers.profile.relatedCreditsCaption')}
              tone="brand"
            />
            <StatCard
              label={t('customers.profile.activeCredits')}
              value={getCustomerActiveLoans(selectedCustomer)}
              caption={t('customers.profile.activeCreditsCaption')}
              tone="info"
            />
            <StatCard
              label={t('customers.profile.latestCredit')}
              value={selectedCustomerLoanSummary?.latestLoanId ? `#${selectedCustomerLoanSummary.latestLoanId}` : t('common.values.notAvailable')}
              caption={selectedCustomerLoanSummary?.latestLoanStatus || t('common.values.notAvailable')}
              tone="success"
            />
          </div>

          <div className="inline-action-group">
            <Button onClick={handleProfileSave} disabled={updateCustomerMutation.isPending}>
              {updateCustomerMutation.isPending ? t('customers.actions.saving') : t('customers.profile.saveChanges')}
            </Button>
            <Button variant="outline" onClick={() => handleOpenCustomerCredits(selectedCustomer)}>
              {hasCustomerLoans(selectedCustomer) ? t('customers.actions.viewLoans') : t('customers.actions.createLoan')}
            </Button>
            <Button variant="outline" onClick={clearCustomerEditId}>
              {t('common.actions.close')}
            </Button>
          </div>
        </WorkspaceCard>
      ) : null}

      <WorkspaceCard
        eyebrow={t('customers.table.eyebrow')}
        title={t('customers.table.title')}
        subtitle={t('customers.table.subtitle')}
      >
        <FilterBar>
          <label className="lf-filter-pill">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t('customers.filters.search')} />
          </label>
          <label className="lf-filter-pill">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">{t('customers.filters.allStatuses')}</option>
              <option value="active">{t('common.status.active')}</option>
              <option value="inactive">{t('common.status.inactive')}</option>
            </select>
          </label>
          <span className="lf-filter-pill lf-filter-pill--static"><Calendar size={16} /> {t('customers.filters.timeline')}</span>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={filteredCustomers}
          emptyState={<EmptyState title={t('customers.table.emptyTitle')} description={t('customers.table.emptyMessage')} icon="👥" />}
        />
        <PaginationControls
          pagination={paginationMeta}
          onPageChange={(page) => setCustomersPage(CUSTOMERS_SCOPE, page)}
          onPageSizeChange={(pageSize) => setCustomersPageSize(CUSTOMERS_SCOPE, pageSize)}
          isPending={customersQuery.isFetching}
        />
      </WorkspaceCard>
    </div>
  )
}

export default CustomersWorkspace
