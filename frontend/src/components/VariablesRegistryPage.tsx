import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Loader2, Trash2, AlertCircle, Pencil, ArrowRight, Database, ShieldCheck } from 'lucide-react';
import { variableService } from '../services/variableService';
import { queryKeys } from '../services/queryKeys';
import { toast } from '../lib/toast';
import { confirm as confirmModal } from '../lib/confirmModal';
import type { DagVariable, VariableType, VariableSource, VariableStatus } from '../types/dag';
import { FORMULA_INPUT_OPTIONS, FORMULA_TARGET_OPTIONS, getInputKindLabel } from '../lib/formulaDisplay';

const TYPE_OPTIONS: VariableType[] = ['integer', 'currency', 'boolean', 'percent'];
const SOURCE_OPTIONS: VariableSource[] = ['bureau_api', 'app_data', 'system_core'];
const STATUS_OPTIONS: VariableStatus[] = ['active', 'idle', 'deprecated'];

const TYPE_LABELS: Record<VariableType, string> = {
  integer: 'Número entero',
  currency: 'Moneda',
  boolean: 'Sí / No',
  percent: 'Porcentaje',
};

const SOURCE_LABELS: Record<VariableSource, string> = {
  bureau_api: 'Buró / integración',
  app_data: 'Datos del crédito',
  system_core: 'Sistema',
};

const STATUS_LABELS: Record<VariableStatus, string> = {
  active: 'Activa',
  idle: 'Sin uso',
  deprecated: 'Retirada',
};

const SYSTEM_VARIABLES = FORMULA_INPUT_OPTIONS.map((variable) => ({
  ...variable,
  sourceLabel: 'Datos reales del credito',
  roleLabel: 'Entrada',
}));

const SYSTEM_OUTPUTS = FORMULA_TARGET_OPTIONS.map((variable) => ({
  ...variable,
  sourceLabel: 'Calculado por formula activa',
  roleLabel: 'Resultado editable',
}));

const validateVariableForm = (form: {
  name: string;
  type: VariableType;
  value: string;
}) => {
  const normalizedName = form.name.trim();
  if (!/^[a-z][a-z0-9_]*$/u.test(normalizedName)) {
    return 'El identificador debe empezar con letra minúscula y usar solo letras, números o guion bajo.';
  }

  if (form.value.trim() === '') {
    return null;
  }

  if ((form.type === 'integer' || form.type === 'currency' || form.type === 'percent') && !Number.isFinite(Number(form.value))) {
    return 'El valor por defecto debe ser numérico para este tipo de variable.';
  }

  if (form.type === 'boolean' && !['true', 'false', '1', '0', 'si', 'no', 'sí'].includes(form.value.trim().toLowerCase())) {
    return 'El valor Sí / No debe ser true, false, 1, 0, sí o no.';
  }

  return null;
};

