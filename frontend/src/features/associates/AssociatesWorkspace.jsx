import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PaginationControls from '@/components/ui/PaginationControls'
import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FilterBar from '@/components/ui/workspace/FilterBar'
import FormSection from '@/components/ui/workspace/FormSection'
import StatCard from '@/components/ui/workspace/StatCard'
import Toolbar from '@/components/ui/workspace/Toolbar'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import WorkspaceCalendar from '@/components/widgets/WorkspaceCalendar'
import {
  useAssociateLoanCalendars,
  useAssociatePortalQuery,
  useAssociatesQuery,
  useCreateAssociateContributionMutation,
  useCreateAssociateDistributionMutation,
  useCreateAssociateMutation,
  useCreateAssociateReinvestmentMutation,
  useDeleteAssociateMutation,
  useUpdateAssociateMutation,
} from '@/hooks/useAssociates'
import { useAssociateProfitabilityQuery } from '@/hooks/useReports'
import { handleApiError } from '@/lib/api/errors'
import { usePaginationStore } from '@/store/paginationStore'
import { useUiStore } from '@/store/uiStore'

const ASSOCIATES_SCOPE = 'workspace-associates-list'
const DEFAULT_PAGINATION = { page: 1, pageSize: 10 }
const INITIAL_ASSOCIATE_FORM = { name: '', email: '', phone: '', status: 'active', participationPercentage: '' }
const INITIAL_LEDGER_FORM = { amount: '', date: '', notes: '' }

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatPercent(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return `${numericValue.toFixed(2)}%`
}

function getInstallmentTone(status) {
  if (status === 'paid') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'partial') return 'primary'
  if (status === 'annulled') return 'warning'
  return 'neutral'
}

function getDistributionTone(type) {
  if (type === 'proportional') return 'info'
  if (type === 'manual') return 'warning'
  return 'neutral'
}

