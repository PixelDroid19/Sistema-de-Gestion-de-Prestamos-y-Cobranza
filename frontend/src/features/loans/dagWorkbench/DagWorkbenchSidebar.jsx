import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

function DagWorkbenchSidebar({
  variables,
  simulationInput,
  summary,
  onVariableChange,
  onAddVariable,
  onRemoveVariable,
  onSimulationInputChange,
}) {
  return (
    <aside className="loans-dag-workbench__sidebar loans-dag-workbench__sidebar--left">
      <section className="loans-dag-workbench__panel">
        <div className="loans-dag-workbench__panel-heading">
          <div>
            <div className="section-eyebrow">Global variables</div>
            <div className="section-title section-title--compact">Shared runtime inputs</div>
          </div>
          <Button type="button" size="sm" variant="outline" icon={Plus} onClick={onAddVariable}>
            Add
          </Button>
        </div>

        <div className="loans-dag-workbench__variable-list">
          {variables.map((variable) => (
            <div key={variable.id} className="loans-dag-workbench__variable-row">
              <Input
                label="Key"
                value={variable.key}
                onChange={(event) => onVariableChange(variable.id, { key: event.target.value })}
              />
              <Input
                label="Value"
                value={variable.value}
                onChange={(event) => onVariableChange(variable.id, { value: event.target.value })}
              />
              <button
                type="button"
                className="loans-dag-workbench__icon-action"
                onClick={() => onRemoveVariable(variable.id)}
                aria-label={`Remove variable ${variable.key || variable.id}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Simulation</div>
        <div className="section-title section-title--compact">Workbench runtime</div>
        <div className="dashboard-form-grid loans-dag-workbench__simulation-grid">
          <Input
            label="Amount"
            value={simulationInput.amount}
            onChange={(event) => onSimulationInputChange('amount', event.target.value)}
          />
          <Input
            label="Interest rate"
            value={simulationInput.interestRate}
            onChange={(event) => onSimulationInputChange('interestRate', event.target.value)}
          />
          <Input
            label="Term months"
            value={simulationInput.termMonths}
            onChange={(event) => onSimulationInputChange('termMonths', event.target.value)}
          />
        </div>
      </section>

      <section className="metric-grid loans-dag-workbench__totals-grid">
        <div className="metric-card metric-card--brand">
          <div className="metric-card__label">Nodes</div>
          <div className="metric-card__value">{summary.nodeCount}</div>
          <div className="metric-card__caption">Formula nodes: {summary.formulaNodeCount}</div>
        </div>
        <div className="metric-card metric-card--info">
          <div className="metric-card__label">Edges</div>
          <div className="metric-card__value">{summary.edgeCount}</div>
          <div className="metric-card__caption">Outputs: {summary.outputCount}</div>
        </div>
        <div className="metric-card metric-card--warning">
          <div className="metric-card__label">Variables</div>
          <div className="metric-card__value">{summary.variableCount}</div>
          <div className="metric-card__caption">Reusable in formulas</div>
        </div>
      </section>
    </aside>
  );
}

export default DagWorkbenchSidebar;
