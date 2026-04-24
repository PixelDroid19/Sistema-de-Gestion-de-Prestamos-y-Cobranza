import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitCommit, ArrowLeft, RotateCcw, Download, Loader2 } from 'lucide-react';
import dagService from '../services/dagService';
import { confirm as confirmModal } from '../lib/confirmModal';
import { toast } from '../lib/toast';
import { queryKeys } from '../services/queryKeys';
import { GraphHistoryEntry, NodeDelta } from '../types/dag';

const MD3 = {
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  onSurfaceVariant: '#5a6271',
  secondary: '#00668a',
  secondaryContainer: '#cce5f3',
  onSecondaryContainer: '#00344a',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
  outline: '#c4c6cf',
  outlineVariant: '#dee1ea',
  success: '#2e7d32',
  successContainer: '#e8f5e9',
} as const;

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DeltaLine({ delta }: { delta: NodeDelta }) {
  const isAdded = delta.change === 'added';
  const isRemoved = delta.change === 'removed';
  const isModified = delta.change === 'modified';

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: isAdded ? MD3.successContainer : isRemoved ? MD3.errorContainer : isModified ? MD3.secondaryContainer : MD3.surface,
            color: isAdded ? MD3.success : isRemoved ? MD3.error : isModified ? MD3.secondary : MD3.onSurfaceVariant,
          }}
        >
          {delta.change}
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: MD3.onSurface }}>{delta.nodeId}</span>
      </div>
      {isRemoved && (
        <div className="text-xs font-mono pl-4" style={{ color: MD3.error }}>
          - {delta.oldFormula || '(no formula)'}
        </div>
      )}
      {isAdded && (
        <div className="text-xs font-mono pl-4" style={{ color: MD3.success }}>
          + {delta.newFormula || '(no formula)'}
        </div>
      )}
      {isModified && (
        <div className="flex flex-col gap-0.5 pl-4">
          <div className="text-xs font-mono" style={{ color: MD3.error }}>
            - {delta.oldFormula || '(no formula)'}
          </div>
          <div className="text-xs font-mono" style={{ color: MD3.success }}>
            + {delta.newFormula || '(no formula)'}
          </div>
        </div>
      )}
      {delta.oldOutputVar !== delta.newOutputVar && (
        <div className="text-xs pl-4" style={{ color: MD3.onSurfaceVariant }}>
          outputVar: {delta.oldOutputVar || '—'} → {delta.newOutputVar || '—'}
        </div>
      )}
    </div>
  );
}

