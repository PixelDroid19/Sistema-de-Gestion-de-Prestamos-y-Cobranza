import React from 'react';
import { Plus, RefreshCcw } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

function DagWorkbenchHeader({
  title,
  subtitle,
  topologyTone,
  topologyLabel,
  activeTab,
  onChangeTab,
  onAddNode,
  onRefresh,
  refreshing,
}) {
  return (
    <div className="loans-dag-workbench__header">
      <div className="loans-dag-workbench__identity">
        <div className="section-eyebrow">FinEngine DAG</div>
        <div className="loans-dag-workbench__identity-title-row">
          <h2 className="section-title">{title}</h2>
          <Badge variant={topologyTone}>{topologyLabel}</Badge>
        </div>
        <p className="section-subtitle">{subtitle}</p>
      </div>

      <div className="loans-dag-workbench__header-actions">
        <div className="page-tabs loans-dag-workbench__tabs" role="tablist" aria-label="Workbench views">
          <button
            type="button"
            className={`page-tab${activeTab === 'canvas' ? ' page-tab--active' : ''}`}
            onClick={() => onChangeTab('canvas')}
          >
            Canvas
          </button>
          <button
            type="button"
            className={`page-tab${activeTab === 'table' ? ' page-tab--active' : ''}`}
            onClick={() => onChangeTab('table')}
          >
            Table
          </button>
        </div>

        <div className="action-stack loans-dag-workbench__toolbar-actions">
          <Button type="button" size="sm" variant="outline" icon={RefreshCcw} onClick={onRefresh}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button type="button" size="sm" icon={Plus} onClick={onAddNode}>
            Add node
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DagWorkbenchHeader;
