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
  InsightStrip,
  PageHeader,
  PageShell,
  SelectInput,
  SectionSurface,
  StatusChip,
  TextInput,
  ViewTabs,
} from './shared/Surfaces';
import { ExplainedChip, HelpLabel } from './shared/HelpSupport';
import EmployeeEditModal from './EmployeeEditModal';
import { useTranslation } from '../i18n';
import { tTerm } from '../i18n/terminology';
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatPercent as formatPercentValue,
} from '../i18n/format';

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

const getPaymentMethodTypeLabel = (type: unknown) => {
  const normalizedType = String(type || 'other').trim().toLowerCase();

  if (normalizedType === 'bank_transfer') return tTerm('settings.paymentMethods.type.bankTransfer');
  if (normalizedType === 'cash') return tTerm('settings.paymentMethods.type.cash');
  if (normalizedType === 'card') return tTerm('settings.paymentMethods.type.card');

  return tTerm('settings.paymentMethods.type.other');
};

const getLateFeeModeLabel = (mode: unknown) => {
  const normalizedMode = String(mode || 'SIMPLE').toUpperCase();

  if (normalizedMode === 'NONE') return tTerm('settings.lateFee.type.none');
  if (normalizedMode === 'COMPOUND') return tTerm('settings.lateFee.type.compound');

  return tTerm('settings.lateFee.type.simple');
};

const normalizeComparable = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const formatCurrency = (value: unknown) => formatCurrencyValue(value);

const formatRange = (minAmount: unknown, maxAmount: unknown) => {
  const hasMin = minAmount !== null && minAmount !== undefined && minAmount !== '';
  const hasMax = maxAmount !== null && maxAmount !== undefined && maxAmount !== '';

  if (!hasMin && !hasMax) return tTerm('settings.range.allAmounts');
  return `${hasMin ? formatCurrency(minAmount) : formatCurrencyValue(0)} - ${hasMax ? formatCurrency(maxAmount) : tTerm('settings.range.noCap')}`;
};

const formatRate = (value: unknown) => `${formatPercentValue(value, { maximumFractionDigits: 2 })} EA`;

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

const getMethodName = (method: any) => method?.name || method?.label || method?.key || tTerm('settings.paymentMethods.methodUnnamed');

const getMethodTypeLabel = (type: unknown) => {
  return getPaymentMethodTypeLabel(type);
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
      ? tTerm('settings.coverage.status.conflict')
      : policy
        ? tTerm('settings.coverage.status.rule', { rate: formatRate(policy.annualEffectiveRate), label: policy.label })
        : tTerm('settings.coverage.status.noRuleActive'),
  };
};

const validatePercent = (value: string, label: string) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    return tTerm('settings.validation.percentRange', { label });
  }
  return null;
};

const validatePriority = (value: string) => {
  const numericValue = Number(value || 100);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return tTerm('settings.validation.priority');
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
  if (!name) return tTerm('settings.validation.paymentMethod.nameRequired');

  const normalizedName = normalizeComparable(name);
  const duplicate = paymentMethods.some((method) => (
    normalizeComparable(getMethodName(method)) === normalizedName
    || normalizeComparable(method?.key) === normalizedName
  ));

  if (duplicate) {
    return tTerm('settings.validation.paymentMethod.duplicate');
  }

  return null;
};

const validateRatePolicyDraft = (draft: RatePolicyDraft, ratePolicies: any[], currentId: unknown = null) => {
  const label = draft.label.trim();
  if (!label) return tTerm('settings.validation.rate.labelRequired');

  const percentError = validatePercent(draft.annualEffectiveRate, tTerm('settings.rate.field.annualRate'));
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const minAmount = toOptionalDraftNumber(draft.minAmount, 0);
  const maxAmount = toOptionalDraftNumber(draft.maxAmount, null);
  if (!Number.isFinite(minAmount) || (maxAmount !== null && !Number.isFinite(maxAmount))) {
    return tTerm('settings.validation.rate.amountNumeric');
  }
  const normalizedMinAmount = Number(minAmount);
  const normalizedMaxAmount = maxAmount === null ? null : Number(maxAmount);
  if (normalizedMinAmount < 0 || (normalizedMaxAmount !== null && normalizedMaxAmount < 0)) {
    return tTerm('settings.validation.rate.amountNegative');
  }
  if (normalizedMaxAmount !== null && normalizedMinAmount > normalizedMaxAmount) {
    return tTerm('settings.validation.rate.minGreater');
  }

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && normalizeComparable(policy?.label) === normalizedLabel
  ));
  if (duplicateLabel) {
    return tTerm('settings.validation.rate.duplicateLabel');
  }

  const priority = Number(draft.priority || 100);
  const overlap = ratePolicies.some((policy) => (
    String(policy?.id) !== String(currentId ?? '')
    && policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
    && rangesOverlap({ minAmount: normalizedMinAmount, maxAmount: normalizedMaxAmount }, policy)
  ));
  if (overlap) {
    return tTerm('settings.validation.rate.overlap');
  }

  return null;
};

