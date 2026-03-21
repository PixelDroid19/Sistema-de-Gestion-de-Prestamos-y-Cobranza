import React, { useMemo } from 'react';
import { Trash2 } from 'lucide-react';

import Badge from '@/components/ui/Badge';
import { buildCanvasEdgePath, DAG_NODE_HEIGHT, DAG_NODE_WIDTH } from '@/features/loans/dagWorkbench/dagWorkbench.utils';

function DagWorkbenchCanvas({
  graph,
  selectedNodeId,
  validation,
  cycleErrors,
  outputsByNodeId,
  onSelectNode,
  onRemoveNode,
  onMoveNode,
}) {
  const nodeMap = useMemo(() => Object.fromEntries(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const validationByField = useMemo(() => {
    const items = [...(validation?.errors || []), ...(validation?.warnings || [])];

    return items.reduce((result, item) => {
      const key = item.field?.replace(/^nodes\./, '').split('.')[0];
      if (!key) {
        return result;
      }

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(item.message);
      return result;
    }, {});
  }, [validation]);

  return (
    <div className="loans-dag-workbench__canvas-panel">
      {cycleErrors.length ? (
        <div className="inline-message inline-message--error">{cycleErrors[0].message}</div>
      ) : null}

      <div className="loans-dag-workbench__canvas-stage" role="presentation">
        <svg className="loans-dag-workbench__edges" aria-hidden="true">
          <defs>
            <marker id="dag-arrow" markerWidth="14" markerHeight="14" refX="11" refY="6" orient="auto">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="currentColor" />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const sourceNode = nodeMap[edge.source];
            const targetNode = nodeMap[edge.target];

            if (!sourceNode || !targetNode) {
              return null;
            }

            const path = buildCanvasEdgePath(sourceNode.position, targetNode.position);

            return (
              <path
                key={edge.id}
                d={path}
                className={`loans-dag-workbench__edge${selectedNodeId === edge.target ? ' loans-dag-workbench__edge--active' : ''}`}
                markerEnd="url(#dag-arrow)"
              />
            );
          })}
        </svg>

        {graph.nodes.map((node) => {
          const issues = validationByField[node.id] || validationByField[node.outputVar] || [];
          const outputValue = outputsByNodeId[node.id];

          return (
            <div
              key={node.id}
              className={`loans-dag-workbench__node${selectedNodeId === node.id ? ' loans-dag-workbench__node--selected' : ''}`}
              style={{ left: node.position.x, top: node.position.y, width: DAG_NODE_WIDTH, minHeight: DAG_NODE_HEIGHT }}
              onClick={() => onSelectNode(node.id)}
              onPointerDown={(event) => {
                const startX = event.clientX;
                const startY = event.clientY;
                const { x, y } = node.position;

                const handleMove = (moveEvent) => {
                  onMoveNode(node.id, {
                    x: x + (moveEvent.clientX - startX),
                    y: y + (moveEvent.clientY - startY),
                  });
                };

                const stopMove = () => {
                  window.removeEventListener('pointermove', handleMove);
                  window.removeEventListener('pointerup', stopMove);
                };

                window.addEventListener('pointermove', handleMove);
                window.addEventListener('pointerup', stopMove, { once: true });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectNode(node.id);
                }
              }}
            >
              <div className="loans-dag-workbench__node-header">
                <div>
                  <div className="loans-dag-workbench__node-title">{node.label}</div>
                  <div className="loans-dag-workbench__node-subtitle">{node.outputVar}</div>
                </div>
                <div className="loans-dag-workbench__node-tools">
                  <Badge variant={node.kind === 'output' ? 'success' : node.kind === 'input' ? 'warning' : 'brand'}>
                    {node.kind}
                  </Badge>
                  <button
                    type="button"
                    className="loans-dag-workbench__icon-action"
                    aria-label={`Delete ${node.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveNode(node.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="loans-dag-workbench__node-body">
                <div className="loans-dag-workbench__node-formula">{node.formula || node.value || 'Direct dependency'}</div>
                <div className="loans-dag-workbench__node-output">Output: {outputValue ?? '--'}</div>
                {issues.length ? (
                  <div className="loans-dag-workbench__node-errors">{issues[0]}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DagWorkbenchCanvas;
