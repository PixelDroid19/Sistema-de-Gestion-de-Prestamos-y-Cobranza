import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  CreditCard,
  Percent,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useConfig } from '../services/configService';
import { toast } from '../lib/toast';
import { confirmDanger } from '../lib/confirmModal';
import { ActionButton, DataTableSurface, MetricCard, PageHeader, PageShell, ToolbarSurface } from './shared/Surfaces';
import { ExplainedChip, HelpLabel } from './shared/HelpSupport';

type SettingsTab = 'payment-methods' | 'rate-policies' | 'late-fee-policies';

type PaymentMethodDraft = {
  name: string;
  description: string;
  type: 'bank_transfer' | 'cash' | 'card' | 'other';
};

type RatePolicyDraft = {
  label: string;
  minAmount: string;
  maxAmount: string;
  annualEffectiveRate: string;
  priority: string;
  description: string;
};

type LateFeePolicyDraft = {
  label: string;
  annualEffectiveRate: string;
  lateFeeMode: 'NONE' | 'SIMPLE' | 'COMPOUND';
  priority: string;
  description: string;
};

const paymentMethodTypeLabels: Record<string, string> = {
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
  card: 'Tarjeta',
  other: 'Otro',
};

const lateFeeModeLabels: Record<string, string> = {
  NONE: 'Sin mora',
  SIMPLE: 'Mora simple',
  COMPOUND: 'Mora compuesta',
};

const normalizeComparable = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const formatCurrency = (value: unknown) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

const formatRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return 'Todos los montos';
  return `${hasMin ? formatCurrency(minAmount) : '$0'} - ${hasMax ? formatCurrency(maxAmount) : 'Sin tope'}`;
};

const getActiveCount = (items: Array<{ isActive?: boolean }>) => items.filter((item) => item.isActive !== false).length;

const getMethodName = (method: any) => method?.name || method?.label || method?.key || 'Método sin nombre';

const getMethodTypeLabel = (type: unknown) => {
  const normalizedType = String(type || 'other').trim().toLowerCase();
  return paymentMethodTypeLabels[normalizedType] || 'Otro';
};

const toOptionalDraftNumber = (value: string, fallback: number | null = null) => {
  if (value === '') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.NaN;
};

const getRangeBoundary = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback;
  return Number(value);
};

const rangesOverlap = (
  left: { minAmount?: unknown; maxAmount?: unknown },
  right: { minAmount?: unknown; maxAmount?: unknown },
) => {
  const leftMin = getRangeBoundary(left.minAmount, 0);
  const leftMax = getRangeBoundary(left.maxAmount, Number.POSITIVE_INFINITY);
  const rightMin = getRangeBoundary(right.minAmount, 0);
  const rightMax = getRangeBoundary(right.maxAmount, Number.POSITIVE_INFINITY);

  return leftMin <= rightMax && rightMin <= leftMax;
};

const validatePercent = (value: string, label: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    return `${label} debe estar entre 0 y 100.`;
  }
  return null;
};

const validatePriority = (value: string) => {
  const numericValue = Number(value || 100);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return 'La prioridad debe ser un número entero mayor o igual a 0.';
  }
  return null;
};

const buildRatePayload = (policy: RatePolicyDraft) => ({
  ...policy,
  annualEffectiveRate: Number(policy.annualEffectiveRate),
  minAmount: policy.minAmount === '' ? null : Number(policy.minAmount),
  maxAmount: policy.maxAmount === '' ? null : Number(policy.maxAmount),
  priority: Number(policy.priority || 100),
  isActive: true,
});

const validatePaymentMethodDraft = (draft: PaymentMethodDraft, paymentMethods: any[]) => {
  const name = draft.name.trim();
  if (!name) return 'Indica el nombre del método de pago.';

  const normalizedName = normalizeComparable(name);
  const duplicate = paymentMethods.some((method) => (
    normalizeComparable(getMethodName(method)) === normalizedName
    || normalizeComparable(method?.key) === normalizedName
  ));

  if (duplicate) {
    return 'Ya existe un método de pago con ese nombre.';
  }

  return null;
};

