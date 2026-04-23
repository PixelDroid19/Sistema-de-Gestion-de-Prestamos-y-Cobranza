import { apiClient } from '../api/client';
import type { VariableListResponse, DagVariable } from '../types/dag';

export type VariableFilters = Record<string, string | number | undefined>;

export const variableService = {
  async list(filters: VariableFilters = {}): Promise<VariableListResponse> {
    const { data } = await apiClient.get('/loans/workbench/variables', { params: filters });
    return data;
  },

  async create(payload: Omit<DagVariable, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data: { variable: DagVariable } }> {
    const { data } = await apiClient.post('/loans/workbench/variables', payload);
    return data;
  },

  async update(id: number, payload: Partial<Omit<DagVariable, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{ success: boolean; data: { variable: DagVariable } }> {
    const { data } = await apiClient.patch(`/loans/workbench/variables/${id}`, payload);
    return data;
  },

  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`/loans/workbench/variables/${id}`);
    return data;
  },
};

export default variableService;
