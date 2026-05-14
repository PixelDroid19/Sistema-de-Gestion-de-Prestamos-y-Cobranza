import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleOff,
  CreditCard,
  Percent,
  PencilLine,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useConfig } from '../services/configService';
import { useUsers } from '../services/userService';
import { toast } from '../lib/toast';
import { confirmDanger } from '../lib/confirmModal';
import {
  ActionButton,
  DataTableSurface,
  FormField,
  MetricCard,
  PageHeader,
  PageShell,
  SelectInput,
  SectionSurface,
  StatusChip,
  TextInput,
  ViewTabs,
} from './shared/Surfaces';
import { ExplainedChip, HelpLabel } from './shared/HelpSupport';
import PermissionsTab from './PermissionsTab';

type SettingsTab = 'employees' | 'payment-methods' | 'rate-policies' | 'late-fee-policies';

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

type EmployeeDraft = {
  name: string;
  email: string;
  password: string;
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

const formatRate = (value: unknown) => `${Number(value ?? 0).toLocaleString('es-CO', {
  maximumFractionDigits: 2,
})}% EA`;

const DEFAULT_LOW_AMOUNT_LIMIT = 1000000;
const DEFAULT_HIGH_AMOUNT_START = 1000001;

const EMPTY_RATE_POLICY: RatePolicyDraft = {
  label: '',
  minAmount: '',
  maxAmount: '',
  annualEffectiveRate: '',
  priority: '100',
  description: '',
};

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

const sortRatePoliciesForApplication = (policies: any[]) => [...policies].sort((left, right) => {
  const priorityDiff = Number(left?.priority || 100) - Number(right?.priority || 100);
  if (priorityDiff !== 0) return priorityDiff;
  return getRangeBoundary(left?.minAmount, 0) - getRangeBoundary(right?.minAmount, 0);
});

const findRatePolicyMatchesForAmount = (policies: any[], rawAmount: string) => {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0) return [];

  return sortRatePoliciesForApplication(policies)
    .filter((policy) => (
      policy?.isActive !== false
      && amount >= getRangeBoundary(policy?.minAmount, 0)
      && amount <= getRangeBoundary(policy?.maxAmount, Number.POSITIVE_INFINITY)
    ));
};

const getWinningPriorityConflicts = (matches: any[]) => {
  const orderedMatches = sortRatePoliciesForApplication(matches);
  const winningPriority = orderedMatches[0] ? Number(orderedMatches[0]?.priority || 100) : null;
  if (winningPriority === null) return [];
  return orderedMatches.filter((policy) => Number(policy?.priority || 100) === winningPriority);
};

const getRatePolicyConflictPairs = (policies: any[]) => {
  const activePolicies = sortRatePoliciesForApplication(policies).filter((policy) => policy?.isActive !== false);
  const pairs: Array<[any, any]> = [];

  activePolicies.forEach((left, leftIndex) => {
    activePolicies.slice(leftIndex + 1).forEach((right) => {
      if (
        Number(left?.priority || 100) === Number(right?.priority || 100)
        && rangesOverlap(left, right)
      ) {
        pairs.push([left, right]);
      }
    });
  });

  return pairs;
};

const buildRateCoverageCheck = (label: string, amount: number, matches: any[]) => {
  const conflicts = getWinningPriorityConflicts(matches);
  const hasConflict = conflicts.length > 1;
  const policy = hasConflict ? null : sortRatePoliciesForApplication(matches)[0] || null;

  return {
    label,
    amount,
    policy,
    matches,
    conflicts,
    hasConflict,
    status: hasConflict
      ? 'Conflicto'
      : policy
        ? `${formatRate(policy.annualEffectiveRate)} · ${policy.label}`
        : 'Sin regla activa',
  };
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

const validateRatePolicyDraft = (draft: RatePolicyDraft, ratePolicies: any[], currentId: unknown = null) => {
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
  const duplicateLabel = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && normalizeComparable(policy?.label) === normalizedLabel
  ));
  if (duplicateLabel) {
    return 'Ya existe una política de tasa con ese nombre.';
  }

  const priority = Number(draft.priority || 100);
  const overlap = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && policy?.isActive !== false
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

