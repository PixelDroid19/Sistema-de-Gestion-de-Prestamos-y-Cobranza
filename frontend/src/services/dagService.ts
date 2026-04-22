import { apiClient } from '../api/client';
import {
  LoadGraphResponse,
  SaveGraphRequest,
  SaveGraphResponse,
  SimulateGraphRequest,
  SimulateGraphResponse,
  ValidateGraphRequest,
  ValidateGraphResponse,
  GraphListResponse,
  GraphDetailsResponse,
  GraphStatusUpdateResponse,
  GraphDeleteResponse,
  DagWorkbenchScopesResponse,
  DagGraphStatus,
  SimulationInput,
  SimulationResponse,
  GraphHistoryResponse,
  GraphDiffResponse,
} from '../types/dag';

/**
 * DAG Workbench API Service
 * Compatible with backend routes mounted at /credits/*
 */
export const dagService = {
  async listScopes(): Promise<DagWorkbenchScopesResponse> {
    const { data } = await apiClient.get('/loans/workbench/scopes');
    return data;
  },

  /**
   * GET /api/v1/credits/workbench/graph?scope={scopeKey}
   * Load an existing graph from the workbench
   */
  async loadGraph(scopeKey: string): Promise<LoadGraphResponse> {
    const { data } = await apiClient.get('/loans/workbench/graph', { 
      params: { scope: scopeKey } 
    });
    return data;
  },

  /**
   * POST /api/v1/loans/workbench/graph
   * Save a new graph or update existing
   */
  async saveGraph(payload: SaveGraphRequest): Promise<SaveGraphResponse> {
    const { data } = await apiClient.post('/loans/workbench/graph', payload);
    return data;
  },

  /**
   * POST /api/v1/loans/workbench/graph/validate
   * Validate a graph without saving
   */
  async validateGraph(payload: ValidateGraphRequest): Promise<ValidateGraphResponse> {
    const { data } = await apiClient.post('/loans/workbench/graph/validate', payload);
    return data;
  },

  /**
   * POST /api/v1/loans/workbench/graph/simulations
   * Simulate a graph with given inputs
   */
  async simulateGraph(payload: SimulateGraphRequest): Promise<SimulateGraphResponse> {
    const { data } = await apiClient.post('/loans/workbench/graph/simulations', payload);
    return data;
  },

  /**
   * POST /api/v1/loans/simulations
   * Run a simple credit simulation (without custom graph)
   */
  async simulate(input: SimulationInput): Promise<SimulationResponse> {
    const { data } = await apiClient.post('/loans/simulations', input);
    return data;
  },

  // ── Formula Management Endpoints ─────────────────────────────────────────

  /**
   * GET /api/v1/loans/workbench/graphs?scope={scopeKey}
   * List all graphs/formulas for a scope with usage count
   */
  async listGraphs(scopeKey: string): Promise<GraphListResponse> {
    const { data } = await apiClient.get('/loans/workbench/graphs', {
      params: { scope: scopeKey },
    });
    return data;
  },

  /**
   * GET /api/v1/loans/workbench/graphs/:id
   * Get details of a specific graph/formula with usage count
   */
  async getGraphDetails(graphId: number): Promise<GraphDetailsResponse> {
    const { data } = await apiClient.get(`/loans/workbench/graphs/${graphId}`);
    return data;
  },

  /**
   * PATCH /api/v1/loans/workbench/graphs/:id/status
   * Update graph status (activate/deactivate)
   */
  async updateGraphStatus(graphId: number, status: DagGraphStatus): Promise<GraphStatusUpdateResponse> {
    const { data } = await apiClient.patch(`/loans/workbench/graphs/${graphId}/status`, { status });
    return data;
  },

  /**
   * DELETE /api/v1/loans/workbench/graphs/:id
   * Delete a graph (only if unused by any loans)
   */
  async deleteGraph(graphId: number): Promise<GraphDeleteResponse> {
    const { data } = await apiClient.delete(`/loans/workbench/graphs/${graphId}`);
    return data;
  },

  // ── Graph History & Diff Endpoints ───────────────────────────────────────

  async getGraphHistory(graphId: number): Promise<GraphHistoryResponse> {
    const { data } = await apiClient.get(`/loans/workbench/graphs/${graphId}/history`);
    return data;
  },

  async getGraphDiff(graphId: number, compareToVersionId: number): Promise<GraphDiffResponse> {
    const { data } = await apiClient.get(`/loans/workbench/graphs/${graphId}/diff`, {
      params: { compareToVersionId },
    });
    return data;
  },

  async restoreGraph(graphId: number, commitMessage?: string): Promise<SaveGraphResponse> {
    const { data } = await apiClient.post(`/loans/workbench/graphs/${graphId}/restore`, {
      commitMessage,
    });
    return data;
  },

};

export default dagService;
