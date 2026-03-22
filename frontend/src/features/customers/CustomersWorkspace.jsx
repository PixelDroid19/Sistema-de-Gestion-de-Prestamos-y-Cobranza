import React, { useMemo, useState } from 'react'
import { Calendar, Filter, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FilterBar from '@/components/ui/workspace/FilterBar'
import StatCard from '@/components/ui/workspace/StatCard'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useCustomersQuery } from '@/hooks/useCustomers'
import { useUiStore } from '@/store/uiStore'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CustomersWorkspace() {
  const { t } = useTranslation()
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const customersQuery = useCustomersQuery({ pagination: { page: 1, pageSize: 50 } })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const customers = Array.isArray(customersQuery.data?.items)
    ? customersQuery.data.items
    : Array.isArray(customersQuery.data?.data?.customers)
      ? customersQuery.data.data.customers
      : []

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const haystack = [customer.name, customer.email, customer.phone].filter(Boolean).join(' ').toLowerCase()
    const matchesSearch = haystack.includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(customer.status || 'active').toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  }), [customers, searchTerm, statusFilter])

  const summaryCards = useMemo(() => {
    const activeCount = filteredCustomers.filter((customer) => String(customer.status || 'active').toLowerCase() === 'active').length
    const withLoansCount = filteredCustomers.filter((customer) => Number(customer.activeLoans || customer.loanCount || 0) > 0).length

    return [
      { label: t('customers.summary.total'), value: filteredCustomers.length, caption: t('customers.summary.totalCaption'), tone: 'brand' },
      { label: t('customers.summary.active'), value: activeCount, caption: t('customers.summary.activeCaption'), tone: 'success' },
      { label: t('customers.summary.withLoans'), value: withLoansCount, caption: t('customers.summary.withLoansCaption'), tone: 'info' },
    ]
  }, [filteredCustomers, t])

  const columns = [
    { key: 'id', header: t('customers.table.headers.id'), render: (row) => <span className="table-id-pill">CUS-{row.id}</span> },
    { key: 'name', header: t('customers.table.headers.name'), render: (row) => <div className="table-inline-stack"><strong>{row.name}</strong><span>{row.email || '—'}</span></div> },
    { key: 'phone', header: t('customers.table.headers.contact'), render: (row) => row.phone || row.email || '—' },
    { key: 'status', header: t('customers.table.headers.status'), render: (row) => <span className={`status-badge status-badge--${String(row.status || 'active').toLowerCase() === 'active' ? 'success' : 'neutral'}`}>{String(row.status || 'active')}</span> },
    { key: 'createdAt', header: t('customers.table.headers.joined'), render: (row) => formatDate(row.createdAt) },
    { key: 'activeLoans', header: t('customers.table.headers.loans'), render: (row) => Number(row.activeLoans || row.loanCount || 0) },
  ]

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

      <div className="metric-grid">
        {summaryCards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

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
      </WorkspaceCard>
    </div>
  )
}

export default CustomersWorkspace
