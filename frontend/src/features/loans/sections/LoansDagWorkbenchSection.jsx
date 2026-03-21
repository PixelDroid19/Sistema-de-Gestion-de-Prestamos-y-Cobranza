import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import StatePanel from '@/components/ui/StatePanel';
import {
  DagWorkbenchCanvas,
  DagWorkbenchHeader,
  DagWorkbenchInspector,
  DagWorkbenchSidebar,
  DagWorkbenchTableView,
  useDagMathRuntime,
} from '@/features/loans/dagWorkbench';
import {
  buildDagSummary,
  evaluateDagGraph,
  getNodeConnections,
  normalizeDagGraph,
  serializeDagGraphForApi,
} from '@/features/loans/dagWorkbench/dagWorkbench.utils';
import {
  useDagWorkbenchGraphQuery,
  useDagWorkbenchSummaryQuery,
  useSaveDagWorkbenchGraphMutation,
  useSimulateDagWorkbenchGraphMutation,
  useValidateDagWorkbenchGraphMutation,
} from '@/hooks/useDagWorkbench';
import { useDagWorkbenchStore } from '@/store/dagWorkbenchStore';

const toSimulationPayload = (simulationInput) => Object.entries(simulationInput).reduce((result, [key, value]) => {
  if (value === '') {
    return result;
  }

  const numericValue = Number(value);
  result[key] = Number.isNaN(numericValue) ? value : numericValue;
  return result;
}, {});

