import React from 'react';
import { Link2, Unlink } from 'lucide-react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import DagWorkbenchFormulaPreview from '@/features/loans/dagWorkbench/DagWorkbenchFormulaPreview';

const OPERATORS = ['+', '-', '*', '/', '(', ')', '^'];

function DagWorkbenchInspector({
  node,
  graph,
  connectionDraft,
  connections,
  variables,
  validationMessages,
  runtime,
  onUpdateNode,
  onAppendFormula,
  onSetConnectionDraft,
  onConnectNodes,
  onDisconnectNodes,
}) {
  if (!node) {
    return (
      <aside className="loans-dag-workbench__sidebar loans-dag-workbench__sidebar--right">
        <section className="loans-dag-workbench__panel loans-dag-workbench__panel--empty">
          <div className="section-eyebrow">Inspector</div>
          <div className="section-title section-title--compact">Select a node</div>
          <div className="section-subtitle">Choose a node on the canvas to edit labels, formulas, outputs, and dependencies.</div>
        </section>
      </aside>
    );
  }

  const candidateTargets = graph.nodes.filter((candidateNode) => candidateNode.id !== node.id);

  return (
    <aside className="loans-dag-workbench__sidebar loans-dag-workbench__sidebar--right">
      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Inspector</div>
        <div className="section-title section-title--compact">{node.label}</div>
        <div className="dashboard-form-grid loans-dag-workbench__inspector-grid">
          <Input
            label="Label"
            value={node.label}
            onChange={(event) => onUpdateNode(node.id, { label: event.target.value })}
          />
          <Input
            label="Kind"
            value={node.kind}
            onChange={(event) => onUpdateNode(node.id, { kind: event.target.value })}
          />
          <Input
            label="Output variable"
            value={node.outputVar}
            onChange={(event) => onUpdateNode(node.id, { outputVar: event.target.value })}
          />
          <Input
            label="Static value"
            value={node.value}
            onChange={(event) => onUpdateNode(node.id, { value: event.target.value })}
          />
        </div>
      </section>

      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Formula editor</div>
        <textarea
          aria-label="Formula"
          className="form-control loans-dag-workbench__formula-textarea"
          value={node.formula}
          onChange={(event) => onUpdateNode(node.id, { formula: event.target.value })}
          spellCheck={false}
        />

        <div className="loans-dag-workbench__token-grid">
          {OPERATORS.map((operator) => (
            <button
              key={operator}
              type="button"
              className="loans-dag-workbench__token"
              onClick={() => onAppendFormula(operator)}
            >
              {operator}
            </button>
          ))}
        </div>

        <div className="loans-dag-workbench__token-group">
          <div className="loans-dag-workbench__token-group-title">Available variables</div>
          <div className="loans-dag-workbench__token-grid">
            {variables.map((variable) => (
              <button
                key={variable.id}
                type="button"
                className="loans-dag-workbench__token loans-dag-workbench__token--variable"
                onClick={() => onAppendFormula(variable.key)}
              >
                {variable.key}
              </button>
            ))}
            {graph.nodes.filter((candidateNode) => candidateNode.id !== node.id).map((candidateNode) => (
              <button
                key={candidateNode.id}
                type="button"
                className="loans-dag-workbench__token loans-dag-workbench__token--variable"
                onClick={() => onAppendFormula(candidateNode.outputVar || candidateNode.id)}
              >
                {candidateNode.outputVar || candidateNode.id}
              </button>
            ))}
          </div>
        </div>

        <DagWorkbenchFormulaPreview
          formula={node.formula}
          renderFormula={runtime.renderFormula}
          loading={runtime.loading}
          error={runtime.error}
          emptyLabel="Type a formula to preview it with KaTeX."
        />

        {validationMessages.length ? (
          <div className="inline-message inline-message--error">{validationMessages[0]}</div>
        ) : null}
      </section>

      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Dependencies</div>
        <div className="dashboard-form-grid loans-dag-workbench__dependency-grid">
          <Input
            label="Source node"
            value={connectionDraft.sourceNodeId}
            onChange={(event) => onSetConnectionDraft({ sourceNodeId: event.target.value })}
            list="dag-node-ids"
          />
          <Input
            label="Target node"
            value={connectionDraft.targetNodeId}
            onChange={(event) => onSetConnectionDraft({ targetNodeId: event.target.value })}
            list="dag-node-ids"
          />
        </div>
        <datalist id="dag-node-ids">
          {candidateTargets.map((candidateNode) => (
            <option key={candidateNode.id} value={candidateNode.id}>{candidateNode.label}</option>
          ))}
        </datalist>

        <div className="action-stack">
          <Button type="button" size="sm" variant="outline" icon={Link2} onClick={onConnectNodes}>
            Connect
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={Unlink}
            onClick={() => onDisconnectNodes(connectionDraft)}
          >
            Disconnect
          </Button>
        </div>

        <div className="loans-dag-workbench__dependency-list">
          {(connections.incoming || []).map((edge) => (
            <div key={edge.id} className="loans-dag-workbench__dependency-item">
              <span>{edge.source}{' -> '}{edge.target}</span>
              <button
                type="button"
                className="loans-dag-workbench__text-action"
                onClick={() => onDisconnectNodes({ sourceNodeId: edge.source, targetNodeId: edge.target })}
              >
                Remove
              </button>
            </div>
          ))}
          {!connections.incoming?.length && !connections.outgoing?.length ? (
            <div className="loans-dag-workbench__dependency-empty">No connections yet for this node.</div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

export default DagWorkbenchInspector;