function EmployeeAccessPanel() {
  const { data: usersData, registerWithPermissions, deactivateUser, reactivateUser } = useUsers({ page: 1, pageSize: 100, role: 'employee' });
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>({
    name: '',
    email: '',
    password: '',
  });

  const users = Array.isArray(usersData?.data?.users)
    ? usersData.data.users
    : Array.isArray(usersData?.data)
      ? usersData.data
      : [];
  const employees = users.filter((user: any) => user?.role === 'employee');
  const activeEmployees = employees.filter((employee: any) => employee?.isActive !== false);
  const inactiveEmployees = employees.filter((employee: any) => employee?.isActive === false);

  const handleToggleEmployeeStatus = async (employee: any) => {
    const isActive = employee?.isActive !== false;
    const employeeLabel = employee?.name || employee?.email || 'empleado';

    if (isActive) {
      const confirmed = await confirmDanger({
        title: 'Desactivar empleado',
        message: `Se bloqueará el acceso administrativo de "${employeeLabel}". Sus permisos se conservan para trazabilidad, pero no podrá iniciar sesión hasta reactivarlo.`,
        confirmLabel: 'Desactivar',
      });
      if (!confirmed) return;
    }

    try {
      if (isActive) {
        await deactivateUser.mutateAsync(Number(employee.id));
        toast.success({ description: 'Empleado desactivado. Ya no podrá ingresar a la plataforma.' });
        return;
      }

      await reactivateUser.mutateAsync(Number(employee.id));
      toast.success({ description: 'Empleado reactivado. Puede volver a iniciar sesión.' });
    } catch (error) {
      console.error('[settings] toggle employee status failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = employeeDraft.name.trim();
    const email = employeeDraft.email.trim().toLowerCase();
    const password = employeeDraft.password;

    if (!name) {
      toast.error({ title: 'Revisa el empleado', description: 'El nombre del empleado es obligatorio.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      toast.error({ title: 'Revisa el empleado', description: 'Ingresa un correo válido.' });
      return;
    }

    if (password.length < 8) {
      toast.error({ title: 'Revisa el empleado', description: 'La contraseña debe tener mínimo 8 caracteres.' });
      return;
    }

    const duplicateEmail = employees.some((employee: any) => String(employee?.email || '').toLowerCase() === email);
    if (duplicateEmail) {
      toast.error({ title: 'Revisa el empleado', description: 'Ya existe un empleado con ese correo.' });
      return;
    }

    try {
      await registerWithPermissions.mutateAsync({
        name,
        email,
        password,
        role: 'employee',
        permissions: [],
      });
      setEmployeeDraft({ name: '', email: '', password: '' });
      toast.success({ description: 'Empleado creado. Ahora puede asignarle permisos por módulo.' });
    } catch (error) {
      console.error('[settings] create employee failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de empleados">
        <MetricCard
          label="Empleados"
          value={employees.length}
          helper="Usuarios administrativos creados"
          tooltip="Cuentas tipo empleado que pueden entrar a la plataforma si están activas y tienen permisos."
          icon={<UserPlus />}
          accent="slate"
        />
        <MetricCard
          label="Activos"
          value={activeEmployees.length}
          helper="Pueden iniciar sesión"
          tooltip="Empleados con acceso habilitado. Además necesitan permisos por módulo para operar."
          icon={<UserCheck />}
          accent="emerald"
        />
        <MetricCard
          label="Inactivos"
          value={inactiveEmployees.length}
          helper="Acceso suspendido"
          tooltip="Empleados conservados para auditoría, pero sin acceso a la plataforma."
          icon={<UserX />}
          accent="rose"
        />
      </div>

      <SectionSurface
        as="form"
        onSubmit={handleCreateEmployee}
        aria-label="Crear empleado administrativo"
        title="Alta de empleado"
        subtitle="Este acceso solo sirve para la plataforma administrativa. No crea clientes ni socios."
        bodyClassName="space-y-4"
      >
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
          <FormField
            label="Nombre del empleado"
            tooltip="Nombre visible en auditoría y operación. No crea cliente ni socio."
          >
            <TextInput
              aria-label="Nombre del empleado"
              required
              value={employeeDraft.name}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Ej: Ana Operaciones"
            />
          </FormField>
          <FormField
            label="Correo de acceso"
            tooltip="Correo que usará el empleado para iniciar sesión en la plataforma administrativa."
          >
            <TextInput
              aria-label="Correo de acceso"
              required
              type="email"
              value={employeeDraft.email}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="empleado@empresa.com"
            />
          </FormField>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,0.55fr)_auto]">
          <FormField
            label="Contraseña inicial"
            tooltip="Debe tener mínimo 8 caracteres. El empleado podrá cambiarla desde su perfil si el flujo está habilitado."
          >
            <TextInput
              aria-label="Contraseña inicial"
              required
              type="password"
              minLength={8}
              value={employeeDraft.password}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, password: event.target.value }))}
              placeholder="Mínimo 8 caracteres"
            />
          </FormField>
          <div className="settings-form-actions">
            <ActionButton
              type="submit"
              disabled={registerWithPermissions.isPending}
              variant="primary"
              icon={<UserPlus size={16} />}
            >
              Crear empleado
            </ActionButton>
          </div>
        </div>
        <p className="settings-inline-note">
          Los empleados solo entran a módulos concedidos explícitamente. Tasas, mora, métodos de pago y permisos sensibles siguen reservados para administración.
        </p>
      </SectionSurface>

      <DataTableSurface aria-label="Empleados administrativos">
        <div className="overflow-x-auto">
          <table className="min-w-[760px]" aria-label="Empleados administrativos">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Alta</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee: any) => (
                <tr key={employee.id}>
                  <td>
                    <p className="font-semibold text-text-primary">{employee.name || 'Empleado sin nombre'}</p>
                    <p className="mt-1 text-xs text-text-secondary">Rol administrativo: empleado</p>
                  </td>
                  <td className="text-text-secondary">{employee.email}</td>
                  <td><StatusBadge active={employee.isActive !== false} /></td>
                  <td className="text-text-secondary">
                    {employee.createdAt
                      ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(employee.createdAt))
                      : '—'}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <ActionButton
                        type="button"
                        onClick={() => handleToggleEmployeeStatus(employee)}
                        disabled={deactivateUser.isPending || reactivateUser.isPending}
                        variant={employee.isActive === false ? 'secondary' : 'danger'}
                        icon={employee.isActive === false ? <UserCheck size={14} /> : <UserX size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                        title={employee.isActive === false
                          ? 'Reactiva el acceso administrativo del empleado.'
                          : 'Desactiva el acceso administrativo sin borrar auditoría ni permisos históricos.'}
                      >
                        {employee.isActive === false ? 'Reactivar' : 'Desactivar'}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">No hay empleados administrativos creados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>

      <PermissionsTab />
    </div>
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('employees');
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethodDraft>({
    name: '',
    description: '',
    type: 'bank_transfer',
  });
  const [editingRatePolicyId, setEditingRatePolicyId] = useState<string | null>(null);
  const [newRatePolicy, setNewRatePolicy] = useState<RatePolicyDraft>(EMPTY_RATE_POLICY);
  const [ratePreviewAmount, setRatePreviewAmount] = useState('2000000');
  const [newLateFeePolicy, setNewLateFeePolicy] = useState<LateFeePolicyDraft>({
    label: '',
    annualEffectiveRate: '',
    lateFeeMode: 'SIMPLE',
    priority: '100',
    description: '',
  });

  const orderedRatePolicies = useMemo(() => sortRatePoliciesForApplication(ratePolicies), [ratePolicies]);
  const activeRatePolicies = useMemo(
    () => orderedRatePolicies.filter((policy) => policy?.isActive !== false),
    [orderedRatePolicies],
  );
  const ratePolicyConflictPairs = useMemo(
    () => getRatePolicyConflictPairs(activeRatePolicies),
    [activeRatePolicies],
  );
  const conflictedRatePolicyIds = useMemo(() => new Set(
    ratePolicyConflictPairs.flatMap(([left, right]) => [String(left?.id), String(right?.id)]),
  ), [ratePolicyConflictPairs]);
  const hasRatePolicyConflicts = ratePolicyConflictPairs.length > 0;
  const previewRateMatches = useMemo(
    () => findRatePolicyMatchesForAmount(activeRatePolicies, ratePreviewAmount),
    [activeRatePolicies, ratePreviewAmount],
  );
  const previewRateConflicts = useMemo(
    () => getWinningPriorityConflicts(previewRateMatches),
    [previewRateMatches],
  );
  const previewRatePolicy = useMemo(
    () => (previewRateConflicts.length > 1 ? null : sortRatePoliciesForApplication(previewRateMatches)[0] || null),
    [previewRateConflicts, previewRateMatches],
  );
  const rateCoverageChecks = useMemo(() => [
    buildRateCoverageCheck(
      `$0 - ${formatCurrency(DEFAULT_LOW_AMOUNT_LIMIT)}`,
      DEFAULT_LOW_AMOUNT_LIMIT,
      findRatePolicyMatchesForAmount(activeRatePolicies, String(DEFAULT_LOW_AMOUNT_LIMIT)),
    ),
    buildRateCoverageCheck(
      `Desde ${formatCurrency(DEFAULT_HIGH_AMOUNT_START)}`,
      DEFAULT_HIGH_AMOUNT_START,
      findRatePolicyMatchesForAmount(activeRatePolicies, String(DEFAULT_HIGH_AMOUNT_START)),
    ),
  ], [activeRatePolicies]);
  const hasMissingStandardRateCoverage = rateCoverageChecks.some((check) => !check.policy || check.hasConflict);
  const previewAmountNumber = Number(ratePreviewAmount);
  const hasValidPreviewAmount = Number.isFinite(previewAmountNumber) && previewAmountNumber >= 0;
  const isEditingRatePolicy = Boolean(editingRatePolicyId);
  const resetRatePolicyDraft = () => {
    setEditingRatePolicyId(null);
    setNewRatePolicy(EMPTY_RATE_POLICY);
  };

  const startEditingRatePolicy = (policy: any) => {
    setEditingRatePolicyId(String(policy.id));
    setNewRatePolicy({
      label: String(policy.label || ''),
      minAmount: policy.minAmount == null ? '' : String(policy.minAmount),
      maxAmount: policy.maxAmount == null ? '' : String(policy.maxAmount),
      annualEffectiveRate: policy.annualEffectiveRate == null ? '' : String(policy.annualEffectiveRate),
      priority: policy.priority == null ? '100' : String(policy.priority),
      description: String(policy.description || ''),
    });
  };

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
    const validationError = validateRatePolicyDraft(newRatePolicy, ratePolicies, editingRatePolicyId);
    if (validationError) {
      toast.error({ title: 'Revisa la política de tasa', description: validationError });
      return;
    }

    try {
      if (editingRatePolicyId) {
        await updateRatePolicy.mutateAsync({ id: editingRatePolicyId, ...buildRatePayload(newRatePolicy) });
        toast.success({ description: 'Política de tasa actualizada para créditos nuevos' });
      } else {
        await createRatePolicy.mutateAsync(buildRatePayload(newRatePolicy));
        toast.success({ description: 'Política de tasa creada' });
      }
      resetRatePolicyDraft();
    } catch (error) {
      console.error('[settings] saveRatePolicy failed', error);
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
    <PageShell data-tour="settings-page" className="settings-page">
      <PageHeader
        title="Configuración operativa"
        subtitle="Administra solo parámetros que se usan en pagos, mora y originación de créditos nuevos."
        guideKey="settings"
        tourId="settings-header"
      />

      <ViewTabs
        data-tour="settings-tabs"
        ariaLabel="Secciones de configuración"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as SettingsTab)}
        tabs={[
          { id: 'payment-methods', label: 'Métodos de pago', count: paymentMethods.length, icon: CreditCard },
          { id: 'rate-policies', label: 'Tasas de crédito', count: ratePolicies.length, icon: Percent },
          { id: 'late-fee-policies', label: 'Políticas de mora', count: lateFeePolicies.length, icon: AlertTriangle },
          { id: 'employees', label: 'Empleados y permisos', icon: ShieldCheck },
        ]}
      />

      <section className="settings-content" data-tour="settings-content">
        {activeTab === 'employees' && <EmployeeAccessPanel />}

        {activeTab === 'payment-methods' && (
          <>
            <SectionSurface
              as="form"
              onSubmit={handleCreatePaymentMethod}
              aria-label="Crear método de pago"
              title="Alta de método"
              subtitle="Usa nombres que caja reconozca al instante y deja la descripción solo para reglas operativas."
              bodyClassName="space-y-4"
            >
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
                <FormField
                  label="Nombre del método"
                  tooltip="Nombre visible al registrar pagos. Debe ser claro para caja y cartera."
                >
                  <TextInput
                    aria-label="Nombre del método"
                    required
                    value={newPaymentMethod.name}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Ej: Transferencia Bancolombia"
                  />
                </FormField>

                <FormField
                  label="Tipo de método"
                  tooltip="Clasifica el pago. Transferencias y tarjetas pueden exigir referencia o comprobante."
                >
                  <SelectInput
                    aria-label="Tipo de método"
                    value={newPaymentMethod.type}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, type: event.target.value as PaymentMethodDraft['type'] }))}
                  >
                    <option value="bank_transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </SelectInput>
                </FormField>
              </div>
              <FormField label="Descripción opcional">
                <TextInput
                  aria-label="Descripción del método"
                  value={newPaymentMethod.description}
                  onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Ej: requiere referencia bancaria"
                />
              </FormField>
              <div className="settings-form-actions">
                <ActionButton
                  type="submit"
                  disabled={createPaymentMethod.isPending}
                  variant="primary"
                  icon={<Plus size={16} />}
                >
                  Crear método
                </ActionButton>
                <p className="settings-inline-helper">
                  Conserva un método por canal real y desactívalo antes de eliminarlo si ya tuvo uso.
                </p>
              </div>
            </SectionSurface>

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
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <SectionSurface
                  as="form"
                  onSubmit={handleCreateRatePolicy}
                  aria-label="Crear política de tasa"
                  title={isEditingRatePolicy ? 'Editar tasa por monto' : 'Tasas automáticas por monto'}
                  subtitle={isEditingRatePolicy
                    ? 'Los cambios aplican a créditos nuevos. Los créditos existentes conservan la tasa que ya quedó guardada.'
                    : 'Configura los rangos que usa Nuevo crédito. La tasa se elige por monto y queda guardada en el crédito al registrarlo.'}
                  bodyClassName="space-y-4"
                >
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <FormField
                      label="Nombre de la regla"
                    >
                      <TextInput
                        aria-label="Nombre de política de tasa"
                        required
                        value={newRatePolicy.label}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, label: event.target.value }))}
                        placeholder="Crédito estándar"
                      />
                    </FormField>
                    <FormField
                      label="Desde este monto"
                      tooltip="Los límites son inclusivos: si escribes 1.000.000, ese monto también entra en la regla."
                    >
                      <TextInput
                        aria-label="Monto mínimo de tasa"
                        type="number"
                        min="0"
                        value={newRatePolicy.minAmount}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, minAmount: event.target.value }))}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField
                      label="Hasta este monto"
                      tooltip="Ejemplo recomendado: primera regla hasta 1.000.000; segunda regla desde 1.000.001 y sin tope."
                    >
                      <TextInput
                        aria-label="Monto máximo de tasa"
                        type="number"
                        min="0"
                        value={newRatePolicy.maxAmount}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, maxAmount: event.target.value }))}
                        placeholder="Sin tope"
                      />
                    </FormField>
                    <FormField
                      label="Tasa anual del crédito"
                      tooltip="No edites manualmente la tasa en un crédito creado. Cada crédito conserva la tasa resuelta al momento de registro."
                    >
                      <TextInput
                        aria-label="Tasa efectiva anual"
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={newRatePolicy.annualEffectiveRate}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
                        placeholder="60"
                      />
                    </FormField>
                    <FormField
                      label="Orden de aplicación"
                      tooltip="Si varias reglas activas cubren el mismo monto, gana la de menor orden. El backend bloquea rangos ambiguos con el mismo orden."
                    >
                      <TextInput
                        aria-label="Prioridad de tasa"
                        type="number"
                        min="0"
                        value={newRatePolicy.priority}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, priority: event.target.value }))}
                      />
                    </FormField>
                  </div>
                  <div className="settings-form-footer">
                    <p className="settings-inline-helper">
                      Cada crédito nuevo congela esta regla al registrarse. Evita solapes y mantén un orden claro.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditingRatePolicy && (
                        <ActionButton
                          type="button"
                          onClick={resetRatePolicyDraft}
                          disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                        >
                          Cancelar
                        </ActionButton>
                      )}
                      <ActionButton
                        type="submit"
                        disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                        variant="primary"
                        icon={<Save size={16} />}
                      >
                        {isEditingRatePolicy ? 'Guardar cambios' : 'Guardar regla'}
                      </ActionButton>
                    </div>
                  </div>
                </SectionSurface>

                <DataTableSurface>
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px]" aria-label="Políticas de tasa">
                      <thead>
                        <tr>
                          <th><HelpLabel label="Regla" text="Nombre operativo de la tasa. Debe indicar para qué tipo de crédito o rango se usa." /></th>
                          <th><HelpLabel label="Aplica a montos" text="Rango de capital donde esta tasa puede aplicarse. Los límites son inclusivos." /></th>
                          <th><HelpLabel label="Tasa anual" text="Tasa efectiva anual que se copia al crédito nuevo cuando el monto cae en este rango." /></th>
                          <th><HelpLabel label="Uso" text="Orden de aplicación. Menor número gana si existe una excepción válida." /></th>
                          <th>Estado</th>
                          <th className="text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedRatePolicies.map((policy: any) => (
                          <tr key={policy.id}>
                            <td>
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <p className="truncate font-semibold">{policy.label}</p>
                                  {conflictedRatePolicyIds.has(String(policy.id)) && (
                                    <StatusChip tone="danger" size="sm" title="Esta regla se cruza con otra regla activa del mismo orden.">
                                      Conflicto
                                    </StatusChip>
                                  )}
                                </div>
                                {policy.description && (
                                  <p className="mt-1 max-w-[18rem] truncate text-xs text-text-secondary">{policy.description}</p>
                                )}
                                {conflictedRatePolicyIds.has(String(policy.id)) && (
                                  <p className="mt-1 max-w-[24rem] text-xs text-rose-700 dark:text-rose-200">
                                    Edita el rango, cambia el orden o desactiva una regla para que solo una tasa aplique por monto.
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="text-text-secondary">{formatRange(policy.minAmount, policy.maxAmount)}</td>
                            <td className="font-semibold">{formatRate(policy.annualEffectiveRate)}</td>
                            <td className="text-text-secondary">Orden {Number(policy.priority || 100)}</td>
                            <td><StatusBadge active={policy.isActive !== false} /></td>
                            <td>
                              <div className="flex justify-end gap-2">
                                <ActionButton
                                  type="button"
                                  onClick={() => startEditingRatePolicy(policy)}
                                  disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                                  variant="ghost"
                                  icon={<PencilLine size={14} />}
                                  className="min-h-8 px-3 py-1.5 text-xs"
                                  title="Edita la regla para créditos nuevos. No recalcula créditos existentes."
                                >
                                  Editar
                                </ActionButton>
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
              </div>

              <SectionSurface
                title="Cobertura y prueba"
                subtitle="Comprueba si los rangos obligatorios están cubiertos y qué tasa tomará Nuevo crédito."
                bodyClassName="space-y-4"
              >
                {hasRatePolicyConflicts && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                    <p className="font-semibold">Hay tasas activas que se cruzan con el mismo orden.</p>
                    <p className="mt-1">
                      Nuevo crédito queda bloqueado para esos montos hasta editar el rango, cambiar el orden o desactivar una regla.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {ratePolicyConflictPairs.slice(0, 3).map(([left, right]) => (
                        <li key={`${left?.id}-${right?.id}`}>
                          {left?.label} y {right?.label} cubren montos en común con orden {Number(left?.priority || 100)}.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid gap-2">
                  {rateCoverageChecks.map((check) => (
                    <div key={check.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">{check.label}</p>
                        <p className="truncate text-xs text-text-secondary">
                          {check.hasConflict
                            ? `Conflicto entre ${check.conflicts.map((policy) => policy.label).join(' y ')}.`
                            : check.policy ? `Cubierto por ${check.policy.label}` : 'Crea una regla activa para este tramo.'}
                        </p>
                      </div>
                      <StatusChip tone={check.hasConflict ? 'danger' : check.policy ? 'success' : 'warning'} size="sm">
                        {check.status}
                      </StatusChip>
                    </div>
                  ))}
                  {hasMissingStandardRateCoverage && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Falta cubrir un tramo recomendado o hay un conflicto de rangos. Nuevo crédito no permite registrar hasta resolverlo.
                    </p>
                  )}
                </div>
                <FormField label="Monto del crédito">
                  <TextInput
                    aria-label="Monto para probar tasa"
                    type="number"
                    min="0"
                    value={ratePreviewAmount}
                    onChange={(event) => setRatePreviewAmount(event.target.value)}
                    placeholder="2000000"
                  />
                </FormField>
                <div className="rounded-xl border border-border-subtle bg-bg-base p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">Resultado</p>
                      <p className="mt-1 truncate text-lg font-bold text-text-primary">
                        {previewRatePolicy ? formatRate(previewRatePolicy.annualEffectiveRate) : 'Sin tasa aplicable'}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-text-secondary">
                        {previewRatePolicy ? previewRatePolicy.label : 'Sin regla activa'}
                      </p>
                    </div>
                    <StatusChip
                      tone={previewRateConflicts.length > 1 ? 'danger' : previewRatePolicy ? 'success' : 'warning'}
                      size="sm"
                      icon={<Calculator size={14} />}
                      title={previewRateConflicts.length > 1
                        ? 'Hay varias reglas activas con el mismo orden para este monto.'
                        : previewRatePolicy ? 'Hay regla activa para este monto.' : 'No hay regla activa para este monto.'}
                    >
                      {previewRateConflicts.length > 1 ? 'Conflicto' : previewRatePolicy ? 'Cubierto' : 'Sin regla'}
                    </StatusChip>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    {previewRateConflicts.length > 1
                      ? `No se puede elegir una tasa segura: ${previewRateConflicts.map((policy) => policy.label).join(' y ')} cubren este monto con el mismo orden. Edita o desactiva una antes de crear créditos.`
                      : previewRatePolicy
                      ? `${previewRatePolicy.label} aplica a ${formatRange(previewRatePolicy.minAmount, previewRatePolicy.maxAmount)}. Esa tasa será la que vea el operador en Nuevo crédito.`
                      : hasValidPreviewAmount
                        ? 'Crea una regla activa que cubra este monto para poder originar el crédito.'
                        : 'Ingresa un monto válido para probar la tasa.'}
                  </p>
                </div>
              </SectionSurface>
            </div>
          </>
        )}

        {activeTab === 'late-fee-policies' && (
          <>
            <SectionSurface
              as="form"
              onSubmit={handleCreateLateFeePolicy}
              aria-label="Crear política de mora"
              title="Alta de política de mora"
              subtitle="La mora debe ser explícita y simple de entender para cartera. La prioridad solo se usa cuando hay varias políticas activas."
              bodyClassName="space-y-4"
            >
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_190px_110px]">
                <FormField
                  label="Nombre de la política"
                  tooltip="Etiqueta visible para identificar la política que se aplicará a créditos nuevos."
                >
                  <TextInput
                    aria-label="Nombre de la política de mora"
                    required
                    value={newLateFeePolicy.label}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Ej: Mora simple estándar"
                  />
                </FormField>
                <FormField
                  label="Tasa de mora EA %"
                  tooltip="Tasa efectiva anual que se usará como recargo por mora."
                >
                  <TextInput
                    aria-label="Tasa de mora efectiva anual"
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newLateFeePolicy.annualEffectiveRate}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
                    placeholder="24"
                  />
                </FormField>
                <FormField
                  label="Cálculo aplicado"
                  tooltip="Método matemático de la mora. Esto no crea otra regla: es parte de la política seleccionada."
                >
                  <SelectInput
                    aria-label="Cálculo aplicado de mora"
                    value={newLateFeePolicy.lateFeeMode}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, lateFeeMode: event.target.value as LateFeePolicyDraft['lateFeeMode'] }))}
                  >
                    <option value="SIMPLE">Mora simple</option>
                    <option value="COMPOUND">Mora compuesta</option>
                    <option value="NONE">Sin mora</option>
                  </SelectInput>
                </FormField>
                <FormField
                  label="Prioridad"
                  tooltip="Si hay varias políticas activas, gana la menor prioridad numérica."
                >
                  <TextInput
                    aria-label="Prioridad de política de mora"
                    type="number"
                    min="0"
                    value={newLateFeePolicy.priority}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, priority: event.target.value }))}
                  />
                </FormField>
              </div>
              <div className="settings-form-actions">
                <ActionButton
                  type="submit"
                  disabled={createLateFeePolicy.isPending}
                  variant="primary"
                  icon={<Save size={16} />}
                >
                  Crear política
                </ActionButton>
                <p className="settings-inline-helper">
                  Mantén una política estándar y usa prioridades distintas solo cuando exista una excepción real.
                </p>
              </div>
            </SectionSurface>

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