export default function AuditHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const graphId = Number(id);
  const [selectedGraphId, setSelectedGraphId] = useState<number | null>(null);

  const { data: historyData, isLoading } = useQuery({
    queryKey: queryKeys.dag.history(graphId),
    queryFn: () => dagService.getGraphHistory(graphId),
    enabled: !!graphId,
  });

  const history: GraphHistoryEntry[] = historyData?.data?.history ?? [];
  const effectiveSelectedGraphId = selectedGraphId ?? history[0]?.id ?? null;
  const selectedIndex = history.findIndex((entry) => entry.id === effectiveSelectedGraphId);
  const selectedEntry = selectedIndex >= 0 ? history[selectedIndex] : null;
  const prevEntry = selectedIndex >= 0 ? history[selectedIndex + 1] || null : null;
  const compareToGraphId = prevEntry?.id;

  const {
    data: diffData,
    isLoading: diffLoading,
    isError: diffError,
    error: diffErrorData,
  } = useQuery({
    queryKey: queryKeys.dag.diff(graphId, compareToGraphId || 0),
    queryFn: () => dagService.getGraphDiff(graphId, {
      compareToGraphId,
      compareToVersionId: prevEntry?.version,
    }),
    enabled: !!graphId && !!selectedEntry && !!compareToGraphId,
  });

  const handleRestore = async () => {
    const entry = selectedEntry;
    if (!entry) return;
    const confirmed = await confirmModal({
      title: 'Restore Version',
      message: `Restore version v${entry.version}? This will create a new version.`,
      confirmLabel: 'Restore',
      confirmVariant: 'primary',
    });
    if (!confirmed) return;
    try {
      await dagService.restoreGraph(graphId, `Restored from v${entry.version}`);
      window.location.reload();
    } catch (err) {
      toast.error({ description: 'Restore failed: ' + (err as Error).message });
    }
  };

  const handleExport = () => {
    const data = {
      formulaId: graphId,
      exportedAt: new Date().toISOString(),
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formula-${graphId}-history.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 h-full overflow-y-auto" style={{ backgroundColor: MD3.surface }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-sm transition-colors hover:text-[#0b1c30]"
            style={{ color: MD3.onSurfaceVariant }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: MD3.secondary }}>
              Formula Audit Log
            </div>
            <h1 className="text-2xl font-bold" style={{ color: MD3.onSurface }}>
              {history[0]?.commitMessage || `Formula History`}
            </h1>
            <p className="text-sm" style={{ color: MD3.onSurfaceVariant }}>
              FRM-{String(graphId).padStart(4, '0')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors"
            style={{ borderColor: MD3.outlineVariant, color: MD3.onSurface }}
          >
            <Download size={14} />
            Export Log
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" size={32} style={{ color: MD3.secondary }} />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12" style={{ color: MD3.onSurfaceVariant }}>
          No history found for this formula.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Version History Timeline */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: MD3.onSurfaceVariant }}>
              Version History
            </h2>
            <div className="relative flex flex-col gap-0">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px" style={{ backgroundColor: MD3.outlineVariant }} />

              {history.map((entry) => {
                const isSelected = effectiveSelectedGraphId === entry.id;
                const isActive = entry.isActive;

                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedGraphId(entry.id)}
                    className="relative flex items-start gap-3 text-left p-3 rounded-xl transition-all mb-2"
                    style={{
                      backgroundColor: isActive ? '#ffffff' : isSelected ? 'rgba(0,102,138,0.05)' : 'transparent',
                      border: `1px solid ${isActive ? MD3.secondary : isSelected ? MD3.outline : 'transparent'}`,
                      boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {/* Timeline dot */}
                    <div
                      className="relative z-10 w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ring-2 ring-white"
                      style={{
                        backgroundColor: isActive ? MD3.secondary : isSelected ? MD3.secondary : MD3.outline,
                      }}
                    />

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: MD3.onSurface }}>
                          v{entry.version}
                        </span>
                        {isActive && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: MD3.secondaryContainer, color: MD3.onSecondaryContainer }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-xs truncate" style={{ color: MD3.onSurfaceVariant }}>
                        {entry.commitMessage || 'No message'}
                      </span>
                      <div className="flex items-center gap-2 text-[10px]" style={{ color: MD3.onSurfaceVariant }}>
                        <span>{entry.authorName || 'Unknown'}</span>
                        <span>·</span>
                        <span>{formatDate(entry.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Details + Diff */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {selectedEntry ? (
              <>
                {/* Version header */}
                <div
                  className="rounded-2xl border p-5"
                  style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold" style={{ color: MD3.onSurface }}>
                        Version {selectedEntry.version}
                      </h2>
                      {selectedEntry.isActive && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{ backgroundColor: MD3.secondaryContainer, color: MD3.onSecondaryContainer }}
                        >
                          CURRENT ACTIVE
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleRestore}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors"
                      style={{ borderColor: MD3.outlineVariant, color: MD3.onSurface }}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </button>
                  </div>

                  <div
                    className="rounded-lg p-3 text-sm mb-4"
                    style={{ backgroundColor: MD3.surface, color: MD3.onSurface }}
                  >
                    {selectedEntry.commitMessage || 'No commit message'}
                  </div>

                  <div className="flex items-center gap-4 text-xs" style={{ color: MD3.onSurfaceVariant }}>
                    <span>Author: <strong style={{ color: MD3.onSurface }}>{selectedEntry.authorName || 'Unknown'}</strong></span>
                    <span>Date: <strong style={{ color: MD3.onSurface }}>{formatDate(selectedEntry.createdAt)}</strong></span>
                  </div>
                </div>

                {/* Diff */}
                {diffLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin" size={24} style={{ color: MD3.secondary }} />
                  </div>
                ) : diffError ? (
                  <div
                    className="p-8 rounded-2xl border text-center text-sm"
                    style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurfaceVariant }}
                  >
                    {`Unable to load diff: ${(diffErrorData as Error)?.message || 'Unknown error'}`}
                  </div>
                ) : diffData?.data?.diff ? (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-2xl border overflow-hidden"
                      style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}
                    >
                      <div
                        className="px-5 py-3 border-b flex items-center justify-between"
                        style={{ borderColor: MD3.outlineVariant, backgroundColor: 'rgba(248,249,255,0.5)' }}
                      >
                        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: MD3.onSurfaceVariant }}>
                          Changes
                        </h3>
                        <span className="text-xs font-mono" style={{ color: MD3.onSurfaceVariant }}>
                          {diffData.data.diff.deltas?.length || 0} nodes changed
                        </span>
                      </div>

                      <div className="p-4">
                        {diffData.data.diff.deltas?.length > 0 ? (
                          <div className="flex flex-col gap-2 divide-y" style={{ borderColor: MD3.outlineVariant }}>
                            {diffData.data.diff.deltas.map((delta: NodeDelta) => (
                              <DeltaLine key={delta.nodeId} delta={delta} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm" style={{ color: MD3.onSurfaceVariant }}>
                            No structural changes detected
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Impacted Variables */}
                    {diffData.data.diff.impactedVariables && diffData.data.diff.impactedVariables.length > 0 && (
                      <div
                        className="rounded-2xl border p-5"
                        style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant }}
                      >
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: MD3.onSurfaceVariant }}>
                          Impacted Variables
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {diffData.data.diff.impactedVariables.map((v: string) => (
                            <span
                              key={v}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{ backgroundColor: MD3.secondaryContainer, color: MD3.onSecondaryContainer }}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Side-by-side raw JSON (collapsed by default) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold" style={{ color: MD3.onSurfaceVariant }}>
                          PREVIOUS {prevEntry ? `(v${prevEntry.version})` : ''}
                        </span>
                        <div
                          className="p-4 rounded-xl border min-h-[160px] overflow-auto"
                          style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant }}
                        >
                          <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: MD3.onSurfaceVariant }}>
                            {diffData.data.diff.previousGraph
                              ? JSON.stringify(diffData.data.diff.previousGraph, null, 2)
                              : 'No previous data'}
                          </pre>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold" style={{ color: MD3.onSurfaceVariant }}>
                          NEW (v{selectedEntry.version})
                        </span>
                        <div
                          className="p-4 rounded-xl border min-h-[160px] overflow-auto"
                          style={{ backgroundColor: MD3.surface, borderColor: MD3.outlineVariant }}
                        >
                          <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: MD3.onSurfaceVariant }}>
                            {diffData.data.diff.newGraph
                              ? JSON.stringify(diffData.data.diff.newGraph, null, 2)
                              : 'No data'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-8 rounded-2xl border text-center text-sm"
                    style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurfaceVariant }}
                  >
                    Select a version with a previous version to compare
                  </div>
                )}
              </>
            ) : (
              <div
                className="p-8 rounded-2xl border text-center text-sm"
                style={{ backgroundColor: '#ffffff', borderColor: MD3.outlineVariant, color: MD3.onSurfaceVariant }}
              >
                Select a version from the timeline to view details and diff
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