const validateLateFeePolicyDraft = (draft: LateFeePolicyDraft, lateFeePolicies: any[]) => {
  const label = draft.label.trim();
  if (!label) return tTerm('settings.validation.lateFee.labelRequired');

  const percentError = validatePercent(draft.annualEffectiveRate, tTerm('settings.lateFee.field.rate'));
  if (percentError) return percentError;

  const priorityError = validatePriority(draft.priority);
  if (priorityError) return priorityError;

  const normalizedLabel = normalizeComparable(label);
  const duplicateLabel = lateFeePolicies.some((policy) => normalizeComparable(policy?.label) === normalizedLabel);
  if (duplicateLabel) {
    return tTerm('settings.validation.lateFee.duplicateLabel');
  }

  const priority = Number(draft.priority || 100);
  const duplicatePriority = lateFeePolicies.some((policy) => (
    policy?.isActive !== false
    && Number(policy?.priority || 100) === priority
  ));
  if (duplicatePriority) {
    return tTerm('settings.validation.lateFee.duplicatePriority');
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
  const label = active ? tTerm('common.status.active') : tTerm('common.status.inactive');
  const description = active
    ? tTerm('settings.status.active.description')
    : tTerm('settings.status.inactive.description');

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
  const { t } = useTranslation();
  const { data: usersData, registerWithPermissions, deactivateUser, reactivateUser } = useUsers({ page: 1, pageSize: 100, role: 'employee' });
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>({
    name: '',
    email: '',
    password: '',
  });
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

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
        title: t('errors.deactivateConfirmTitle'),
        message: t('errors.deactivateConfirmBody', { name: employeeLabel }),
        confirmLabel: t('errors.deactivateConfirmAction'),
      });
      if (!confirmed) return;
    }

    try {
      if (isActive) {
        await deactivateUser.mutateAsync(Number(employee.id));
        toast.success({ description: t('errors.employeeDeactivated') });
        return;
      }

      await reactivateUser.mutateAsync(Number(employee.id));
      toast.success({ description: t('errors.employeeReactivated') });
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
      toast.error({ description: t('errors.employeeNameRequired') });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      toast.error({ description: t('errors.employeeEmailInvalid') });
      return;
    }

    if (password.length < 8) {
      toast.error({ description: t('errors.employeePasswordShort') });
      return;
    }

    const duplicateEmail = employees.some((employee: any) => String(employee?.email || '').toLowerCase() === email);
    if (duplicateEmail) {
      toast.error({ description: t('errors.employeeEmailDuplicate') });
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
      toast.success({ description: t('errors.employeeCreated') });
    } catch (error) {
      console.error('[settings] create employee failed', error);
      toast.apiErrorSafe(error, { domain: 'users', action: 'generic' });
    }
  };

  return (
    <div className="space-y-5">
      <InsightStrip
        aria-label={t('settings.employees.summary.total')}
        items={[
          {
            id: 'settings-employees-total',
            label: t('settings.employees.summary.total'),
            value: employees.length,
            helper: t('settings.employees.summary.totalHelper'),
            icon: <UserPlus size={18} />,
            accent: 'slate',
          },
          {
            id: 'settings-employees-active',
            label: t('settings.employees.summary.active'),
            value: activeEmployees.length,
            helper: t('settings.employees.summary.activeHelper'),
            icon: <UserCheck size={18} />,
            accent: 'emerald',
          },
          {
            id: 'settings-employees-inactive',
            label: t('settings.employees.summary.inactive'),
            value: inactiveEmployees.length,
            helper: t('settings.employees.summary.inactiveHelper'),
            icon: <UserX size={18} />,
            accent: 'rose',
          },
        ]}
      />

      <SectionSurface
        as="form"
        onSubmit={handleCreateEmployee}
        aria-label={t('settings.employees.create.title')}
        title={t('settings.employees.create.title')}
        subtitle={t('settings.employees.create.subtitle')}
        bodyClassName="space-y-4"
      >
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
          <FormField
            label={t('settings.employees.create.nameLabel')}
            tooltip={t('settings.employees.create.nameTooltip')}
          >
            <TextInput
              aria-label={t('settings.employees.create.nameLabel')}
              required
              value={employeeDraft.name}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, name: event.target.value }))}
              placeholder={t('settings.employees.create.namePlaceholder')}
            />
          </FormField>
          <FormField
            label={t('settings.employees.create.emailLabel')}
            tooltip={t('settings.employees.create.emailTooltip')}
          >
            <TextInput
              aria-label={t('settings.employees.create.emailLabel')}
              required
              type="email"
              value={employeeDraft.email}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, email: event.target.value }))}
              placeholder={t('settings.employees.create.emailPlaceholder')}
            />
          </FormField>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,0.55fr)_auto]">
          <FormField
            label={t('settings.employees.create.passwordLabel')}
            tooltip={t('settings.employees.create.passwordTooltip')}
          >
            <TextInput
              aria-label={t('settings.employees.create.passwordLabel')}
              required
              type="password"
              minLength={8}
              value={employeeDraft.password}
              onChange={(event) => setEmployeeDraft((previous) => ({ ...previous, password: event.target.value }))}
              placeholder={t('settings.employees.create.passwordPlaceholder')}
            />
          </FormField>
          <div className="settings-form-actions">
            <ActionButton
              type="submit"
              disabled={registerWithPermissions.isPending}
              variant="primary"
              icon={<UserPlus size={16} />}
            >
              {t('settings.employees.create.submit')}
            </ActionButton>
          </div>
        </div>
        <p className="settings-inline-note">
          {t('settings.employees.create.note')}
        </p>
      </SectionSurface>

      <DataTableSurface aria-label={t('settings.employees.table.title')}>
        <div className="overflow-x-auto">
          <table className="min-w-[760px]" aria-label={t('settings.employees.table.title')}>
            <thead>
              <tr>
                <th>{t('settings.employees.table.empleadoCol')}</th>
                <th>{t('settings.employees.table.emailCol')}</th>
                <th>{t('settings.employees.table.statusCol')}</th>
                <th>{t('settings.employees.table.createdAtCol')}</th>
                <th className="text-right">{t('settings.employees.table.actionsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee: any) => (
                <tr key={employee.id}>
                  <td>
                    <p className="font-semibold text-text-primary">{employee.name || t('settings.employees.table.nameMissing')}</p>
                    <p className="mt-1 text-xs text-text-secondary">{t('settings.employees.table.roleHint')}</p>
                  </td>
                  <td className="text-text-secondary">{employee.email}</td>
                  <td><StatusBadge active={employee.isActive !== false} /></td>
                  <td className="text-text-secondary">
                    {employee.createdAt
                      ? formatDateValue(employee.createdAt, { day: '2-digit', month: 'short', year: 'numeric' }) || '—'
                      : '—'}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <ActionButton
                        type="button"
                        onClick={() => setEditingEmployee(employee)}
                        variant="secondary"
                        icon={<PencilLine size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                        title={t('settings.employees.actions.editTitle')}
                      >
                        {t('settings.employees.actions.edit')}
                      </ActionButton>
                      <ActionButton
                        type="button"
                        onClick={() => handleToggleEmployeeStatus(employee)}
                        disabled={deactivateUser.isPending || reactivateUser.isPending}
                        variant={employee.isActive === false ? 'secondary' : 'danger'}
                        icon={employee.isActive === false ? <UserCheck size={14} /> : <UserX size={14} />}
                        className="min-h-8 px-3 py-1.5 text-xs"
                        title={employee.isActive === false
                          ? t('settings.employees.actions.reactivateTitle')
                          : t('settings.employees.actions.deactivateTitle')}
                      >
                        {employee.isActive === false ? t('common.activate') : t('common.deactivate')}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-state">{t('settings.employees.table.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataTableSurface>

      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
        />
      )}
    </div>
  );
}