const validateRatePolicyDraft = (draft: RatePolicyDraft, ratePolicies: any[]) => {
  const label = draft.label.trim();
  if (!label) return 'Indica el nombre de la política de tasa.';

  const percentError = validatePercent(draft.annualEffectiveRate, 'La tasa efectiva anual');
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const minAmount = toOptionalDraftNumber(draft.minAmount, 0);
  const maxAmount = toOptionalDraftNumber(draft.maxAmount, null);
  if (!Number.isFinite(minAmount) || (maxAmount !== null && !Number.isFinite(maxAmount))) {
    return 'Los montos de la política deben ser numéricos.';
  }
  const normalizedMinAmount = Number(minAmount);
  const normalizedMaxAmount = maxAmount === null ? null : Number(maxAmount);
  if (normalizedMinAmount < 0 || (normalizedMaxAmount !== null && normalizedMaxAmount < 0)) {
    return 'Los montos de la política no pueden ser negativos.';
  }
  if (normalizedMaxAmount !== null && normalizedMinAmount > normalizedMaxAmount) {
    return 'El monto mínimo no puede ser mayor que el monto máximo.';
  }

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = ratePolicies.some((policy) => normalizeComparable(policy?.label) === normalizedLabel);
  if (duplicateLabel) {
    return 'Ya existe una política de tasa con ese nombre.';
  }

  const priority = Number(draft.priority || 100);
  const overlap = ratePolicies.some((policy) => (
    policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
    && rangesOverlap({ minAmount: normalizedMinAmount, maxAmount: normalizedMaxAmount }, policy)
  ));
  if (overlap) {
    return 'Ya existe una política activa con el mismo rango y prioridad. Ajusta el rango o la prioridad para evitar cálculos ambiguos.';
  }

  return null;
};

const validateLateFeePolicyDraft = (draft: LateFeePolicyDraft, lateFeePolicies: any[]) => {
  const label = draft.label.trim();
  if (!label) return 'Indica el nombre de la política de mora.';

  const percentError = validatePercent(draft.annualEffectiveRate, 'La tasa de mora');
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = lateFeePolicies.some((policy) => normalizeComparable(policy?.label) === normalizedLabel);
  if (duplicateLabel) {
    return 'Ya existe una política de mora con ese nombre.';
  }

  const priority = Number(draft.priority || 100);
  const duplicatePriority = lateFeePolicies.some((policy) => (
    policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
  ));
  if (duplicatePriority) {
    return 'Ya existe una política de mora activa con esa prioridad. Usa una prioridad distinta para que el sistema sepa cuál aplicar.';
  }

  return null;
};

const buildLateFeePayload = (policy: LateFeePolicyDraft) => ({
  ...policy,
  annualEffectiveRate: Number(policy.annualEffectiveRate),
  priority: Number(policy.priority || 100),
  isActive: true,
});

