import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Loader2, X } from 'lucide-react';
import dagService from '../services/dagService';
import { queryKeys } from '../services/queryKeys';
import { DagVariable, VariableType, VariableSource } from '../types/dag';
import { toast } from '../lib/toast';

const VARIABLE_TYPES: VariableType[] = ['integer', 'currency', 'boolean', 'float'];
const VARIABLE_SOURCES: VariableSource[] = ['bureau_api', 'app_data', 'system_core'];

export default function VariableRegistryPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'integer' as VariableType,
    source: 'app_data' as VariableSource,
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: variablesData, isLoading } = useQuery({
    queryKey: queryKeys.dag.variables(),
    queryFn: () => dagService.listVariables(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; type: VariableType; source: VariableSource; description?: string }) =>
      dagService.createVariable(payload),
    onSuccess: () => {
      toast.success({ description: 'Variable creada exitosamente' });
      queryClient.invalidateQueries({ queryKey: queryKeys.dag.variables() });
      setIsModalOpen(false);
      setForm({ name: '', type: 'integer', source: 'app_data', description: '' });
      setFormErrors({});
    },
    onError: (err: any) => {
      toast.error({ description: err.message || 'Error al crear variable' });
    },
  });

  const variables = variablesData?.data?.variables ?? [];

  const filtered = variables.filter((v: DagVariable) => {
    if (filterType !== 'all' && v.type !== filterType) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = 'El nombre es obligatorio';
    } else if (!/^[a-zA-Z_]\w*$/.test(form.name.trim())) {
      errors.name = 'Solo letras, numeros y guiones bajos. Debe empezar con letra o underscore.';
    }
    if (!form.type) errors.type = 'El tipo es obligatorio';
    if (!form.source) errors.source = 'La fuente es obligatoria';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    createMutation.mutate({
      name: form.name.trim(),
      type: form.type,
      source: form.source,
      description: form.description.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Registro de Variables</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
        >
          <Plus size={16} />
          Nueva Variable
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar variables..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary"
        >
          <option value="all">Todos los tipos</option>
          <option value="integer">Integer</option>
          <option value="currency">Currency</option>
          <option value="boolean">Boolean</option>
          <option value="float">Float</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-surface text-sm text-text-primary"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface border-b border-border-subtle">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Fuente</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Uso</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Descripcion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No se encontraron variables con estos filtros.
                </td>
              </tr>
            ) : (
              filtered.map((v: DagVariable) => (
                <tr
                  key={v.id}
                  className={`hover:bg-hover-bg/50 transition-colors ${v.status === 'deprecated' ? 'bg-error-container/10' : ''}`}
                >
                  <td className={`px-4 py-3 font-mono font-medium ${v.status === 'deprecated' ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                    {v.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-bg-base border border-border-subtle text-xs text-text-secondary">{v.type}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{v.source}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        v.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : v.status === 'deprecated'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{v.usageCount}</td>
                  <td className="px-4 py-3 text-text-secondary">{v.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-bg-surface rounded-2xl border border-border-subtle shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Nueva Variable</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ej: credit_score"
                  className={`w-full px-3 py-2 rounded-lg border bg-bg-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary ${
                    formErrors.name ? 'border-red-300' : 'border-border-subtle'
                  }`}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as VariableType })}
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                  >
                    {VARIABLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Fuente</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value as VariableSource })}
                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                  >
                    {VARIABLE_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Descripcion</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripcion opcional de la variable"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-base text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {createMutation.isPending ? 'Creando...' : 'Crear Variable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
