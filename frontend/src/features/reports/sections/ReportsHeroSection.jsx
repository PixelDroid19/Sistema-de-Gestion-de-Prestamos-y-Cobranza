import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import StatCard from '@/components/ui/workspace/StatCard'
import WorkspaceCard from '@/components/ui/workspace/WorkspaceCard'

function ReportsHeroSection({ role, headlineMetrics, refreshing, refreshSuccess, selectedAssociateId, onRefresh, onExport, onExportAssociate }) {
  const { t } = useTranslation()
  const isSocio = role === 'socio'

  return (
    <WorkspaceCard
      className="surface-card surface-card--hero"
      eyebrow={isSocio ? t('reports.hero.partnerEyebrow') : t('reports.hero.workspaceEyebrow')}
      title={isSocio ? t('reports.hero.partnerTitle') : t('reports.hero.workspaceTitle')}
      subtitle={isSocio ? t('reports.hero.partnerSubtitle') : t('reports.hero.workspaceSubtitle')}
      actions={(
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
      )}
    >
      <div className="metric-grid">
        {headlineMetrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            caption={metric.caption}
            tone={metric.tone}
          />
        ))}
      </div>
      {refreshSuccess && <div className="inline-message inline-message--success">✅ {t('reports.hero.refreshed')}</div>}
    </WorkspaceCard>
  )
}

export default ReportsHeroSection