function StatusBadge({ active }: { active: boolean }) {
  const label = active ? 'Activo' : 'Inactivo';
  const description = active
    ? 'Disponible para usarse en créditos, pagos o cálculos nuevos.'
    : 'No se ofrece en operaciones nuevas, pero se conserva para trazabilidad histórica.';

  return (
    <ExplainedChip
      label={label}
      description={description}
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
      }`}
    />
  );
}

function TabButton({
  id,
  activeTab,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  id: SettingsTab;
  activeTab: SettingsTab;
  label: string;
  count: number;
  icon: React.ElementType;
  onClick: (tab: SettingsTab) => void;
}) {
  const selected = activeTab === id;

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition ${
        selected
          ? 'border-brand-primary text-text-primary'
          : 'border-transparent text-text-secondary hover:border-border-subtle hover:text-text-primary'
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
      <span className="rounded-full bg-bg-base px-2 py-0.5 text-xs font-semibold text-text-secondary ring-1 ring-border-subtle">
        {count}
      </span>
    </button>
  );
}

export default function Settings() {
  const {
    paymentMethods: rawPaymentMethods,
    ratePolicies: rawRatePolicies,
    lateFeePolicies: rawLateFeePolicies,
    isLoading,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    createRatePolicy,
    updateRatePolicy,
    deleteRatePolicy,
    createLateFeePolicy,
    updateLateFeePolicy,
    deleteLateFeePolicy,
  } = useConfig();

  const paymentMethods = rawPaymentMethods as any[];
  const ratePolicies = rawRatePolicies as any[];
  const lateFeePolicies = rawLateFeePolicies as any[];

  const [activeTab, setActiveTab] = useState<SettingsTab>('payment-methods');
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethodDraft>({
    name: '',
    description: '',
    type: 'bank_transfer',
  });
  const [newRatePolicy, setNewRatePolicy] = useState<RatePolicyDraft>({
    label: '',
    minAmount: '',
    maxAmount: '',
    annualEffectiveRate: '',
    priority: '100',
    description: '',
  });
  const [newLateFeePolicy, setNewLateFeePolicy] = useState<LateFeePolicyDraft>({
    label: '',
    annualEffectiveRate: '',
    lateFeeMode: 'SIMPLE',
    priority: '100',
    description: '',
  });

  const activeCounts = useMemo(() => ({
    paymentMethods: getActiveCount(paymentMethods),
    ratePolicies: getActiveCount(ratePolicies),
    lateFeePolicies: getActiveCount(lateFeePolicies),
  }), [lateFeePolicies, paymentMethods, ratePolicies]);

  const handleCreatePaymentMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePaymentMethodDraft(newPaymentMethod, paymentMethods);
    if (validationError) {
      toast.error({ title: 'Revisa la configuración', description: validationError });
      return;
    }

    try {
      await createPaymentMethod.mutateAsync({
        ...newPaymentMethod,
        isActive: true,
      });
      setNewPaymentMethod({ name: '', description: '', type: 'bank_transfer' });
      toast.success({ description: 'Método de pago creado' });
    } catch (error) {
      console.error('[settings] createPaymentMethod failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateRatePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateRatePolicyDraft(newRatePolicy, ratePolicies);
    if (validationError) {
      toast.error({ title: 'Revisa la política de tasa', description: validationError });
      return;
    }

    try {
      await createRatePolicy.mutateAsync(buildRatePayload(newRatePolicy));
      setNewRatePolicy({ label: '', minAmount: '', maxAmount: '', annualEffectiveRate: '', priority: '100', description: '' });
      toast.success({ description: 'Política de tasa creada' });
    } catch (error) {
      console.error('[settings] createRatePolicy failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateLateFeePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateLateFeePolicyDraft(newLateFeePolicy, lateFeePolicies);
    if (validationError) {
      toast.error({ title: 'Revisa la política de mora', description: validationError });
      return;
    }

    try {
      await createLateFeePolicy.mutateAsync(buildLateFeePayload(newLateFeePolicy));
      setNewLateFeePolicy({ label: '', annualEffectiveRate: '', lateFeeMode: 'SIMPLE', priority: '100', description: '' });
      toast.success({ description: 'Política de mora creada' });
    } catch (error) {
      console.error('[settings] createLateFeePolicy failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleDelete = async ({
    title,
    message,
    action,
    successMessage,
  }: {
    title: string;
    message: string;
    action: () => Promise<unknown>;
    successMessage: string;
  }) => {
    const confirmed = await confirmDanger({ title, message, confirmLabel: 'Eliminar' });
    if (!confirmed) return;

    try {
      await action();
      toast.success({ description: successMessage });
    } catch (error) {
      console.error('[settings] delete failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  if (isLoading) {
    return (
      <PageShell data-tour="settings-page">
        <PageHeader
          title="Configuración operativa"
          subtitle="Cargando políticas y métodos usados por créditos reales."
          guideKey="settings"
          tourId="settings-header"
        />
        <div className="table-empty-state">Cargando configuración…</div>
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="settings-page">
      <PageHeader
        title="Configuración operativa"
        subtitle="Administra solo parámetros que se usan en pagos, mora y originación de créditos nuevos."
        guideKey="settings"
        tourId="settings-header"
      />

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de configuración">
        <MetricCard
          label="Métodos activos"
          value={activeCounts.paymentMethods}
          helper={`${paymentMethods.length} registrados`}
          tooltip="Formas de pago que el operador puede escoger al registrar pagos."
          icon={<CreditCard />}
          accent="blue"
        />
        <MetricCard
          label="Tasas activas"
          value={activeCounts.ratePolicies}
          helper={`${ratePolicies.length} políticas registradas`}
          tooltip="Políticas de tasa anual que pueden alimentar créditos nuevos según monto y prioridad."
          icon={<Percent />}
          accent="teal"
        />
        <MetricCard
          label="Políticas de mora activas"
          value={activeCounts.lateFeePolicies}
          helper={`${lateFeePolicies.length} políticas registradas`}
          tooltip="Políticas que aportan tasa y método de mora a créditos nuevos."
          icon={<AlertTriangle />}
          accent="amber"
        />
      </div>

      <nav className="flex gap-6 overflow-x-auto border-b border-border-subtle" data-tour="settings-tabs" aria-label="Secciones de configuración">
        <TabButton
          id="payment-methods"
          activeTab={activeTab}
          label="Métodos de pago"
          count={paymentMethods.length}
          icon={CreditCard}
          onClick={setActiveTab}
        />
        <TabButton
          id="rate-policies"
          activeTab={activeTab}
          label="Tasas de crédito"
          count={ratePolicies.length}
          icon={Percent}
          onClick={setActiveTab}
        />
        <TabButton
          id="late-fee-policies"
          activeTab={activeTab}
          label="Políticas de mora"
          count={lateFeePolicies.length}
          icon={AlertTriangle}
          onClick={setActiveTab}
        />
      </nav>

      <section className="space-y-4" data-tour="settings-content">
        {activeTab === 'payment-methods' && (
          <>
            <ToolbarSurface className="settings-config-form" as="form" onSubmit={handleCreatePaymentMethod} aria-label="Crear método de pago">
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_180px_minmax(220px,1fr)]">
                <label className="block min-w-0">
                  <HelpLabel
                    label="Nombre del método"
                    text="Nombre visible al registrar pagos. Debe ser claro para caja y cartera."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Nombre del método"
                    required
                    value={newPaymentMethod.name}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Ej: Transferencia Bancolombia"
                  />
                </label>

                <label className="block min-w-0">
                  <HelpLabel
                    label="Tipo de método"
                    text="Clasifica el pago. Transferencias y tarjetas pueden exigir referencia o comprobante."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <select
                    aria-label="Tipo de método"
                    value={newPaymentMethod.type}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, type: event.target.value as PaymentMethodDraft['type'] }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  >
                    <option value="bank_transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </label>

                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Descripción opcional</span>
                  <input
                    aria-label="Descripción del método"
                    value={newPaymentMethod.description}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Ej: requiere referencia bancaria"
                  />
                </label>
              </div>
              <ActionButton
                type="submit"
                disabled={createPaymentMethod.isPending}
                variant="primary"
                icon={<Plus size={16} />}
              >
                Crear método
              </ActionButton>
            </ToolbarSurface>

            <DataTableSurface>
              <div className="overflow-x-auto">
                <table className="min-w-[760px]" aria-label="Métodos de pago">
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th>Tipo</th>
                      <th>Referencia</th>
                      <th>Estado</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentMethods.map((method: any) => (
                      <tr key={method.id}>
                        <td>
                          <p className="font-semibold text-text-primary">{getMethodName(method)}</p>
                          {method.description ? <p className="mt-1 text-xs text-text-secondary">{method.description}</p> : null}
                        </td>
                        <td className="text-text-secondary">{getMethodTypeLabel(method.type)}</td>
                        <td className="text-text-secondary">{method.requiresReference ? 'Requiere soporte' : 'No obligatoria'}</td>
                        <td><StatusBadge active={method.isActive !== false} /></td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              type="button"
                              onClick={async () => {
                                try {
                                  await updatePaymentMethod.mutateAsync({ id: method.id, isActive: method.isActive === false, type: method.type });
                                  toast.success({ description: method.isActive === false ? 'Método activado' : 'Método desactivado' });
                                } catch (error) {
                                  console.error('[settings] updatePaymentMethod failed', error);
                                  toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                                }
                              }}
                              disabled={updatePaymentMethod.isPending}
                              variant="ghost"
                              icon={method.isActive === false ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              {method.isActive === false ? 'Activar' : 'Desactivar'}
                            </ActionButton>
                            <ActionButton
                              type="button"
                              onClick={() => handleDelete({
                                title: 'Eliminar método de pago',
                                message: `Se eliminará "${getMethodName(method)}". Si ya fue usado, lo correcto suele ser desactivarlo para conservar trazabilidad.`,
                                action: () => deletePaymentMethod.mutateAsync(method.id),
                                successMessage: 'Método eliminado',
                              })}
                              disabled={deletePaymentMethod.isPending}
                              variant="danger"
                              icon={<Trash2 size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              Eliminar
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paymentMethods.length === 0 && (
                      <tr>
                        <td colSpan={5} className="table-empty-state">No hay métodos de pago configurados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableSurface>
          </>
        )}

        {activeTab === 'rate-policies' && (
          <>
            <ToolbarSurface className="settings-config-form" as="form" onSubmit={handleCreateRatePolicy} aria-label="Crear política de tasa">
              <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(200px,1fr)_150px_150px_130px_110px]">
                <label className="block min-w-0">
                  <HelpLabel
                    label="Nombre de política"
                    text="Etiqueta para identificar cuándo aplica esta tasa al crear créditos nuevos."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Nombre de política de tasa"
                    required
                    value={newRatePolicy.label}
                    onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, label: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Ej: Crédito estándar"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Monto mínimo</span>
                  <input
                    aria-label="Monto mínimo de tasa"
                    type="number"
                    min="0"
                    value={newRatePolicy.minAmount}
                    onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, minAmount: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="0"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Monto máximo</span>
                  <input
                    aria-label="Monto máximo de tasa"
                    type="number"
                    min="0"
                    value={newRatePolicy.maxAmount}
                    onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, maxAmount: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Sin tope"
                  />
                </label>
                <label className="block min-w-0">
                  <HelpLabel
                    label="Tasa EA %"
                    text="Tasa efectiva anual usada como entrada del cálculo financiero."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Tasa efectiva anual"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newRatePolicy.annualEffectiveRate}
                    onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="60"
                  />
                </label>
                <label className="block min-w-0">
                  <HelpLabel
                    label="Prioridad"
                    text="Si varias políticas aplican al mismo monto, gana la menor prioridad numérica."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Prioridad de tasa"
                    type="number"
                    min="0"
                    value={newRatePolicy.priority}
                    onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, priority: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
              </div>
              <ActionButton
                type="submit"
                disabled={createRatePolicy.isPending}
                variant="primary"
                icon={<Save size={16} />}
              >
                Crear tasa
              </ActionButton>
            </ToolbarSurface>

            <DataTableSurface>
              <div className="overflow-x-auto">
                <table className="min-w-[820px]" aria-label="Políticas de tasa">
                  <thead>
                    <tr>
                      <th>Política</th>
                      <th>Rango</th>
                      <th>Tasa EA</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratePolicies.map((policy: any) => (
                      <tr key={policy.id}>
                        <td className="font-semibold">{policy.label}</td>
                        <td className="text-text-secondary">{formatRange(policy.minAmount, policy.maxAmount)}</td>
                        <td className="font-semibold">{policy.annualEffectiveRate}%</td>
                        <td className="text-text-secondary">{policy.priority}</td>
                        <td><StatusBadge active={policy.isActive !== false} /></td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateRatePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                                  toast.success({ description: policy.isActive === false ? 'Política activada' : 'Política desactivada' });
                                } catch (error) {
                                  console.error('[settings] updateRatePolicy failed', error);
                                  toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                                }
                              }}
                              disabled={updateRatePolicy.isPending}
                              variant="ghost"
                              icon={policy.isActive === false ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              {policy.isActive === false ? 'Activar' : 'Desactivar'}
                            </ActionButton>
                            <ActionButton
                              type="button"
                              onClick={() => handleDelete({
                                title: 'Eliminar política de tasa',
                                message: `Se eliminará "${policy.label}". Si la política ya fue usada en créditos, desactívala en lugar de eliminarla.`,
                                action: () => deleteRatePolicy.mutateAsync(policy.id),
                                successMessage: 'Política eliminada',
                              })}
                              disabled={deleteRatePolicy.isPending}
                              variant="danger"
                              icon={<Trash2 size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              Eliminar
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {ratePolicies.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table-empty-state">No hay políticas de tasa configuradas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableSurface>
          </>
        )}

        {activeTab === 'late-fee-policies' && (
          <>
            <ToolbarSurface className="settings-config-form" as="form" onSubmit={handleCreateLateFeePolicy} aria-label="Crear política de mora">
              <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_190px_110px]">
                <label className="block min-w-0">
                  <HelpLabel
                    label="Nombre de la política"
                    text="Etiqueta visible para identificar la política que se aplicará a créditos nuevos."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Nombre de la política de mora"
                    required
                    value={newLateFeePolicy.label}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, label: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="Ej: Mora simple estándar"
                  />
                </label>
                <label className="block min-w-0">
                  <HelpLabel
                    label="Tasa de mora EA %"
                    text="Tasa efectiva anual que se usará como recargo por mora."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Tasa de mora efectiva anual"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newLateFeePolicy.annualEffectiveRate}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="24"
                  />
                </label>
                <label className="block min-w-0">
                  <HelpLabel
                    label="Cálculo aplicado"
                    text="Método matemático de la mora. Esto no crea otra regla: es parte de la política seleccionada."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <select
                    aria-label="Cálculo aplicado de mora"
                    value={newLateFeePolicy.lateFeeMode}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, lateFeeMode: event.target.value as LateFeePolicyDraft['lateFeeMode'] }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  >
                    <option value="SIMPLE">Mora simple</option>
                    <option value="COMPOUND">Mora compuesta</option>
                    <option value="NONE">Sin mora</option>
                  </select>
                </label>
                <label className="block min-w-0">
                  <HelpLabel
                    label="Prioridad"
                    text="Si hay varias políticas activas, gana la menor prioridad numérica."
                    className="mb-1 text-xs font-semibold text-text-secondary"
                  />
                  <input
                    aria-label="Prioridad de política de mora"
                    type="number"
                    min="0"
                    value={newLateFeePolicy.priority}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, priority: event.target.value }))}
                    className="w-full rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
              </div>
              <ActionButton
                type="submit"
                disabled={createLateFeePolicy.isPending}
                variant="primary"
                icon={<Save size={16} />}
              >
                Crear política
              </ActionButton>
            </ToolbarSurface>

            <DataTableSurface>
              <div className="overflow-x-auto">
                <table className="min-w-[760px]" aria-label="Políticas de mora">
                  <thead>
                    <tr>
                      <th>Política</th>
                      <th>Tasa EA</th>
                      <th>Cálculo</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateFeePolicies.map((policy: any) => (
                      <tr key={policy.id}>
                        <td className="font-semibold">{policy.label}</td>
                        <td className="font-semibold">{policy.annualEffectiveRate}%</td>
                        <td className="text-text-secondary">{lateFeeModeLabels[String(policy.lateFeeMode || 'SIMPLE').toUpperCase()] || policy.lateFeeMode}</td>
                        <td className="text-text-secondary">{policy.priority}</td>
                        <td><StatusBadge active={policy.isActive !== false} /></td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateLateFeePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                                  toast.success({ description: policy.isActive === false ? 'Política activada' : 'Política desactivada' });
                                } catch (error) {
                                  console.error('[settings] updateLateFeePolicy failed', error);
                                  toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
                                }
                              }}
                              disabled={updateLateFeePolicy.isPending}
                              variant="ghost"
                              icon={policy.isActive === false ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              {policy.isActive === false ? 'Activar' : 'Desactivar'}
                            </ActionButton>
                            <ActionButton
                              type="button"
                              onClick={() => handleDelete({
                                title: 'Eliminar política de mora',
                                message: `Se eliminará "${policy.label}". Si ya fue usada en créditos, desactívala en lugar de eliminarla.`,
                                action: () => deleteLateFeePolicy.mutateAsync(policy.id),
                                successMessage: 'Política eliminada',
                              })}
                              disabled={deleteLateFeePolicy.isPending}
                              variant="danger"
                              icon={<Trash2 size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              Eliminar
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {lateFeePolicies.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table-empty-state">No hay políticas de mora configuradas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableSurface>
          </>
        )}
      </section>
    </PageShell>
  );
}
