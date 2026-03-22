import React, { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FilterBar from '@/components/ui/workspace/FilterBar'
import StatCard from '@/components/ui/workspace/StatCard'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { useAssociatesQuery } from '@/hooks/useAssociates'

function AssociatesWorkspace() {
  const { t } = useTranslation()
  const associatesQuery = useAssociatesQuery({ pagination: { page: 1, pageSize: 50 } })
  const [searchTerm, setSearchTerm] = useState('')

  const associates = Array.isArray(associatesQuery.data?.items)
    ? associatesQuery.data.items
    : Array.isArray(associatesQuery.data?.data?.associates)
      ? associatesQuery.data.data.associates
      : []

  const filteredAssociates = useMemo(() => associates.filter((associate) => (
    [associate.name, associate.email, associate.phone].filter(Boolean).join(' ').toLowerCase().includes(searchTerm.toLowerCase())
  )), [associates, searchTerm])

  const stats = [
    { label: t('associates.summary.total'), value: filteredAssociates.length, caption: t('associates.summary.totalCaption'), tone: 'brand' },
    { label: t('associates.summary.active'), value: filteredAssociates.filter((entry) => entry.status !== 'inactive').length, caption: t('associates.summary.activeCaption'), tone: 'success' },
    { label: t('associates.summary.linked'), value: filteredAssociates.reduce((sum, entry) => sum + Number(entry.activeLoanCount || 0), 0), caption: t('associates.summary.linkedCaption'), tone: 'info' },
  ]

  return (
    <div className="dashboard-page-stack lf-workspace">
      <Toolbar title={t('associates.title')} subtitle={t('associates.subtitle')} actions={<Button icon={Plus}>{t('associates.actions.new')}</Button>} />
      <div className="metric-grid">{stats.map((card) => <StatCard key={card.label} {...card} />)}</div>
      <WorkspaceCard eyebrow={t('associates.table.eyebrow')} title={t('associates.table.title')} subtitle={t('associates.table.subtitle')}>
        <FilterBar>
          <label className="lf-filter-pill">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t('associates.filters.search')} />
          </label>
        </FilterBar>
        <DataTable
          columns={[
            { key: 'id', header: t('associates.table.headers.id'), render: (row) => <span className="table-id-pill">ASC-{row.id}</span> },
            { key: 'name', header: t('associates.table.headers.name'), render: (row) => <div className="table-inline-stack"><strong>{row.name}</strong><span>{row.email || '—'}</span></div> },
            { key: 'status', header: t('associates.table.headers.status') },
            { key: 'participationPercentage', header: t('associates.table.headers.participation'), render: (row) => row.participationPercentage ? `${row.participationPercentage}%` : '—' },
            { key: 'activeLoanCount', header: t('associates.table.headers.loans'), render: (row) => Number(row.activeLoanCount || 0) },
          ]}
          rows={filteredAssociates}
          emptyState={<EmptyState title={t('associates.table.emptyTitle')} description={t('associates.table.emptyMessage')} icon="🤝" />}
        />
      </WorkspaceCard>
    </div>
  )
}

export default AssociatesWorkspace