export default function VariablesRegistryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ type: '', source: '', status: '' });
  const [search, setSearch] = useState('');
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
  const filteredVariables = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return variables;
    return variables.filter((variable: DagVariable) => (
      variable.name.toLowerCase().includes(needle)
      || String(variable.description || '').toLowerCase().includes(needle)
      || TYPE_LABELS[variable.type]?.toLowerCase().includes(needle)
      || SOURCE_LABELS[variable.source]?.toLowerCase().includes(needle)
      || STATUS_LABELS[variable.status]?.toLowerCase().includes(needle)
    ));
  }, [search, variables]);
  const activeCount = variables.filter((variable: DagVariable) => variable.status === 'active').length;
  const idleCount = variables.filter((variable: DagVariable) => variable.status === 'idle').length;
  const deprecatedCount = variables.filter((variable: DagVariable) => variable.status === 'deprecated').length;

  const invalidateVariableLists = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.variables.all });
    await queryClient.invalidateQueries({ queryKey: ['variables.list'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => variableService.create(payload),
    onSuccess: async () => {
      toast.success({ description: 'Variable creada' });
      await invalidateVariableLists();
      closeModal();
    },
    onError: (err: any) => {
      toast.error({ description: err?.response?.data?.error?.message || err.message || 'Error al crear variable' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<typeof form> }) => variableService.update(id, payload),
    onSuccess: async () => {
      toast.success({ description: 'Variable actualizada' });
      await invalidateVariableLists();
      closeModal();
    },
    onError: (err: any) => {
      toast.error({ description: err?.response?.data?.error?.message || err.message || 'Error al actualizar variable' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => variableService.delete(id),
    onSuccess: async () => {
      toast.success({ description: 'Variable eliminada' });
      await invalidateVariableLists();
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
    const validationError = validateVariableForm(form);
    if (validationError) {
      toast.error({ description: validationError });
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      value: form.value.trim(),
      description: form.description.trim(),
    };

    if (editingVariable) {
      updateMutation.mutate({ id: editingVariable.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (variable: DagVariable) => {
    const confirmed = await confirmModal({
      title: 'Eliminar variable',
      message: `¿Seguro que quieres eliminar "${variable.name}"? Solo se pueden eliminar variables sin uso.`,
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
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">Variables de fórmulas</h2>
          <p className="text-text-secondary mt-1 max-w-3xl text-sm leading-6">
            Datos que puede usar la formula real de creditos. Las variables del sistema vienen del credito; las personalizadas activas se inyectan con su valor por defecto al calcular creditos nuevos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => navigate('/formulas/new')}
            className="flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-hover-bg"
          >
            Abrir editor <ArrowRight size={16} />
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nueva variable
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            <ShieldCheck size={15} className="text-emerald-700" /> Activas
          </div>
          <div className="text-2xl font-bold text-text-primary">{activeCount}</div>
          <p className="mt-1 text-xs text-text-secondary">Se inyectan al calculo real si la formula las usa.</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            <Database size={15} className="text-brand-primary" /> Del sistema
          </div>
          <div className="text-2xl font-bold text-text-primary">{SYSTEM_VARIABLES.length}</div>
          <p className="mt-1 text-xs text-text-secondary">Monto, tasa, plazo, mora y fecha del credito.</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
            <AlertCircle size={15} className="text-amber-700" /> Sin uso / retiradas
          </div>
          <div className="text-2xl font-bold text-text-primary">{idleCount + deprecatedCount}</div>
          <p className="mt-1 text-xs text-text-secondary">Se conservan para trazabilidad y limpieza controlada.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-surface shadow-sm">
        <div className="border-b border-border-subtle px-4 py-4">
          <h3 className="text-lg font-bold text-text-primary">Variables operativas del credito</h3>
          <p className="mt-1 text-sm text-text-secondary">Estas ya alimentan el editor visual y la formula activa usada al crear creditos.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {[...SYSTEM_VARIABLES, ...SYSTEM_OUTPUTS].map((variable) => (
            <div key={`${variable.roleLabel}-${variable.key}`} className="rounded-lg border border-border-subtle bg-bg-base p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-text-primary">{variable.label}</div>
                  <div className="mt-1 font-mono text-xs text-brand-primary">{variable.key}</div>
                </div>
                <span className="rounded-full border border-border-subtle bg-bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                  {variable.roleLabel}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{variable.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-text-secondary">{variable.sourceLabel}</span>
                <span className="font-semibold text-text-primary">{getInputKindLabel(variable.valueKind)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(0,220px))]">
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <Search size={16} className="text-text-secondary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            placeholder="Buscar variable personalizada..."
          />
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <select
            value={filters.type}
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">Todos los tipos</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <select
            value={filters.source}
            onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">Todos los orígenes</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2">
          <select
            value={filters.status}
            onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-border-subtle px-4 py-4">
          <h3 className="text-lg font-bold text-text-primary">Variables personalizadas</h3>
          <p className="mt-1 text-sm text-text-secondary">Úsalas para parametrizar reglas sin tocar codigo. Ejemplo: recargo administrativo, tasa preferencial o tope interno.</p>
        </div>
        <div className="divide-y divide-border-subtle md:hidden">
          {isLoading ? (
            <div className="px-5 py-8 text-center">
              <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
            </div>
          ) : filteredVariables.length === 0 ? (
            <div className="space-y-3 px-5 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">No hay variables personalizadas con estos filtros.</p>
              <p className="text-xs leading-5 text-text-secondary">Crea una variable activa para que el calculo real pueda usarla como parametro.</p>
            </div>
          ) : (
            filteredVariables.map((v: DagVariable) => (
              <article key={v.id} className={`space-y-3 px-4 py-4 ${v.status === 'deprecated' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className={`truncate font-bold text-text-primary ${v.status === 'deprecated' ? 'line-through' : ''}`}>{v.name}</h4>
                    <p className="mt-1 text-xs text-text-secondary">{v.description || 'Sin descripcion'}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    v.status === 'active' ? 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200' :
                    v.status === 'deprecated' ? 'border-red-200 bg-red-100 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200' :
                    'border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-200'
                  }`}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2">
                    <div className="font-bold uppercase tracking-wide text-text-secondary">Tipo</div>
                    <div className="mt-1 font-semibold text-text-primary">{TYPE_LABELS[v.type] ?? v.type}</div>
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-bg-base px-3 py-2">
                    <div className="font-bold uppercase tracking-wide text-text-secondary">Valor</div>
                    <div className="mt-1 font-mono font-semibold text-text-primary">{v.value ?? '-'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => openModal(v)} className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-primary hover:bg-hover-bg">Editar</button>
                  {v.status !== 'deprecated' && (
                    <button onClick={() => handleDeprecate(v)} disabled={updateMutation.isPending} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60">Retirar</button>
                  )}
                  <button onClick={() => handleDelete(v)} disabled={deleteMutation.isPending} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-60">Eliminar</button>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-bg-surface border-b border-border-subtle text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Variable</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Origen</th>
                <th className="px-5 py-3">Valor por defecto</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-primary" size={24} />
                  </td>
                </tr>
              ) : filteredVariables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-secondary">
                    No hay variables personalizadas con estos filtros.
                  </td>
                </tr>
              ) : (
                filteredVariables.map((v: DagVariable) => (
                  <tr key={v.id} className={`hover:bg-hover-bg/50 transition-colors group ${v.status === 'deprecated' ? 'opacity-60' : ''}`}>
                    <td className={`px-5 py-3 font-medium text-text-primary ${v.status === 'deprecated' ? 'line-through' : ''}`}>
                      {v.name}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{TYPE_LABELS[v.type] ?? v.type}</td>
                    <td className="px-5 py-3 text-text-secondary">{SOURCE_LABELS[v.source] ?? v.source}</td>
                    <td className="px-5 py-3 font-mono text-text-secondary">{v.value ?? '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${
                        v.status === 'active' ? 'border border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200' :
                        v.status === 'deprecated' ? 'border border-red-200 bg-red-100 text-red-900 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-200' :
                        'border border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-200'
                      }`}>
                        {v.status === 'deprecated' && <AlertCircle size={12} />}
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal(v)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-brand-primary hover:bg-hover-bg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        {v.status !== 'deprecated' && (
                          <button
                            onClick={() => handleDeprecate(v)}
                            disabled={updateMutation.isPending}
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30"
                            title="Retirar"
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
          <div className="flex flex-col gap-3 px-5 py-3 border-t border-border-subtle sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-text-secondary">
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg disabled:opacity-40"
              >
                Siguiente
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
                {editingVariable ? 'Editar variable' : 'Nueva variable'}
              </h3>
              <button onClick={closeModal} className="text-text-secondary hover:text-text-primary transition-colors">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Identificador</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  placeholder="ej. tasa_anual"
                />
                <p className="mt-1 text-xs text-text-secondary">Nombre técnico interno, visible solo para administradores.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as VariableType }))}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  >
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Origen</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as VariableSource }))}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  >
                    {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Valor por defecto</label>
                <input
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  placeholder="Valor usado si no llega desde el crédito"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VariableStatus }))}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-primary resize-none"
                  placeholder="Uso esperado dentro de las fórmulas"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-hover-bg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingVariable ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
