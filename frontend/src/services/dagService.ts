import { apiClient } from '../api/client';
import {
  LoadGraphResponse,
  SaveGraphRequest,
  SaveGraphResponse,
  SimulateGraphRequest,
  SimulateGraphResponse,
  ValidateGraphRequest,
  ValidateGraphResponse,
  GraphSummaryResponse,
  SimulationInput,
  SimulationResponse,
} from '../types/dag';

/**
 * DAG Workbench API Service
 * Compatible with backend routes mounted at /credits/*
 */
export const dagService = {
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
   * GET /api/v1/loans/workbench/graph/summary?scope={scopeKey}
   * Get summary of latest graph and simulation
   */
  async getSummary(scopeKey: string): Promise<GraphSummaryResponse> {
    const { data } = await apiClient.get('/loans/workbench/graph/summary', { 
      params: { scope: scopeKey } 
    });
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
};

export default dagService;
