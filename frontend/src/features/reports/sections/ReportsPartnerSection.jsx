import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatCurrency, formatDate } from '@/features/reports/reportsWorkspace.utils'

function ReportsPartnerSection({ partnerReport, partnerPortal }) {
  const { t } = useTranslation()

  return (
    <section className="surface-card">
      <div className="surface-card__header surface-card__header--compact">
        <div>
          <div className="section-eyebrow">{t('reports.partner.eyebrow')}</div>
          <div className="section-title">{t('reports.partner.title')}</div>
          <div className="section-subtitle">{t('reports.partner.subtitle')}</div>
        </div>
      </div>
      <div className="surface-card__body">
        <div className="summary-grid section-margin-bottom">
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.contributionCount')}</div><div className="detail-card__value">{partnerReport?.summary?.contributionCount || 0}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.distributionCount')}</div><div className="detail-card__value">{partnerReport?.summary?.distributionCount || 0}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.netProfit')}</div><div className="detail-card__value detail-card__value--success">{formatCurrency(partnerReport?.summary?.netProfit || 0)}</div></div>
          <div className="detail-card"><div className="detail-card__label">{t('reports.partner.portfolioExposure')}</div><div className="detail-card__value detail-card__value--warning">{formatCurrency(partnerPortal?.summary?.portfolioExposure || 0)}</div></div>
        </div>
        <div className="table-wrap section-margin-bottom">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('reports.partner.headers.contributionDate')}</th>
                <th className="table-cell-right">{t('reports.partner.headers.amount')}</th>
                <th>{t('reports.partner.headers.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {(partnerReport?.data?.contributions || []).length === 0 ? (
                <tr><td colSpan="3" className="table-cell-center">{t('reports.partner.emptyContributions')}</td></tr>
              ) : (
                (partnerReport?.data?.contributions || []).map((entry) => (
                  <tr key={`contribution-${entry.id}`}>
                    <td>{formatDate(entry.contributionDate)}</td>
                    <td className="table-cell-right">{formatCurrency(entry.amount)}</td>
                    <td>{entry.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-wrap section-margin-bottom">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('reports.partner.headers.distributionDate')}</th>
                <th>{t('reports.partner.headers.type')}</th>
                <th className="table-cell-right">{t('reports.partner.headers.allocated')}</th>
                <th className="table-cell-right">{t('reports.partner.headers.declaredTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {(partnerReport?.data?.distributions || []).length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">{t('reports.partner.emptyDistributions')}</td></tr>
              ) : (
                (partnerReport?.data?.distributions || []).map((entry) => (
                  <tr key={`distribution-${entry.id}`}>
                    <td>{formatDate(entry.distributionDate)}</td>
                    <td>{entry.distributionType || '-'}</td>
                    <td className="table-cell-right">{formatCurrency(entry.allocatedAmount || entry.amount)}</td>
                    <td className="table-cell-right">{formatCurrency(entry.declaredProportionalTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('reports.partner.headers.loanId')}</th>
                <th>{t('reports.partner.headers.customer')}</th>
                <th className="table-cell-right">{t('reports.partner.headers.amount')}</th>
                <th>{t('reports.partner.headers.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(partnerReport?.data?.loans || []).length === 0 ? (
                <tr><td colSpan="4" className="table-cell-center">{t('reports.partner.emptyLoans')}</td></tr>
              ) : (
                (partnerReport?.data?.loans || []).map((loan) => (
                  <tr key={`loan-${loan.id}`}>
                    <td>#{loan.id}</td>
                    <td>{loan.Customer?.name || '-'}</td>
                    <td className="table-cell-right">{formatCurrency(loan.amount)}</td>
                    <td>{loan.status || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default ReportsPartnerSection
