import React from 'react'
import { useTranslation } from 'react-i18next'

import DataTable from '@/components/ui/workspace/DataTable'
import EmptyState from '@/components/ui/workspace/EmptyState'
import FormSection from '@/components/ui/workspace/FormSection'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'
import { formatCurrency, formatDate } from '@/features/reports/reportsWorkspace.utils'

function ReportsPartnerSection({ partnerReport, partnerPortal }) {
  const { t } = useTranslation()

  const contributionColumns = [
    { key: 'contributionDate', header: t('reports.partner.headers.contributionDate'), render: (entry) => formatDate(entry.contributionDate) },
    { key: 'amount', header: t('reports.partner.headers.amount'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.amount) },
    { key: 'notes', header: t('reports.partner.headers.notes'), render: (entry) => entry.notes || '-' },
  ]

  const distributionColumns = [
    { key: 'distributionDate', header: t('reports.partner.headers.distributionDate'), render: (entry) => formatDate(entry.distributionDate) },
    { key: 'distributionType', header: t('reports.partner.headers.type'), render: (entry) => entry.distributionType || '-' },
    { key: 'allocatedAmount', header: t('reports.partner.headers.allocated'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.allocatedAmount || entry.amount) },
    { key: 'declaredProportionalTotal', header: t('reports.partner.headers.declaredTotal'), cellClassName: 'table-cell-right', render: (entry) => formatCurrency(entry.declaredProportionalTotal) },
  ]

  const loanColumns = [
    { key: 'id', header: t('reports.partner.headers.loanId'), render: (loan) => `#${loan.id}` },
    { key: 'customer', header: t('reports.partner.headers.customer'), render: (loan) => loan.Customer?.name || '-' },
    { key: 'amount', header: t('reports.partner.headers.amount'), cellClassName: 'table-cell-right', render: (loan) => formatCurrency(loan.amount) },
    { key: 'status', header: t('reports.partner.headers.status'), render: (loan) => loan.status || '-' },
  ]

  return (
    <WorkspaceCard
      className="surface-card"
      eyebrow={t('reports.partner.eyebrow')}
      title={t('reports.partner.title')}
      subtitle={t('reports.partner.subtitle')}
    >
        <div className="summary-grid section-margin-bottom">
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.contributionCount')}</div><div className="detail-card__value">{partnerReport?.summary?.contributionCount || 0}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.distributionCount')}</div><div className="detail-card__value">{partnerReport?.summary?.distributionCount || 0}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.netProfit')}</div><div className="detail-card__value detail-card__value--success">{formatCurrency(partnerReport?.summary?.netProfit || 0)}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.portfolioExposure')}</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(partnerPortal?.summary?.portfolioExposure || 0)}</div></div>
        </div>
        <FormSection title={t('reports.partner.headers.contributionDate')} className="section-margin-bottom">
          <DataTable
            columns={contributionColumns}
            rows={partnerReport?.data?.contributions || []}
            rowKey="id"
            emptyState={<EmptyState icon="💰" title={t('reports.partner.emptyContributions')} />}
          />
        </FormSection>
        <FormSection title={t('reports.partner.headers.distributionDate')} className="section-margin-bottom">
          <DataTable
            columns={distributionColumns}
            rows={partnerReport?.data?.distributions || []}
            rowKey="id"
            emptyState={<EmptyState icon="📤" title={t('reports.partner.emptyDistributions')} />}
          />
        </FormSection>
        <FormSection title={t('reports.partner.headers.loanId')}>
          <DataTable
            columns={loanColumns}
            rows={partnerReport?.data?.loans || []}
            rowKey="id"
            emptyState={<EmptyState icon="📄" title={t('reports.partner.emptyLoans')} />}
          />
        </FormSection>
    </WorkspaceCard>
  )
}

export default ReportsPartnerSection