function LoansDagWorkbenchSection({ user, active }) {
  const { t } = useTranslation();
  const scopeKey = useDagWorkbenchStore((state) => state.scopeKey);
  const graphName = useDagWorkbenchStore((state) => state.graphName);
  const graph = useDagWorkbenchStore((state) => state.graph);
  const draftGraphText = useDagWorkbenchStore((state) => state.draftGraphText);
  const draftParseError = useDagWorkbenchStore((state) => state.draftParseError);
  const validation = useDagWorkbenchStore((state) => state.validation);
  const latestSummary = useDagWorkbenchStore((state) => state.latestSummary);
  const simulationResult = useDagWorkbenchStore((state) => state.simulationResult);
  const simulationInput = useDagWorkbenchStore((state) => state.simulationInput);
  const simulationSummary = useDagWorkbenchStore((state) => state.simulationSummary);
  const hasUnsavedChanges = useDagWorkbenchStore((state) => state.hasUnsavedChanges);
  const lastLoadedVersion = useDagWorkbenchStore((state) => state.lastLoadedVersion);
  const selectedNodeId = useDagWorkbenchStore((state) => state.selectedNodeId);
  const canvasTab = useDagWorkbenchStore((state) => state.canvasTab);
  const connectionDraft = useDagWorkbenchStore((state) => state.connectionDraft);
  const cycleErrors = useDagWorkbenchStore((state) => state.cycleErrors);
  const topologyStatus = useDagWorkbenchStore((state) => state.topologyStatus);
  const setScopeKey = useDagWorkbenchStore((state) => state.setScopeKey);
  const setGraphName = useDagWorkbenchStore((state) => state.setGraphName);
  const setDraftGraphText = useDagWorkbenchStore((state) => state.setDraftGraphText);
  const setDraftParseError = useDagWorkbenchStore((state) => state.setDraftParseError);
  const setSimulationInputField = useDagWorkbenchStore((state) => state.setSimulationInputField);
  const hydrateGraph = useDagWorkbenchStore((state) => state.hydrateGraph);
  const markGraphSaved = useDagWorkbenchStore((state) => state.markGraphSaved);
  const setValidation = useDagWorkbenchStore((state) => state.setValidation);
  const setLatestSummary = useDagWorkbenchStore((state) => state.setLatestSummary);
  const setSimulationResult = useDagWorkbenchStore((state) => state.setSimulationResult);
  const setSimulationSummary = useDagWorkbenchStore((state) => state.setSimulationSummary);
  const setCanvasTab = useDagWorkbenchStore((state) => state.setCanvasTab);
  const selectNode = useDagWorkbenchStore((state) => state.selectNode);
  const addNode = useDagWorkbenchStore((state) => state.addNode);
  const updateNode = useDagWorkbenchStore((state) => state.updateNode);
  const removeNode = useDagWorkbenchStore((state) => state.removeNode);
  const replaceGraph = useDagWorkbenchStore((state) => state.replaceGraph);
  const connectNodes = useDagWorkbenchStore((state) => state.connectNodes);
  const disconnectNodes = useDagWorkbenchStore((state) => state.disconnectNodes);
  const upsertVariable = useDagWorkbenchStore((state) => state.upsertVariable);
  const removeVariable = useDagWorkbenchStore((state) => state.removeVariable);
  const setConnectionDraft = useDagWorkbenchStore((state) => state.setConnectionDraft);
  const clearConnectionDraft = useDagWorkbenchStore((state) => state.clearConnectionDraft);

  const mathRuntime = useDagMathRuntime(active);

  const graphQuery = useDagWorkbenchGraphQuery(scopeKey, { enabled: active });
  const summaryQuery = useDagWorkbenchSummaryQuery(scopeKey, { enabled: active });
  const saveGraphMutation = useSaveDagWorkbenchGraphMutation();
  const validateGraphMutation = useValidateDagWorkbenchGraphMutation();
  const simulateGraphMutation = useSimulateDagWorkbenchGraphMutation();

  useEffect(() => {
    const graphVersion = graphQuery.data?.data?.graph;
    if (graphVersion) {
      hydrateGraph(graphVersion);
    }
  }, [graphQuery.data, hydrateGraph]);

  useEffect(() => {
    const summary = summaryQuery.data?.data?.summary;
    if (summary) {
      setLatestSummary(summary);
    }
  }, [summaryQuery.data, setLatestSummary]);

  const parseDraftGraph = () => {
    try {
      const parsedGraph = normalizeDagGraph(JSON.parse(draftGraphText));
      setDraftParseError('');
      replaceGraph(parsedGraph);
      return parsedGraph;
    } catch (error) {
      setDraftParseError(error.message);
      return null;
    }
  };

  const handleValidate = async () => {
    const nextGraph = parseDraftGraph();
    if (!nextGraph) return;

    const response = await validateGraphMutation.mutateAsync({ scopeKey, graph: serializeDagGraphForApi(nextGraph) });
    setValidation(response?.data?.validation || null);
  };

  const handleSave = async () => {
    const nextGraph = parseDraftGraph();
    if (!nextGraph) return;

    const response = await saveGraphMutation.mutateAsync({
      scopeKey,
      name: graphName,
      graph: serializeDagGraphForApi(nextGraph),
    });
    markGraphSaved(response?.data?.graph || {});
  };

  const localEvaluation = useMemo(() => evaluateDagGraph({
    graph,
    simulationInput: toSimulationPayload(simulationInput),
    evaluateExpression: mathRuntime.evaluateExpression,
  }), [graph, mathRuntime.evaluateExpression, simulationInput]);

  useEffect(() => {
    if (!selectedNodeId && graph.nodes[0]?.id) {
      selectNode(graph.nodes[0].id);
    }
  }, [graph.nodes, selectedNodeId, selectNode]);

  useEffect(() => {
    setSimulationSummary(localEvaluation.outputsByVariable);
  }, [localEvaluation.outputsByVariable, setSimulationSummary]);

  const handleSimulate = async () => {
    const nextGraph = parseDraftGraph();
    if (!nextGraph) return;

    const response = await simulateGraphMutation.mutateAsync({
      scopeKey,
      graph: serializeDagGraphForApi(nextGraph),
      simulationInput: toSimulationPayload(simulationInput),
    });
    setValidation(response?.data?.validation || null);
    setSimulationResult(response?.data?.simulation || null);
    if (response?.data?.summary) {
      setLatestSummary(response.data.summary);
    }
  };

  const latestGraph = latestSummary?.latestGraph || null;
  const latestSimulation = latestSummary?.latestSimulation || null;
  const latestParityState = latestSimulation?.parity?.passed;
  const latestFallbackReason = latestSimulation?.fallbackReason || null;
  const latestParityLabel = latestSimulation
    ? latestParityState
      ? t('loans.dagWorkbench.summary.parityPassed')
      : t('loans.dagWorkbench.summary.parityFailed')
    : t('common.values.notAvailable');
  const latestSourceLabel = latestSimulation?.selectedSource || t('common.values.notAvailable');
  const isBusy = saveGraphMutation.isPending || validateGraphMutation.isPending || simulateGraphMutation.isPending;
  const queryError = graphQuery.error?.status === 404 ? null : graphQuery.error || summaryQuery.error;
  const mutationError = saveGraphMutation.error || validateGraphMutation.error || simulateGraphMutation.error;
  const combinedError = draftParseError || mathRuntime.error || queryError?.message || mutationError?.message || '';
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNodeConnections = selectedNode ? getNodeConnections(graph, selectedNode.id) : { incoming: [], outgoing: [] };
  const summary = useMemo(() => buildDagSummary(graph), [graph]);
  const validationItems = useMemo(() => {
    if (!validation) return [];

    const errors = Array.isArray(validation.errors) ? validation.errors.map((item) => ({ ...item, tone: 'error' })) : [];
    const warnings = Array.isArray(validation.warnings) ? validation.warnings.map((item) => ({ ...item, tone: 'warning' })) : [];
    return [...errors, ...warnings];
  }, [validation]);
  const topologyTone = topologyStatus === 'valid' ? 'success' : topologyStatus === 'invalid' ? 'danger' : 'warning';
  const topologyLabel = topologyStatus === 'valid'
    ? 'Topology ready'
    : topologyStatus === 'invalid'
      ? 'Topology blocked'
      : 'Topology pending';

  if (!active) {
    return null;
  }

  return (
    <section className="surface-card loans-dag-workbench">
      <div className="surface-card__body loans-dag-workbench__shell">
        <div className="loans-dag-workbench__toolbar-row">
          <Input
            label={t('loans.dagWorkbench.fields.scopeKey')}
            value={scopeKey}
            onChange={(event) => setScopeKey(event.target.value)}
            placeholder="personal-loan"
          />
          <Input
            label={t('loans.dagWorkbench.fields.graphName')}
            value={graphName}
            onChange={(event) => setGraphName(event.target.value)}
          />
          <div className="loans-dag-workbench__status-cluster">
            <span className="status-note">{t('loans.dagWorkbench.access', { role: user.role })}</span>
            <span className="status-note">{hasUnsavedChanges ? t('loans.dagWorkbench.status.unsaved') : t('loans.dagWorkbench.status.synced')}</span>
            <span className="status-note">{latestSourceLabel} / {latestParityLabel}</span>
            {latestFallbackReason ? <span className="status-note">{t('loans.dagWorkbench.summary.fallbackReason', { reason: latestFallbackReason })}</span> : null}
          </div>
        </div>

        <div className="inline-message loans-dag-workbench__identity-note">
          {t('loans.dagWorkbench.eyebrow')}
        </div>

        <DagWorkbenchHeader
          title={t('loans.dagWorkbench.title')}
          subtitle={t('loans.dagWorkbench.subtitle')}
          topologyTone={topologyTone}
          topologyLabel={topologyLabel}
          activeTab={canvasTab}
          onChangeTab={setCanvasTab}
          onAddNode={() => addNode('formula')}
          onRefresh={() => {
            graphQuery.refetch();
            summaryQuery.refetch();
          }}
          refreshing={graphQuery.isFetching || summaryQuery.isFetching}
        />

        {combinedError ? <div className="inline-message inline-message--error">⚠️ {combinedError}</div> : null}
        {graphQuery.isLoading || summaryQuery.isLoading ? (
          <StatePanel
            icon="⏳"
            title={t('loans.dagWorkbench.loadingTitle')}
            message={t('loans.dagWorkbench.loadingMessage')}
            loadingState
          />
        ) : null}

        {!graphQuery.isLoading && graphQuery.error?.status === 404 ? (
          <div className="inline-message">{t('loans.dagWorkbench.emptyGraph')}</div>
        ) : null}

        <div className="loans-dag-workbench__layout">
          <DagWorkbenchSidebar
            variables={graph.variables}
            simulationInput={simulationInput}
            summary={summary}
            onVariableChange={(id, updates) => {
              const variable = graph.variables.find((item) => item.id === id);
              upsertVariable({ ...variable, ...updates, id });
            }}
            onAddVariable={() => upsertVariable({ key: `var_${graph.variables.length + 1}`, value: '0' })}
            onRemoveVariable={removeVariable}
            onSimulationInputChange={setSimulationInputField}
          />

          <div className="loans-dag-workbench__main">
            <div className="action-stack loans-dag-workbench__main-actions">
              <Button size="sm" variant="outline" disabled={isBusy} onClick={handleValidate}>
                {validateGraphMutation.isPending ? t('loans.dagWorkbench.actions.validating') : t('loans.dagWorkbench.actions.validate')}
              </Button>
              <Button size="sm" disabled={isBusy} onClick={handleSave}>
                {saveGraphMutation.isPending ? t('loans.dagWorkbench.actions.saving') : t('loans.dagWorkbench.actions.save')}
              </Button>
              <Button size="sm" variant="success" disabled={isBusy} onClick={handleSimulate}>
                {simulateGraphMutation.isPending ? t('loans.dagWorkbench.actions.simulating') : t('loans.dagWorkbench.actions.simulate')}
              </Button>
            </div>

            {canvasTab === 'canvas' ? (
              <DagWorkbenchCanvas
                graph={graph}
                selectedNodeId={selectedNodeId}
                validation={validation}
                cycleErrors={cycleErrors}
                outputsByNodeId={localEvaluation.outputsByNodeId}
                onSelectNode={selectNode}
                onRemoveNode={removeNode}
                onMoveNode={(nodeId, position) => updateNode(nodeId, { position })}
              />
            ) : (
              <DagWorkbenchTableView
                simulationResult={simulationResult}
                outputsByVariable={simulationSummary || localEvaluation.outputsByVariable}
              />
            )}

            <label className="loans-dag-workbench__editor">
              <span>{t('loans.dagWorkbench.fields.graphJson')}</span>
              <textarea
                className="form-control loans-dag-workbench__textarea"
                value={draftGraphText}
                onChange={(event) => setDraftGraphText(event.target.value)}
                spellCheck={false}
              />
            </label>

            <div className="metric-grid loans-dag-workbench__summary-grid">
              <div className="metric-card metric-card--brand">
                <div className="metric-card__label">{t('loans.dagWorkbench.summary.latestVersion')}</div>
                <div className="metric-card__value">{lastLoadedVersion || latestGraph?.version || t('common.values.notAvailable')}</div>
                <div className="metric-card__caption">{latestGraph?.name || graphName}</div>
              </div>
              <div className="metric-card metric-card--info">
                <div className="metric-card__label">{t('loans.dagWorkbench.summary.nodeCount')}</div>
                <div className="metric-card__value">{latestGraph?.graphSummary?.nodeCount ?? validation?.summary?.nodeCount ?? summary.nodeCount}</div>
                <div className="metric-card__caption">{t('loans.dagWorkbench.summary.edgeCountLabel', { count: latestGraph?.graphSummary?.edgeCount ?? validation?.summary?.edgeCount ?? summary.edgeCount })}</div>
              </div>
              <div className="metric-card metric-card--warning">
                <div className="metric-card__label">{t('loans.dagWorkbench.summary.selectedSource')}</div>
                <div className="metric-card__value">{latestSourceLabel}</div>
                <div className="metric-card__caption">{latestParityLabel}</div>
              </div>
              <div className="metric-card metric-card--success">
                <div className="metric-card__label">{t('loans.dagWorkbench.summary.schedulePreview')}</div>
                <div className="metric-card__value">{simulationResult?.schedule?.length || latestSimulation?.schedulePreview?.length || 0}</div>
                <div className="metric-card__caption">{t('loans.dagWorkbench.summary.latestScope', { scopeKey })}</div>
              </div>
            </div>

            {validation ? (
              <div className="loans-dag-workbench__panel section-margin-bottom">
                <div className="section-eyebrow">{t('loans.dagWorkbench.validation.eyebrow')}</div>
                <div className="section-title">{validation.valid ? t('loans.dagWorkbench.validation.validTitle') : t('loans.dagWorkbench.validation.invalidTitle')}</div>
                <div className="section-subtitle">
                  {t('loans.dagWorkbench.validation.summary', {
                    errors: validation.errors?.length || 0,
                    warnings: validation.warnings?.length || 0,
                  })}
                </div>
                {validationItems.length ? (
                  <div className="table-inline-stack table-inline-stack--stretch">
                    {validationItems.map((item) => (
                      <span key={`${item.tone}-${item.field}-${item.message}`} className="status-note">
                        {item.field}: {item.message}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {simulationResult ? (
              <div className="loans-dag-workbench__panel">
                <div className="section-eyebrow">{t('loans.dagWorkbench.simulation.eyebrow')}</div>
                <div className="section-title">{t('loans.dagWorkbench.simulation.title')}</div>
                <div className="section-subtitle">{t('loans.dagWorkbench.simulation.subtitle')}</div>
                <div className="table-inline-stack table-inline-stack--stretch">
                  <span className="status-note">
                    {t('loans.dagWorkbench.simulation.installments', { count: simulationResult.schedule?.length || 0 })}
                  </span>
                  <span className="status-note">
                    {t('loans.dagWorkbench.simulation.totalPayable', { value: simulationResult.summary?.totalPayable ?? t('common.values.notAvailable') })}
                  </span>
                  <span className="status-note">
                    {t('loans.dagWorkbench.simulation.monthlyInstallment', { value: simulationResult.summary?.monthlyInstallment ?? t('common.values.notAvailable') })}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <DagWorkbenchInspector
            node={selectedNode}
            graph={graph}
            connectionDraft={connectionDraft}
            connections={selectedNodeConnections}
            variables={graph.variables}
            validationMessages={validationItems.filter((item) => item.field?.includes(selectedNode?.id || '') || item.field === selectedNode?.outputVar).map((item) => item.message)}
            runtime={mathRuntime}
            onUpdateNode={updateNode}
            onAppendFormula={(token) => {
              if (!selectedNode) {
                return;
              }

              const joiner = selectedNode.formula.trim() ? ' ' : '';
              updateNode(selectedNode.id, { formula: `${selectedNode.formula}${joiner}${token}` });
            }}
            onSetConnectionDraft={setConnectionDraft}
            onConnectNodes={() => connectNodes(connectionDraft.sourceNodeId && connectionDraft.targetNodeId
              ? connectionDraft
              : { sourceNodeId: selectedNode?.id || '', targetNodeId: connectionDraft.targetNodeId || '' })}
            onDisconnectNodes={(payload) => {
              disconnectNodes(payload);
              clearConnectionDraft();
            }}
          />
        </div>
      </div>
    </section>
  );
}

export default LoansDagWorkbenchSection;