function AssociatesWorkspace() {
  const { t, i18n } = useTranslation()
  const setCurrentView = useUiStore((state) => state.setCurrentView)
  const associatesPagination = usePaginationStore((state) => state.scopes[ASSOCIATES_SCOPE] || DEFAULT_PAGINATION)
  const ensureAssociatesScope = usePaginationStore((state) => state.ensureScope)
  const setAssociatesPage = usePaginationStore((state) => state.setPage)
  const setAssociatesPageSize = usePaginationStore((state) => state.setPageSize)
  const associatesQuery = useAssociatesQuery({ pagination: associatesPagination })
  const [associateForm, setAssociateForm] = useState(INITIAL_ASSOCIATE_FORM)
  const [contributionForm, setContributionForm] = useState(INITIAL_LEDGER_FORM)
  const [distributionForm, setDistributionForm] = useState(INITIAL_LEDGER_FORM)
  const [reinvestmentForm, setReinvestmentForm] = useState(INITIAL_LEDGER_FORM)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAssociateId, setSelectedAssociateId] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const createAssociateMutation = useCreateAssociateMutation()
  const updateAssociateMutation = useUpdateAssociateMutation(selectedAssociateId || null)
  const deleteAssociateMutation = useDeleteAssociateMutation()
  const createContributionMutation = useCreateAssociateContributionMutation(selectedAssociateId || null)
  const createDistributionMutation = useCreateAssociateDistributionMutation(selectedAssociateId || null)
  const createReinvestmentMutation = useCreateAssociateReinvestmentMutation(selectedAssociateId || null)
  const selectedAssociatePortalQuery = useAssociatePortalQuery(selectedAssociateId || null, { enabled: Boolean(selectedAssociateId) })
  const selectedAssociateProfitabilityQuery = useAssociateProfitabilityQuery(selectedAssociateId || null, { enabled: Boolean(selectedAssociateId) })

  useEffect(() => {
    ensureAssociatesScope(ASSOCIATES_SCOPE, DEFAULT_PAGINATION)
  }, [ensureAssociatesScope])

  const associates = useMemo(() => {
    if (Array.isArray(associatesQuery.data?.items)) {
      return associatesQuery.data.items
    }
    if (Array.isArray(associatesQuery.data?.data?.associates)) {
      return associatesQuery.data.data.associates
    }
    return []
  }, [associatesQuery.data])

  const filteredAssociates = useMemo(() => associates.filter((associate) => (
    [associate.name, associate.email, associate.phone].filter(Boolean).join(' ').toLowerCase().includes(searchTerm.toLowerCase())
  )), [associates, searchTerm])

  const selectedAssociate = useMemo(
    () => associates.find((associate) => Number(associate.id) === Number(selectedAssociateId)) || null,
    [associates, selectedAssociateId],
  )

  const selectedAssociatePortal = selectedAssociatePortalQuery.data?.data?.portal || null
  const selectedAssociateProfitability = selectedAssociateProfitabilityQuery.data?.data?.report || null
  const contributions = useMemo(() => {
    if (Array.isArray(selectedAssociateProfitability?.data?.contributions)) {
      return selectedAssociateProfitability.data.contributions
    }
    if (Array.isArray(selectedAssociatePortal?.contributions)) {
      return selectedAssociatePortal.contributions
    }
    return []
  }, [selectedAssociatePortal, selectedAssociateProfitability])
  const distributions = useMemo(() => {
    if (Array.isArray(selectedAssociateProfitability?.data?.distributions)) {
      return selectedAssociateProfitability.data.distributions
    }
    if (Array.isArray(selectedAssociatePortal?.distributions)) {
      return selectedAssociatePortal.distributions
    }
    return []
  }, [selectedAssociatePortal, selectedAssociateProfitability])
  const linkedLoans = useMemo(() => {
    if (Array.isArray(selectedAssociatePortal?.loans)) {
      return selectedAssociatePortal.loans
    }
    if (Array.isArray(selectedAssociateProfitability?.data?.loans)) {
      return selectedAssociateProfitability.data.loans
    }
    return []
  }, [selectedAssociatePortal, selectedAssociateProfitability])
  const loanCalendarQueries = useAssociateLoanCalendars(linkedLoans, { enabled: Boolean(selectedAssociateId) && linkedLoans.length > 0 })
  const loanCalendarLoading = loanCalendarQueries.some((query) => query.isLoading || query.isFetching)
  const loanCalendarError = loanCalendarQueries.find((query) => query.error)?.error || null
  const loanInstallments = useMemo(() => loanCalendarQueries.flatMap((query, index) => {
    const loan = linkedLoans[index]
    const entries = Array.isArray(query.data?.data?.calendar?.entries) ? query.data.data.calendar.entries : []

    return entries.map((entry) => ({
      ...entry,
      rowId: `${loan?.id}-${entry.installmentNumber}-${entry.dueDate || 'no-date'}`,
      loanId: loan?.id,
      loanStatus: loan?.status || '-',
      customerName: loan?.customerName || loan?.Customer?.name || loan?.customer?.name || '-',
      loanAmount: Number(loan?.amount || 0),
    }))
  }).sort((left, right) => {
    const leftTime = new Date(left.dueDate || 0).getTime()
    const rightTime = new Date(right.dueDate || 0).getTime()
    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return Number(left.installmentNumber || 0) - Number(right.installmentNumber || 0)
  }), [linkedLoans, loanCalendarQueries])
  const calendarEvents = useMemo(() => loanInstallments.map((entry) => ({
    id: `associate-loan-${entry.loanId}-installment-${entry.installmentNumber}`,
    title: t('associates.calendar.eventTitle', {
      loanId: entry.loanId,
      installment: entry.installmentNumber,
      status: t(`payments.statuses.${entry.status}`),
    }),
    start: new Date(entry.dueDate),
    end: new Date(entry.dueDate),
    allDay: true,
  })), [loanInstallments, t])

  const overviewStats = [
    { label: t('associates.summary.total'), value: filteredAssociates.length, caption: t('associates.summary.totalCaption'), tone: 'brand' },
    { label: t('associates.summary.active'), value: filteredAssociates.filter((entry) => entry.status !== 'inactive').length, caption: t('associates.summary.activeCaption'), tone: 'success' },
    { label: t('associates.summary.linked'), value: filteredAssociates.reduce((sum, entry) => sum + Number(entry.activeLoanCount || 0), 0), caption: t('associates.summary.linkedCaption'), tone: 'info' },
  ]

  const profitabilitySummary = useMemo(() => {
    const totalContributed = Number(selectedAssociateProfitability?.summary?.totalContributed || selectedAssociatePortal?.summary?.totalContributed || 0)
    const totalDistributed = Number(selectedAssociateProfitability?.summary?.totalDistributed || selectedAssociatePortal?.summary?.totalDistributed || 0)
    const netProfit = Number(selectedAssociateProfitability?.summary?.netProfit || selectedAssociatePortal?.summary?.netProfit || totalDistributed)
    const contributionCount = Number(selectedAssociateProfitability?.summary?.contributionCount || contributions.length)
    const distributionCount = Number(selectedAssociateProfitability?.summary?.distributionCount || distributions.length)
    const participationPercentage = selectedAssociateProfitability?.summary?.participationPercentage || selectedAssociate?.participationPercentage || selectedAssociatePortal?.associate?.participationPercentage || null
    const activeLoanCount = Number(selectedAssociatePortal?.summary?.activeLoanCount || 0)
    const portfolioExposure = Number(selectedAssociatePortal?.summary?.portfolioExposure || 0)
    const realizedYield = totalContributed > 0 ? (totalDistributed / totalContributed) * 100 : 0

    return {
      totalContributed,
      totalDistributed,
      netProfit,
      contributionCount,
      distributionCount,
      participationPercentage,
      activeLoanCount,
      portfolioExposure,
      realizedYield,
    }
  }, [contributions.length, distributions.length, selectedAssociate, selectedAssociatePortal, selectedAssociateProfitability])

  const simulationRows = useMemo(() => distributions.reduce((accumulator, entry, index) => {
    const previousAccumulated = accumulator[index - 1]?.accumulated || 0
    const distributedAmount = Number(entry.allocatedAmount || entry.amount || 0)
    const accumulated = previousAccumulated + distributedAmount
    const yieldPercentage = profitabilitySummary.totalContributed > 0
      ? (accumulated / profitabilitySummary.totalContributed) * 100
      : 0

    return [
      ...accumulator,
      {
        id: entry.id || `${index + 1}`,
        period: index + 1,
        distributionDate: entry.distributionDate || entry.createdAt || null,
        distributionType: entry.distributionType || 'manual',
        distributedAmount,
        accumulated,
        yieldPercentage,
      },
    ]
  }, []), [distributions, profitabilitySummary.totalContributed])

  const linkedLoanRows = useMemo(() => linkedLoans.map((loan) => {
    const loanEntries = loanInstallments.filter((entry) => Number(entry.loanId) === Number(loan.id))
    const nextDueEntry = loanEntries.find((entry) => ['pending', 'overdue', 'partial'].includes(entry.status)) || loanEntries[0] || null
    const overdueCount = loanEntries.filter((entry) => entry.status === 'overdue').length

    return {
      ...loan,
      customerName: loan.customerName || loan.Customer?.name || loan.customer?.name || '-',
      nextDueDate: nextDueEntry?.dueDate || null,
      nextOutstandingAmount: Number(nextDueEntry?.outstandingAmount || 0),
      overdueCount,
    }
  }), [linkedLoans, loanInstallments])

  const paginationMeta = associatesQuery.data?.pagination || associatesQuery.data?.data?.pagination || null

  const handleAssociateCreate = async () => {
    setError('')
    setSuccess('')
    try {
      await createAssociateMutation.mutateAsync(associateForm)
      setAssociateForm(INITIAL_ASSOCIATE_FORM)
      setSuccess(t('associates.messages.created'))
    } catch (createError) {
      handleApiError(createError, setError)
    }
  }

  const handleAssociateUpdate = async () => {
    if (!selectedAssociateId) return
    setError('')
    setSuccess('')
    try {
      await updateAssociateMutation.mutateAsync(associateForm)
      setSuccess(t('associates.messages.updated'))
    } catch (updateError) {
      handleApiError(updateError, setError)
    }
  }

  const handleAssociateDelete = async () => {
    if (!selectedAssociateId) return
    if (!window.confirm(t('associates.messages.confirmDelete'))) return
    setError('')
    setSuccess('')
    try {
      await deleteAssociateMutation.mutateAsync(selectedAssociateId)
      setSelectedAssociateId('')
      setModalOpen(false)
      setAssociateForm(INITIAL_ASSOCIATE_FORM)
      setSuccess(t('associates.messages.deleted'))
    } catch (deleteError) {
      handleApiError(deleteError, setError)
    }
  }

  const handleLedgerAction = async (type) => {
    if (!selectedAssociateId) return

    const form = type === 'contribution' ? contributionForm : type === 'distribution' ? distributionForm : reinvestmentForm
    const payload = {
      amount: form.amount,
      notes: form.notes || undefined,
      contributionDate: type === 'contribution' ? form.date || undefined : undefined,
      distributionDate: type === 'distribution' ? form.date || undefined : undefined,
      reinvestmentDate: type === 'reinvestment' ? form.date || undefined : undefined,
    }

    setError('')
    setSuccess('')

    try {
      if (type === 'contribution') await createContributionMutation.mutateAsync(payload)
      if (type === 'distribution') await createDistributionMutation.mutateAsync(payload)
      if (type === 'reinvestment') await createReinvestmentMutation.mutateAsync(payload)
      setSuccess(t('associates.messages.ledgerSaved'))
      if (type === 'contribution') setContributionForm(INITIAL_LEDGER_FORM)
      if (type === 'distribution') setDistributionForm(INITIAL_LEDGER_FORM)
      if (type === 'reinvestment') setReinvestmentForm(INITIAL_LEDGER_FORM)
    } catch (ledgerError) {
      handleApiError(ledgerError, setError)
    }
  }

  return (
    <div className="dashboard-page-stack lf-workspace">
      <Toolbar title={t('associates.title')} subtitle={t('associates.subtitle')} actions={<Button icon={Plus}>{t('associates.actions.new')}</Button>} />
      {success ? <div className="inline-message inline-message--success">{success}</div> : null}
      {error ? <div className="inline-message inline-message--error">{error}</div> : null}
      <div className="metric-grid">{overviewStats.map((card) => <StatCard key={card.label} {...card} />)}</div>
      <WorkspaceCard className="surface-card" title={t('associates.forms.title')} subtitle={t('associates.forms.subtitle')}>
        <div className="dashboard-form-grid">
          <label className="field-group"><span className="field-label">{t('reports.admin.fields.name')}</span><input className="field-control" value={associateForm.name} onChange={(event) => setAssociateForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="field-group"><span className="field-label">{t('reports.admin.fields.email')}</span><input className="field-control" value={associateForm.email} onChange={(event) => setAssociateForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label className="field-group"><span className="field-label">{t('reports.admin.fields.phone')}</span><input className="field-control" value={associateForm.phone} onChange={(event) => setAssociateForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="field-group"><span className="field-label">{t('reports.admin.fields.status')}</span><select className="field-control" value={associateForm.status} onChange={(event) => setAssociateForm((current) => ({ ...current, status: event.target.value }))}><option value="active">{t('common.status.active')}</option><option value="inactive">{t('common.status.inactive')}</option></select></label>
          <label className="field-group"><span className="field-label">{t('reports.admin.fields.participation')}</span><input className="field-control" value={associateForm.participationPercentage} onChange={(event) => setAssociateForm((current) => ({ ...current, participationPercentage: event.target.value }))} /></label>
          <div className="field-group"><span className="field-label">{t('reports.admin.fields.action')}</span><Button onClick={selectedAssociateId ? handleAssociateUpdate : handleAssociateCreate} disabled={createAssociateMutation.isPending || updateAssociateMutation.isPending}>{selectedAssociateId ? t('reports.admin.buttons.updateAssociate') : t('reports.admin.buttons.createAssociate')}</Button></div>
        </div>
      </WorkspaceCard>
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
            { key: 'name', header: t('associates.table.headers.name'), render: (row) => <div className="table-inline-stack"><strong>{row.name}</strong><span>{row.email || '-'}</span></div> },
            { key: 'status', header: t('associates.table.headers.status') },
            { key: 'participationPercentage', header: t('associates.table.headers.participation'), render: (row) => row.participationPercentage ? `${row.participationPercentage}%` : '-' },
            { key: 'activeLoanCount', header: t('associates.table.headers.loans'), render: (row) => Number(row.activeLoanCount || 0) },
            { key: 'actions', header: t('customers.table.headers.actions'), render: (row) => <Button size="sm" variant="outline" onClick={() => { setSelectedAssociateId(String(row.id)); setDetailTab('overview'); setAssociateForm({ name: row.name || '', email: row.email || '', phone: row.phone || '', status: row.status || 'active', participationPercentage: row.participationPercentage || '' }); setModalOpen(true) }}>{t('associates.actions.details')}</Button> },
          ]}
          rows={filteredAssociates}
          emptyState={<EmptyState title={t('associates.table.emptyTitle')} description={t('associates.table.emptyMessage')} icon="🤝" />}
        />
        <PaginationControls
          pagination={paginationMeta}
          onPageChange={(page) => setAssociatesPage(ASSOCIATES_SCOPE, page)}
          onPageSizeChange={(pageSize) => setAssociatesPageSize(ASSOCIATES_SCOPE, pageSize)}
          isPending={associatesQuery.isFetching}
        />
      </WorkspaceCard>
      {modalOpen && selectedAssociate ? (
        <WorkspaceCard className="surface-card" title={`${selectedAssociate.name} · ${t('associates.actions.details')}`} subtitle={t('associates.detail.subtitle')}>
          <div className="inline-action-group section-margin-bottom">
            <Button size="sm" variant={detailTab === 'overview' ? 'primary' : 'outline'} onClick={() => setDetailTab('overview')}>{t('associates.tabs.overview')}</Button>
            <Button size="sm" variant={detailTab === 'history' ? 'primary' : 'outline'} onClick={() => setDetailTab('history')}>{t('associates.tabs.history')}</Button>
            <Button size="sm" variant={detailTab === 'simulation' ? 'primary' : 'outline'} onClick={() => setDetailTab('simulation')}>{t('associates.tabs.simulation')}</Button>
            <Button size="sm" variant={detailTab === 'calendar' ? 'primary' : 'outline'} onClick={() => setDetailTab('calendar')}>{t('associates.tabs.calendar')}</Button>
            <Button size="sm" variant="danger" onClick={handleAssociateDelete} disabled={deleteAssociateMutation.isPending}>{t('reports.admin.buttons.deleteAssociate')}</Button>
            <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>{t('common.actions.close')}</Button>
          </div>

          {detailTab === 'overview' ? (
            <div className="dashboard-page-stack section-stack--compact">
              <div className="summary-grid">
                <StatCard label={t('reports.admin.fields.contributed')} value={formatCurrency(profitabilitySummary.totalContributed)} />
                <StatCard label={t('reports.admin.fields.distributed')} value={formatCurrency(profitabilitySummary.totalDistributed)} />
                <StatCard label={t('associates.detail.cards.yield')} value={formatPercent(profitabilitySummary.realizedYield)} />
                <StatCard label={t('reports.admin.fields.activeLoans')} value={profitabilitySummary.activeLoanCount} />
                <StatCard label={t('reports.admin.fields.exposure')} value={formatCurrency(profitabilitySummary.portfolioExposure)} />
                <StatCard label={t('reports.admin.fields.participation')} value={formatPercent(profitabilitySummary.participationPercentage)} />
              </div>

              <FormSection title={t('associates.detail.profileTitle')}>
                <div className="summary-grid">
                  <StatCard label={t('reports.admin.fields.status')} value={selectedAssociate.status || '-'} />
                  <StatCard label={t('reports.admin.fields.email')} value={selectedAssociate.email || '-'} />
                  <StatCard label={t('reports.admin.fields.phone')} value={selectedAssociate.phone || '-'} />
                  <StatCard label={t('associates.detail.cards.movements')} value={profitabilitySummary.contributionCount + profitabilitySummary.distributionCount} />
                </div>
              </FormSection>

              <FormSection title={t('associates.detail.linkedLoansTitle')}>
                <DataTable
                  columns={[
                    { key: 'id', header: t('associates.loans.headers.loan'), render: (loan) => <span className="table-id-pill">LN-{loan.id}</span> },
                    { key: 'customerName', header: t('associates.loans.headers.customer') },
                    { key: 'status', header: t('associates.loans.headers.status') },
                    { key: 'amount', header: t('associates.loans.headers.amount'), cellClassName: 'table-cell-right', render: (loan) => formatCurrency(loan.amount) },
                    { key: 'nextDueDate', header: t('associates.loans.headers.nextDue'), render: (loan) => formatDate(loan.nextDueDate) },
                    { key: 'nextOutstandingAmount', header: t('associates.loans.headers.nextOutstanding'), cellClassName: 'table-cell-right', render: (loan) => formatCurrency(loan.nextOutstandingAmount) },
                    { key: 'overdueCount', header: t('associates.loans.headers.overdue'), render: (loan) => loan.overdueCount },
                  ]}
                  rows={linkedLoanRows}
                  rowKey="id"
                  emptyState={<EmptyState icon="📄" title={t('associates.loans.emptyTitle')} description={t('associates.loans.emptyMessage')} />}
                />
              </FormSection>
            </div>
          ) : null}

          {detailTab === 'history' ? (
            <div className="dashboard-page-stack section-stack--compact">
              <FormSection title={t('reports.admin.buttons.addContribution')}>
                <div className="dashboard-form-grid">
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.contributionAmount')}</span><input className="field-control" value={contributionForm.amount} onChange={(event) => setContributionForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.contributionDate')}</span><input className="field-control" type="date" value={contributionForm.date} onChange={(event) => setContributionForm((current) => ({ ...current, date: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.notes')}</span><input className="field-control" value={contributionForm.notes} onChange={(event) => setContributionForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="field-group"><span className="field-label">{t('reports.admin.fields.action')}</span><Button onClick={() => handleLedgerAction('contribution')} disabled={createContributionMutation.isPending}>{t('reports.admin.buttons.addContribution')}</Button></div>
                </div>
              </FormSection>
              <FormSection title={t('reports.admin.buttons.addDistribution')}>
                <div className="dashboard-form-grid">
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.distributionAmount')}</span><input className="field-control" value={distributionForm.amount} onChange={(event) => setDistributionForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.distributionDate')}</span><input className="field-control" type="date" value={distributionForm.date} onChange={(event) => setDistributionForm((current) => ({ ...current, date: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.notes')}</span><input className="field-control" value={distributionForm.notes} onChange={(event) => setDistributionForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="field-group"><span className="field-label">{t('reports.admin.fields.action')}</span><Button onClick={() => handleLedgerAction('distribution')} disabled={createDistributionMutation.isPending}>{t('reports.admin.buttons.addDistribution')}</Button></div>
                </div>
              </FormSection>
              <FormSection title={t('reports.admin.buttons.addReinvestment')}>
                <div className="dashboard-form-grid">
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.reinvestmentAmount')}</span><input className="field-control" value={reinvestmentForm.amount} onChange={(event) => setReinvestmentForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.reinvestmentDate')}</span><input className="field-control" type="date" value={reinvestmentForm.date} onChange={(event) => setReinvestmentForm((current) => ({ ...current, date: event.target.value }))} /></label>
                  <label className="field-group"><span className="field-label">{t('reports.admin.fields.notes')}</span><input className="field-control" value={reinvestmentForm.notes} onChange={(event) => setReinvestmentForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                  <div className="field-group"><span className="field-label">{t('reports.admin.fields.action')}</span><Button onClick={() => handleLedgerAction('reinvestment')} disabled={createReinvestmentMutation.isPending}>{t('reports.admin.buttons.addReinvestment')}</Button></div>
                </div>
              </FormSection>

              <FormSection title={t('associates.history.contributionsTitle')}>
                <DataTable
                  columns={[
                    { key: 'id', header: 'ID', render: (entry) => <span className="table-id-pill">CTR-{entry.id}</span> },
                    { key: 'contributionDate', header: t('associates.history.headers.date'), render: (entry) => formatDate(entry.contributionDate || entry.createdAt) },
                    { key: 'amount', header: t('associates.history.headers.amount'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.amount) },
                    { key: 'notes', header: t('associates.history.headers.notes'), render: (entry) => entry.notes || '-' },
                  ]}
                  rows={contributions}
                  rowKey="id"
                  emptyState={<EmptyState icon="💰" title={t('associates.history.emptyContributions')} description={t('associates.history.emptyContributions')} />}
                />
              </FormSection>

              <FormSection title={t('associates.history.distributionsTitle')}>
                <DataTable
                  columns={[
                    { key: 'id', header: 'ID', render: (entry) => <span className="table-id-pill">DST-{entry.id}</span> },
                    { key: 'distributionDate', header: t('associates.history.headers.date'), render: (entry) => formatDate(entry.distributionDate || entry.createdAt) },
                    { key: 'allocatedAmount', header: t('associates.history.headers.amount'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.allocatedAmount || entry.amount) },
                    { key: 'distributionType', header: t('associates.history.headers.type'), render: (entry) => <Badge variant={getDistributionTone(entry.distributionType)}>{entry.distributionType || '-'}</Badge> },
                    { key: 'notes', header: t('associates.history.headers.notes'), render: (entry) => entry.notes || '-' },
                  ]}
                  rows={distributions}
                  rowKey="id"
                  emptyState={<EmptyState icon="💼" title={t('associates.history.emptyDistributions')} description={t('associates.history.emptyDistributions')} />}
                />
              </FormSection>
            </div>
          ) : null}

          {detailTab === 'simulation' ? (
            <div className="dashboard-page-stack section-stack--compact">
              <div className="summary-grid">
                <StatCard label={t('associates.detail.cards.projectedPeriods')} value={simulationRows.length} />
                <StatCard label={t('associates.detail.cards.netProfit')} value={formatCurrency(profitabilitySummary.netProfit)} />
                <StatCard label={t('associates.detail.cards.yield')} value={formatPercent(profitabilitySummary.realizedYield)} />
                <StatCard label={t('associates.detail.cards.movements')} value={profitabilitySummary.contributionCount + profitabilitySummary.distributionCount} />
              </div>

              <FormSection title={t('associates.simulation.title')}>
                <DataTable
                  columns={[
                    { key: 'period', header: t('associates.simulation.period') },
                    { key: 'distributionDate', header: t('associates.simulation.date'), render: (row) => formatDate(row.distributionDate) },
                    { key: 'distributionType', header: t('associates.simulation.type'), render: (row) => <Badge variant={getDistributionTone(row.distributionType)}>{row.distributionType}</Badge> },
                    { key: 'distributedAmount', header: t('associates.simulation.distributed'), cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.distributedAmount) },
                    { key: 'accumulated', header: t('associates.simulation.accumulated'), cellClassName: 'table-cell-right', render: (row) => formatCurrency(row.accumulated) },
                    { key: 'yieldPercentage', header: t('associates.simulation.yield'), cellClassName: 'table-cell-right', render: (row) => formatPercent(row.yieldPercentage) },
                  ]}
                  rows={simulationRows}
                  rowKey="id"
                  emptyState={<EmptyState title={t('associates.simulation.empty')} description={t('associates.simulation.emptyMessage')} icon="📈" />}
                />
              </FormSection>
            </div>
          ) : null}

          {detailTab === 'calendar' ? (
            <div className="dashboard-page-stack section-stack--compact">
              <div className="inline-action-group">
                <Button size="sm" variant="outline" onClick={() => setCurrentView('payments')}>{t('associates.calendar.openPayments')}</Button>
              </div>

              {loanCalendarError ? <div className="inline-message inline-message--error">{t('associates.calendar.loadError')}</div> : null}

              <FormSection title={t('associates.calendar.tableTitle')}>
                <DataTable
                  columns={[
                    { key: 'loanId', header: t('associates.calendar.headers.loan'), render: (entry) => <span className="table-id-pill">LN-{entry.loanId}</span> },
                    { key: 'customerName', header: t('associates.calendar.headers.customer') },
                    { key: 'installmentNumber', header: t('associates.calendar.headers.installment'), render: (entry) => `#${entry.installmentNumber}` },
                    { key: 'dueDate', header: t('associates.calendar.headers.dueDate'), render: (entry) => formatDate(entry.dueDate) },
                    { key: 'outstandingAmount', header: t('associates.calendar.headers.outstanding'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.outstandingAmount) },
                    { key: 'status', header: t('associates.calendar.headers.status'), render: (entry) => <Badge variant={getInstallmentTone(entry.status)}>{t(`payments.statuses.${entry.status}`)}</Badge> },
                  ]}
                  rows={loanInstallments}
                  rowKey="rowId"
                  emptyState={<EmptyState icon="🗓️" title={loanCalendarLoading ? t('associates.calendar.loadingTitle') : t('associates.calendar.emptyTitle')} description={loanCalendarLoading ? t('associates.calendar.loadingTitle') : t('associates.calendar.emptyMessage')} />}
                />
              </FormSection>

              <FormSection title={t('associates.calendar.surfaceTitle')}>
                {calendarEvents.length > 0 ? (
                  <WorkspaceCalendar
                    culture={i18n.language}
                    events={calendarEvents}
                    defaultView="month"
                    views={['month', 'agenda']}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 420 }}
                  />
                ) : (
                  <EmptyState icon="🗓️" title={t('associates.calendar.emptyTitle')} description={t('associates.calendar.emptyMessage')} />
                )}
              </FormSection>
            </div>
          ) : null}
        </WorkspaceCard>
      ) : null}
    </div>
  )
}

export default AssociatesWorkspace
