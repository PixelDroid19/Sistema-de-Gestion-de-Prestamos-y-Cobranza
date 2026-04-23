import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { variableService } from '../services/variableService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';
import type { DagVariable, VariableType, VariableSource, VariableStatus } from '../types/dag';

const TYPE_OPTIONS: VariableType[] = ['integer', 'currency', 'boolean', 'percent'];
const SOURCE_OPTIONS: VariableSource[] = ['bureau_api', 'app_data', 'system_core'];
const STATUS_OPTIONS: VariableStatus[] = ['active', 'idle', 'deprecated'];

export default function VariablesRegistryPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ type: '', source: '', status: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<DagVariable | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'integer' as VariableType,
    source: 'app_data' as VariableSource,
    value: '',
    status: 'active' as VariableStatus,
    description: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.variables.list({ ...filters, page, pageSize }),
    queryFn: () => variableService.list({ ...filters, page, pageSize }),
  });

  const variables = data?.data?.variables ?? [];
  const pagination = data?.data?.pagination;

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => variableService.create(payload),
    onSuccess: () => {
      toast.success({ description: 'Variable creada' });
      queryClient.invalidateQueries({ queryKey: queryKeys.variables.all });
      closeModal();
    },
    onError: (err: any) => {
      toast.error({ description: err?.response?.data?.error?.message || err.message || 'Error al crear variable' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<typeof form> }) => variableService.update(id, payload),
    onSuccess: () => {
      toast.success({ description: 'Variable actualizada' });
      queryClient.invalidateQueries({ queryKey: queryKeys.variables.all });
      closeModal();
    },
    onError: (err: any) => {
      toast.error({ description: err?.response?.data?.error?.message || err.message || 'Error al actualizar variable' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => variableService.delete(id),
    onSuccess: () => {
      toast.success({ description: 'Variable eliminada' });
      queryClient.invalidateQueries({ queryKey: queryKeys.variables.all });
    },
    onError: (err: any) => {
      toast.error({ description: err?.response?.data?.error?.message || err.message || 'Error al eliminar variable' });
    },
  });

  const openModal = (variable?: DagVariable) => {
    if (variable) {
      setEditingVariable(variable);
      setForm({
        name: variable.name,
        type: variable.type,
        source: variable.source,
        value: variable.value || '',
        status: variable.status,
        description: variable.description || '',
      });
    } else {
      setEditingVariable(null);
      setForm({ name: '', type: 'integer', source: 'app_data', value: '', status: 'active', description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVariable(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVariable) {
      updateMutation.mutate({ id: editingVariable.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = async (variable: DagVariable) => {
    const confirmed = await confirmModal({
      title: 'Eliminar Variable',
      message: `Seguro que queres eliminar "${variable.name}"?`,
      confirmLabel: 'Eliminar',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    deleteMutation.mutate(variable.id);
  };

  const handleDeprecate = (variable: DagVariable) => {
    updateMutation.mutate({ id: variable.id, payload: { status: 'deprecated' } });
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary">Variables Registry</h2>
          <p className="text-text-secondary mt-1 text-sm">Manage DAG variables used in credit formulas.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Variable
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <Search size={16} className="text-text-secondary" />
          <select
            value={filters.type}
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <Search size={16} className="text-text-secondary" />
          <select
            value={filters.source}
            onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <Search size={16} className="text-text-secondary" />
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-surface border-b border-border-subtle text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                  </td>
                </tr>
              ) : variables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-secondary">
                    No variables found. Create the first one to get started.
                  </td>
                </tr>
              ) : (
                variables.map((v: DagVariable) => (
                  <tr key={v.id} className={`hover:bg-hover-bg/50 transition-colors group ${v.status === 'deprecated' ? 'opacity-60' : ''}`}>
                    <td className={`px-5 py-3 font-medium text-text-primary ${v.status === 'deprecated' ? 'line-through' : ''}`}>
                      {v.name}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{v.type}</td>
                    <td className="px-5 py-3 text-text-secondary">{v.source}</td>
                    <td className="px-5 py-3 font-mono text-text-secondary">{v.value ?? '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
                        v.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        v.status === 'deprecated' ? 'bg-red-50 text-red-700' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {v.status === 'deprecated' && <AlertCircle size={12} />}
                        {v.status === 'active' ? 'Active' : v.status === 'deprecated' ? 'Dep' : 'Idle'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal(v)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-hover-bg transition-colors"
                          title="Editar"
                        >
                          <Search size={14} />
                        </button>
                        {v.status !== 'deprecated' && (
                          <button
                            onClick={() => handleDeprecate(v)}
                            disabled={updateMutation.isPending}
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30"
                            title="Deprecar"
                          >
                            <AlertCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
            <span className="text-xs text-text-secondary">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                {editingVariable ? 'Edit Variable' : 'New Variable'}
              </h3>
              <button onClick={closeModal} className="text-text-secondary hover:text-text-primary transition-colors">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  placeholder="e.g. rate"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as VariableType }))}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  >
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as VariableSource }))}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  >
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Value</label>
                <input
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  placeholder="Default value"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VariableStatus }))}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingVariable ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
