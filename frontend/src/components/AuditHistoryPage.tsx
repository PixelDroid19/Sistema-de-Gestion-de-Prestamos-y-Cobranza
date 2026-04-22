import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitCommit, ArrowLeft, RotateCcw, Download, Loader2 } from 'lucide-react';
import dagService from '../services/dagService';
import { confirm as confirmModal } from '../lib/confirmModal';
import { toast } from '../lib/toast';
import { queryKeys } from '../services/queryKeys';
import { GraphHistoryEntry } from '../types/dag';

export default function AuditHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const graphId = Number(id);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  const { data: historyData, isLoading } = useQuery({
    queryKey: queryKeys.dag.history(graphId),
    queryFn: () => dagService.getGraphHistory(graphId),
    enabled: !!graphId,
  });

  const { data: diffData } = useQuery({
    queryKey: queryKeys.dag.diff(graphId, selectedVersions[1] || 0),
    queryFn: () => dagService.getGraphDiff(graphId, selectedVersions[1]),
    enabled: selectedVersions.length === 2 && !!graphId,
  });

  const history: GraphHistoryEntry[] = historyData?.data?.history ?? [];

  const toggleVersion = (version: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleRestore = async () => {
    if (!selectedVersions[0]) return;
    const entry = history.find((h) => h.version === selectedVersions[0]);
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-text-primary">Formula History #{id}</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-brand-primary" size={32} />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          No history found for this formula.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Versions</h2>
            <div className="flex flex-col gap-3">
              {history.map((entry) => (
                <button
                  key={entry.version}
                  onClick={() => toggleVersion(entry.version)}
                  className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${
                    entry.isActive
                      ? 'border-green-300 bg-green-50/60 ring-1 ring-green-300'
                      : selectedVersions.includes(entry.version)
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-border-subtle bg-bg-surface hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitCommit size={14} className={entry.isActive ? 'text-green-600' : 'text-text-secondary'} />
                    <span className="text-sm font-semibold text-text-primary">v{entry.version}</span>
                    {entry.isActive && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">ACTIVE</span>
                    )}
                  </div>
                  <span className="text-xs text-text-secondary truncate">{entry.commitMessage || 'No message'}</span>
                  <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                    <span>{entry.authorName || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Diff Viewer */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                Diff {selectedVersions.length === 2 ? `(v${selectedVersions[0]} → v${selectedVersions[1]})` : ''}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestore}
                  disabled={selectedVersions.length !== 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  Restore
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            </div>

            {selectedVersions.length === 2 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-secondary">PREVIOUS (v{selectedVersions[0]})</span>
                  <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface min-h-[200px]">
                    <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                      {diffData?.data?.diff?.previousGraph
                        ? JSON.stringify(diffData.data.diff.previousGraph, null, 2)
                        : 'Loading...'}
                    </pre>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-secondary">NEW (v{selectedVersions[1]})</span>
                  <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface min-h-[200px]">
                    <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">
                      {diffData?.data?.diff?.newGraph
                        ? JSON.stringify(diffData.data.diff.newGraph, null, 2)
                        : 'Loading...'}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-border-subtle bg-bg-surface text-center text-text-secondary text-sm">
                Select two versions to compare
              </div>
            )}

            {diffData?.data?.diff?.impactedVariables && diffData.data.diff.impactedVariables.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text-primary">Impacted Variables</h3>
                <div className="flex flex-wrap gap-2">
                  {diffData.data.diff.impactedVariables.map((v: string) => (
                    <span key={v} className="px-2 py-1 rounded bg-brand-primary/10 text-brand-primary text-xs font-medium">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
