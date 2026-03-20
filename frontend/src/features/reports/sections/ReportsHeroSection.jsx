import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'

function ReportsHeroSection({ role, headlineMetrics, refreshing, refreshSuccess, selectedAssociateId, onRefresh, onExport, onExportAssociate }) {
  const { t } = useTranslation()
  const isSocio = role === 'socio'

  return (
    <section className="surface-card surface-card--hero">
      <div className="surface-card__header">
        <div>
          <div className="section-eyebrow">{isSocio ? t('reports.hero.partnerEyebrow') : t('reports.hero.workspaceEyebrow')}</div>
          <div className="section-title">
            {isSocio ? t('reports.hero.partnerTitle') : t('reports.hero.workspaceTitle')}
          </div>
          <div className="section-subtitle">
            {isSocio ? t('reports.hero.partnerSubtitle') : t('reports.hero.workspaceSubtitle')}
          </div>
        </div>
        <div className="section-actions">
          <Button onClick={onRefresh} disabled={refreshing}>
            <span className={`spinner-icon${refreshing ? ' spinner-icon--spinning' : ''}`}>↻</span>
            {refreshing ? t('common.actions.refreshing') : t('reports.hero.refreshReports')}
          </Button>
          {!isSocio && (
            <>
              <Button variant="outline" onClick={() => onExport('csv')}>{t('reports.hero.exportCsv')}</Button>
              <Button variant="outline" onClick={() => onExport('pdf')}>{t('reports.hero.exportPdf')}</Button>
            </>
          )}
          {(isSocio || selectedAssociateId) && (
            <Button variant="outline" onClick={() => onExportAssociate(isSocio ? 'xlsx' : 'csv')}>
              {t('reports.hero.exportAssociate')}
            </Button>
          )}
        </div>
      </div>
      <div className="surface-card__body">
        <div className="metric-grid">
          {headlineMetrics.map((metric) => (
            <div key={metric.label} className={`metric-card metric-card--${metric.tone}`}>
              <div className="metric-card__label">{metric.label}</div>
              <div className="metric-card__value">{metric.value}</div>
              <div className="metric-card__caption">{metric.caption}</div>
            </div>
          ))}
        </div>
        {refreshSuccess && <div className="inline-message inline-message--success">✅ {t('reports.hero.refreshed')}</div>}
      </div>
    </section>
  )
}

export default ReportsHeroSection