export default function Settings() {
  const { locale } = useTranslation();
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
      tTerm('settings.coverage.bucket.low', { amount: formatCurrency(DEFAULT_LOW_AMOUNT_LIMIT) }),
      DEFAULT_LOW_AMOUNT_LIMIT,
      findRatePolicyMatchesForAmount(activeRatePolicies, String(DEFAULT_LOW_AMOUNT_LIMIT)),
    ),
    buildRateCoverageCheck(
      tTerm('settings.coverage.bucket.high', { amount: formatCurrency(DEFAULT_HIGH_AMOUNT_START) }),
      DEFAULT_HIGH_AMOUNT_START,
      findRatePolicyMatchesForAmount(activeRatePolicies, String(DEFAULT_HIGH_AMOUNT_START)),
    ),
  ], [activeRatePolicies, locale]);
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
      toast.error({ title: tTerm('settings.validation.reviewConfig'), description: validationError });
      return;
    }

    try {
      await createPaymentMethod.mutateAsync({
        ...newPaymentMethod,
        isActive: true,
      });
      setNewPaymentMethod({ name: '', description: '', type: 'bank_transfer' });
      toast.success({ description: tTerm('settings.paymentMethods.toast.created') });
    } catch (error) {
      console.error('[settings] createPaymentMethod failed', error);
      toast.apiErrorSafe(error, { domain: 'config', action: 'config.update' });
    }
  };

  const handleCreateRatePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateRatePolicyDraft(newRatePolicy, ratePolicies, editingRatePolicyId);
    if (validationError) {
      toast.error({ title: tTerm('settings.rate.toast.review'), description: validationError });
      return;
    }

    try {
      if (editingRatePolicyId) {
        await updateRatePolicy.mutateAsync({ id: editingRatePolicyId, ...buildRatePayload(newRatePolicy) });
        toast.success({ description: tTerm('settings.rate.toast.updated') });
      } else {
        await createRatePolicy.mutateAsync(buildRatePayload(newRatePolicy));
        toast.success({ description: tTerm('settings.rate.toast.created') });
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
      toast.error({ title: tTerm('settings.lateFee.toast.review'), description: validationError });
      return;
    }

    try {
      await createLateFeePolicy.mutateAsync(buildLateFeePayload(newLateFeePolicy));
      setNewLateFeePolicy({ label: '', annualEffectiveRate: '', lateFeeMode: 'SIMPLE', priority: '100', description: '' });
      toast.success({ description: tTerm('settings.lateFee.toast.created') });
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
    const confirmed = await confirmDanger({ title, message, confirmLabel: tTerm('settings.validation.deleteConfirm') });
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
          title={tTerm('settings.module.title')}
          subtitle={tTerm('settings.module.loadingSubtitle')}
          guideKey="settings"
          tourId="settings-header"
        />
        <div className="table-empty-state">{tTerm('settings.state.loading')}</div>
      </PageShell>
    );
  }

  return (
    <PageShell data-tour="settings-page" className="settings-page">
      <PageHeader
        title={tTerm('settings.module.title')}
        subtitle={tTerm('settings.module.subtitle')}
        guideKey="settings"
        tourId="settings-header"
      />

      <ViewTabs
        data-tour="settings-tabs"
        ariaLabel={tTerm('settings.tabs.aria')}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as SettingsTab)}
        tabs={[
          { id: 'payment-methods', label: tTerm('settings.tabs.paymentMethods'), count: paymentMethods.length, icon: CreditCard },
          { id: 'rate-policies', label: tTerm('settings.tabs.ratePolicies'), count: ratePolicies.length, icon: Percent },
          { id: 'late-fee-policies', label: tTerm('settings.tabs.lateFeePolicies'), count: lateFeePolicies.length, icon: AlertTriangle },
          { id: 'employees', label: tTerm('settings.tabs.employees'), icon: ShieldCheck },
        ]}
      />

      <section className="settings-content" data-tour="settings-content">
        {activeTab === 'employees' && <EmployeeAccessPanel />}

        {activeTab === 'payment-methods' && (
          <>
            <SectionSurface
              as="form"
              onSubmit={handleCreatePaymentMethod}
              aria-label={tTerm('settings.paymentMethods.section.aria')}
              title={tTerm('settings.paymentMethods.section.title')}
              subtitle={tTerm('settings.paymentMethods.section.subtitle')}
              bodyClassName="space-y-4"
            >
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
                <FormField
                  label={tTerm('settings.paymentMethods.field.name')}
                  tooltip={tTerm('settings.paymentMethods.field.nameTooltip')}
                >
                  <TextInput
                    aria-label={tTerm('settings.paymentMethods.field.name')}
                    required
                    value={newPaymentMethod.name}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={tTerm('settings.paymentMethods.field.namePlaceholder')}
                  />
                </FormField>

                <FormField
                  label={tTerm('settings.paymentMethods.field.type')}
                  tooltip={tTerm('settings.paymentMethods.field.typeTooltip')}
                >
                  <SelectInput
                    aria-label={tTerm('settings.paymentMethods.field.type')}
                    value={newPaymentMethod.type}
                    onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, type: event.target.value as PaymentMethodDraft['type'] }))}
                  >
                    <option value="bank_transfer">{tTerm('settings.paymentMethods.type.bankTransfer')}</option>
                    <option value="cash">{tTerm('settings.paymentMethods.type.cash')}</option>
                    <option value="card">{tTerm('settings.paymentMethods.type.card')}</option>
                    <option value="other">{tTerm('settings.paymentMethods.type.other')}</option>
                  </SelectInput>
                </FormField>
              </div>
              <FormField label={tTerm('settings.paymentMethods.field.description')}>
                <TextInput
                  aria-label={tTerm('settings.paymentMethods.field.description')}
                  value={newPaymentMethod.description}
                  onChange={(event) => setNewPaymentMethod((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={tTerm('settings.paymentMethods.field.descriptionPlaceholder')}
                />
              </FormField>
              <div className="settings-form-actions">
                <ActionButton
                  type="submit"
                  disabled={createPaymentMethod.isPending}
                  variant="primary"
                  icon={<Plus size={16} />}
                >
                  {tTerm('settings.paymentMethods.cta.create')}
                </ActionButton>
                <p className="settings-inline-helper">
                  {tTerm('settings.paymentMethods.note')}
                </p>
              </div>
            </SectionSurface>

            <DataTableSurface>
              <div className="overflow-x-auto">
                <table className="min-w-[760px]" aria-label={tTerm('settings.paymentMethods.table.aria')}>
                  <thead>
                    <tr>
                      <th>{tTerm('settings.paymentMethods.table.method')}</th>
                      <th>{tTerm('settings.paymentMethods.table.type')}</th>
                      <th>{tTerm('settings.paymentMethods.table.reference')}</th>
                      <th>{tTerm('settings.paymentMethods.table.state')}</th>
                      <th className="text-right">{tTerm('settings.paymentMethods.table.actions')}</th>
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
                        <td className="text-text-secondary">{method.requiresReference ? tTerm('settings.paymentMethods.table.referenceRequired') : tTerm('settings.paymentMethods.table.referenceOptional')}</td>
                        <td><StatusBadge active={method.isActive !== false} /></td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              type="button"
                              onClick={async () => {
                                try {
                                  await updatePaymentMethod.mutateAsync({ id: method.id, isActive: method.isActive === false, type: method.type });
                                  toast.success({ description: method.isActive === false ? tTerm('settings.paymentMethods.toast.activated') : tTerm('settings.paymentMethods.toast.deactivated') });
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
                              {method.isActive === false ? tTerm('settings.paymentMethods.cta.activate') : tTerm('settings.paymentMethods.cta.deactivate')}
                            </ActionButton>
                            <ActionButton
                              type="button"
                              onClick={() => handleDelete({
                                title: tTerm('settings.paymentMethods.delete.title'),
                                message: tTerm('settings.paymentMethods.delete.message', { name: getMethodName(method) }),
                                action: () => deletePaymentMethod.mutateAsync(method.id),
                                successMessage: tTerm('settings.paymentMethods.toast.deleted'),
                              })}
                              disabled={deletePaymentMethod.isPending}
                              variant="danger"
                              icon={<Trash2 size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              {tTerm('settings.paymentMethods.cta.delete')}
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paymentMethods.length === 0 && (
                      <tr>
                        <td colSpan={5} className="table-empty-state">{tTerm('settings.paymentMethods.table.empty')}</td>
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
                  aria-label={tTerm('settings.rate.section.aria')}
                  title={isEditingRatePolicy ? tTerm('settings.rate.section.titleEdit') : tTerm('settings.rate.section.titleCreate')}
                  subtitle={isEditingRatePolicy
                    ? tTerm('settings.rate.section.subtitleEdit')
                    : tTerm('settings.rate.section.subtitleCreate')}
                  bodyClassName="space-y-4"
                >
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <FormField
                      label={tTerm('settings.rate.field.name')}
                    >
                      <TextInput
                        aria-label={tTerm('settings.rate.field.name')}
                        required
                        value={newRatePolicy.label}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, label: event.target.value }))}
                        placeholder={tTerm('settings.rate.field.namePlaceholderDefault')}
                      />
                    </FormField>
                    <FormField
                      label={tTerm('settings.rate.field.min')}
                      tooltip={tTerm('settings.rate.field.minTooltip')}
                    >
                      <TextInput
                        aria-label={tTerm('settings.rate.field.min')}
                        type="number"
                        min="0"
                        value={newRatePolicy.minAmount}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, minAmount: event.target.value }))}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField
                      label={tTerm('settings.rate.field.max')}
                      tooltip={tTerm('settings.rate.field.maxTooltip')}
                    >
                      <TextInput
                        aria-label={tTerm('settings.rate.field.max')}
                        type="number"
                        min="0"
                        value={newRatePolicy.maxAmount}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, maxAmount: event.target.value }))}
                        placeholder={tTerm('settings.range.noCap')}
                      />
                    </FormField>
                    <FormField
                      label={tTerm('settings.rate.field.annualRate')}
                      tooltip={tTerm('settings.rate.field.annualRateTooltip')}
                    >
                      <TextInput
                        aria-label={tTerm('settings.rate.field.annualRate')}
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
                      label={tTerm('settings.rate.field.priority')}
                      tooltip={tTerm('settings.rate.field.priorityTooltip')}
                    >
                      <TextInput
                        aria-label={tTerm('settings.rate.field.priority')}
                        type="number"
                        min="0"
                        value={newRatePolicy.priority}
                        onChange={(event) => setNewRatePolicy((prev) => ({ ...prev, priority: event.target.value }))}
                      />
                    </FormField>
                  </div>
                  <div className="settings-form-footer">
                    <p className="settings-inline-helper">
                      {tTerm('settings.rate.note')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditingRatePolicy && (
                        <ActionButton
                          type="button"
                          onClick={resetRatePolicyDraft}
                          disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                        >
                          {tTerm('common.cta.cancel')}
                        </ActionButton>
                      )}
                      <ActionButton
                        type="submit"
                        disabled={createRatePolicy.isPending || updateRatePolicy.isPending}
                        variant="primary"
                        icon={<Save size={16} />}
                      >
                        {isEditingRatePolicy ? tTerm('settings.rate.cta.saveChanges') : tTerm('settings.rate.cta.saveRule')}
                      </ActionButton>
                    </div>
                  </div>
                </SectionSurface>

                <DataTableSurface>
                  <div className="overflow-x-auto">
                    <table className="min-w-[860px]" aria-label={tTerm('settings.rate.table.aria')}>
                      <thead>
                        <tr>
                          <th><HelpLabel label={tTerm('settings.rate.table.rule')} text={tTerm('settings.rate.table.ruleTooltip')} /></th>
                          <th><HelpLabel label={tTerm('settings.rate.table.range')} text={tTerm('settings.rate.table.rangeTooltip')} /></th>
                          <th><HelpLabel label={tTerm('settings.rate.table.annualRate')} text={tTerm('settings.rate.table.annualRateTooltip')} /></th>
                          <th><HelpLabel label={tTerm('settings.rate.table.use')} text={tTerm('settings.rate.table.useTooltip')} /></th>
                          <th>{tTerm('settings.rate.table.state')}</th>
                          <th className="text-right">{tTerm('settings.rate.table.actions')}</th>
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
                                    <StatusChip tone="danger" size="sm" title={tTerm('settings.rate.table.conflictTitle')}>
                                      {tTerm('settings.rate.table.conflict')}
                                    </StatusChip>
                                  )}
                                </div>
                                {policy.description && (
                                  <p className="mt-1 max-w-[18rem] truncate text-xs text-text-secondary">{policy.description}</p>
                                )}
                                {conflictedRatePolicyIds.has(String(policy.id)) && (
                                  <p className="mt-1 max-w-[24rem] text-xs text-rose-700 dark:text-rose-200">
                                    {tTerm('settings.rate.table.conflictHelp')}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="text-text-secondary">{formatRange(policy.minAmount, policy.maxAmount)}</td>
                            <td className="font-semibold">{formatRate(policy.annualEffectiveRate)}</td>
                            <td className="text-text-secondary">{tTerm('settings.rate.table.order', { priority: Number(policy.priority || 100) })}</td>
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
                                  title={tTerm('settings.rate.table.editTitle')}
                                >
                                  {tTerm('settings.rate.table.edit')}
                                </ActionButton>
                                <ActionButton
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await updateRatePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                                      toast.success({ description: policy.isActive === false ? tTerm('settings.rate.toast.activated') : tTerm('settings.rate.toast.deactivated') });
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
                                  {policy.isActive === false ? tTerm('settings.rate.table.activate') : tTerm('settings.rate.table.deactivate')}
                                </ActionButton>
                                <ActionButton
                                  type="button"
                                  onClick={() => handleDelete({
                                    title: tTerm('settings.rate.delete.title'),
                                    message: tTerm('settings.rate.delete.message', { name: policy.label }),
                                    action: () => deleteRatePolicy.mutateAsync(policy.id),
                                    successMessage: tTerm('settings.rate.toast.deleted'),
                                  })}
                                  disabled={deleteRatePolicy.isPending}
                                  variant="danger"
                                  icon={<Trash2 size={14} />}
                                  className="min-h-8 px-3 py-1.5 text-xs"
                                >
                                  {tTerm('settings.rate.table.delete')}
                                </ActionButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {ratePolicies.length === 0 && (
                          <tr>
                            <td colSpan={6} className="table-empty-state">{tTerm('settings.rate.table.empty')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </DataTableSurface>
              </div>

              <SectionSurface
                title={tTerm('settings.coverage.title')}
                subtitle={tTerm('settings.coverage.subtitle')}
                bodyClassName="space-y-4"
              >
                {hasRatePolicyConflicts && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                    <p className="font-semibold">{tTerm('settings.coverage.conflictTitle')}</p>
                    <p className="mt-1">
                      {tTerm('settings.coverage.conflictDescription')}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {ratePolicyConflictPairs.slice(0, 3).map(([left, right]) => (
                        <li key={`${left?.id}-${right?.id}`}>
                          {tTerm('settings.coverage.conflictPair', { left: left?.label, right: right?.label, priority: Number(left?.priority || 100) })}
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
                            ? tTerm('settings.coverage.check.conflict', { labels: check.conflicts.map((policy) => policy.label).join(' y ') })
                            : check.policy ? tTerm('settings.coverage.check.covered', { label: check.policy.label }) : tTerm('settings.coverage.check.missing')}
                        </p>
                      </div>
                      <StatusChip tone={check.hasConflict ? 'danger' : check.policy ? 'success' : 'warning'} size="sm">
                        {check.status}
                      </StatusChip>
                    </div>
                  ))}
                  {hasMissingStandardRateCoverage && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {tTerm('settings.coverage.missingNote')}
                    </p>
                  )}
                </div>
                <FormField label={tTerm('settings.coverage.field.amount')}>
                  <TextInput
                    aria-label={tTerm('settings.coverage.field.amount')}
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
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">{tTerm('settings.coverage.resultEyebrow')}</p>
                      <p className="mt-1 truncate text-lg font-bold text-text-primary">
                        {previewRatePolicy ? formatRate(previewRatePolicy.annualEffectiveRate) : tTerm('settings.coverage.result.noApplicableRate')}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-text-secondary">
                        {previewRatePolicy ? previewRatePolicy.label : tTerm('settings.coverage.result.noActiveRule')}
                      </p>
                    </div>
                    <StatusChip
                      tone={previewRateConflicts.length > 1 ? 'danger' : previewRatePolicy ? 'success' : 'warning'}
                      size="sm"
                      icon={<Calculator size={14} />}
                      title={previewRateConflicts.length > 1
                        ? tTerm('settings.coverage.statusTitle.conflict')
                        : previewRatePolicy ? tTerm('settings.coverage.statusTitle.covered') : tTerm('settings.coverage.statusTitle.noRule')}
                    >
                      {previewRateConflicts.length > 1 ? tTerm('settings.coverage.status.conflict') : previewRatePolicy ? tTerm('settings.coverage.status.covered') : tTerm('settings.coverage.status.noRule')}
                    </StatusChip>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    {previewRateConflicts.length > 1
                      ? tTerm('settings.coverage.preview.conflict', { labels: previewRateConflicts.map((policy) => policy.label).join(' y ') })
                      : previewRatePolicy
                      ? tTerm('settings.coverage.preview.covered', { label: previewRatePolicy.label, range: formatRange(previewRatePolicy.minAmount, previewRatePolicy.maxAmount) })
                      : hasValidPreviewAmount
                        ? tTerm('settings.coverage.preview.createRule')
                        : tTerm('settings.coverage.preview.invalidAmount')}
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
              aria-label={tTerm('settings.lateFee.section.aria')}
              title={tTerm('settings.lateFee.section.title')}
              subtitle={tTerm('settings.lateFee.section.subtitle')}
              bodyClassName="space-y-4"
            >
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_190px_110px]">
                <FormField
                  label={tTerm('settings.lateFee.field.name')}
                  tooltip={tTerm('settings.lateFee.field.nameTooltip')}
                >
                  <TextInput
                    aria-label={tTerm('settings.lateFee.field.name')}
                    required
                    value={newLateFeePolicy.label}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder={tTerm('settings.lateFee.field.namePlaceholder')}
                  />
                </FormField>
                <FormField
                  label={tTerm('settings.lateFee.field.rate')}
                  tooltip={tTerm('settings.lateFee.field.rateTooltip')}
                >
                  <TextInput
                    aria-label={tTerm('settings.lateFee.field.rate')}
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newLateFeePolicy.annualEffectiveRate}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, annualEffectiveRate: event.target.value }))}
                    placeholder={tTerm('settings.lateFee.field.ratePlaceholder')}
                  />
                </FormField>
                <FormField
                  label={tTerm('settings.lateFee.field.mode')}
                  tooltip={tTerm('settings.lateFee.field.modeTooltip')}
                >
                  <SelectInput
                    aria-label={tTerm('settings.lateFee.field.mode')}
                    value={newLateFeePolicy.lateFeeMode}
                    onChange={(event) => setNewLateFeePolicy((prev) => ({ ...prev, lateFeeMode: event.target.value as LateFeePolicyDraft['lateFeeMode'] }))}
                  >
                    <option value="SIMPLE">{tTerm('settings.lateFee.type.simple')}</option>
                    <option value="COMPOUND">{tTerm('settings.lateFee.type.compound')}</option>
                    <option value="NONE">{tTerm('settings.lateFee.type.none')}</option>
                  </SelectInput>
                </FormField>
                <FormField
                  label={tTerm('settings.lateFee.field.priority')}
                  tooltip={tTerm('settings.lateFee.field.priorityTooltip')}
                >
                  <TextInput
                    aria-label={tTerm('settings.lateFee.field.priority')}
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
                  {tTerm('settings.lateFee.cta.create')}
                </ActionButton>
                <p className="settings-inline-helper">
                  {tTerm('settings.lateFee.note')}
                </p>
              </div>
            </SectionSurface>

            <DataTableSurface>
              <div className="overflow-x-auto">
                <table className="min-w-[760px]" aria-label={tTerm('settings.lateFee.table.aria')}>
                  <thead>
                    <tr>
                      <th>{tTerm('settings.lateFee.table.policy')}</th>
                      <th>{tTerm('settings.lateFee.table.rate')}</th>
                      <th>{tTerm('settings.lateFee.table.calculation')}</th>
                      <th>{tTerm('settings.lateFee.table.priority')}</th>
                      <th>{tTerm('settings.lateFee.table.state')}</th>
                      <th className="text-right">{tTerm('settings.lateFee.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateFeePolicies.map((policy: any) => (
                      <tr key={policy.id}>
                        <td className="font-semibold">{policy.label}</td>
                        <td className="font-semibold">{policy.annualEffectiveRate}%</td>
                        <td className="text-text-secondary">{getLateFeeModeLabel(policy.lateFeeMode)}</td>
                        <td className="text-text-secondary">{policy.priority}</td>
                        <td><StatusBadge active={policy.isActive !== false} /></td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateLateFeePolicy.mutateAsync({ id: policy.id, isActive: policy.isActive === false });
                                  toast.success({ description: policy.isActive === false ? tTerm('settings.lateFee.toast.activated') : tTerm('settings.lateFee.toast.deactivated') });
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
                              {policy.isActive === false ? tTerm('settings.lateFee.table.activate') : tTerm('settings.lateFee.table.deactivate')}
                            </ActionButton>
                            <ActionButton
                              type="button"
                              onClick={() => handleDelete({
                                title: tTerm('settings.lateFee.delete.title'),
                                message: tTerm('settings.lateFee.delete.message', { name: policy.label }),
                                action: () => deleteLateFeePolicy.mutateAsync(policy.id),
                                successMessage: tTerm('settings.lateFee.toast.deleted'),
                              })}
                              disabled={deleteLateFeePolicy.isPending}
                              variant="danger"
                              icon={<Trash2 size={14} />}
                              className="min-h-8 px-3 py-1.5 text-xs"
                            >
                              {tTerm('settings.lateFee.table.delete')}
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {lateFeePolicies.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table-empty-state">{tTerm('settings.lateFee.table.empty')}</td>
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
