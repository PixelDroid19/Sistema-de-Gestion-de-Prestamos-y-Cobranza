import React from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import { getPaginationSummary } from '@/lib/api/pagination'

function PaginationControls({ pagination, onPageChange, disabled = false, isPending = false, fallbackCount = 0 }) {
  const { t } = useTranslation()
  const summary = getPaginationSummary(pagination, fallbackCount)

  if (summary.totalPages <= 1) {
    return null
  }

  const page = summary.page
  const totalPages = summary.totalPages
  const isDisabled = disabled || isPending

  return (
    <div className="table-pagination" role="navigation" aria-label={t('common.pagination.navigation', { defaultValue: 'Pagination' })}>
      <span className="status-note">
        {t('common.pagination.pageIndicator', {
          page,
          totalPages,
          totalItems: summary.totalItems,
          defaultValue: `Page ${page} of ${totalPages} • ${summary.totalItems} items`,
        })}
      </span>
      <div className="inline-action-group">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDisabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('common.actions.previous', { defaultValue: 'Previous' })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDisabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.actions.next', { defaultValue: 'Next' })}
        </Button>
      </div>
    </div>
  )
}

export default PaginationControls
