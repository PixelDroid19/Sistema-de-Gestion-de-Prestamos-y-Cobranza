import { CLOSED_OR_BLOCKED_LOAN_STATUSES, NON_EXECUTABLE_INSTALLMENT_STATUSES } from '../constants/operationalStates';
import { LOAN_STATUS_LABELS, type BackendSupportedLoanStatus } from '../constants/loanStates';
import { PERMISSION } from '../constants/permissionNames';

export type OperationalRole = 'admin' | 'employee' | 'socio' | 'customer' | string;

export type OperationalPermission = string;

export type GuardedAction =
  | 'credit.view'
  | 'credit.delete'
  | 'credit.report.download'
  | 'credit.payouts.navigate'
  | 'credit.status.update'
  | 'installment.pay'
  | 'installment.editPaymentMethod'
  | 'installment.promise'
  | 'installment.followUp'
  | 'installment.annul'
  | 'capital.payment'
  | 'lateFee.update'
  | 'payout.register'
  | 'payout.voucher.download'
  | 'payout.credit.view'
  | 'payout.metadata.edit'
  | 'payout.delete';

type GuardInput = {
  role?: OperationalRole;
  permissions?: OperationalPermission[];
  loanStatus?: string;
  installmentStatus?: string;
  paymentStatus?: string;
  paymentReconciled?: boolean;
  payoutType?: 'regular' | 'partial' | 'capital';
};

type GuardResult = {
  visible: boolean;
  executable: boolean;
  reason?: string;
};

const CLOSED_LOAN_STATUSES = new Set<string>(CLOSED_OR_BLOCKED_LOAN_STATUSES);
const NON_EXECUTABLE_STATUSES = new Set<string>(NON_EXECUTABLE_INSTALLMENT_STATUSES);
const PAYABLE_LOAN_STATUSES = new Set<string>(['pending', 'approved', 'active', 'defaulted', 'overdue']);
const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada',
  annulled: 'Anulada',
};

const formatLoanStatus = (loanStatus?: string): string => {
  const normalizedStatus = String(loanStatus || '').toLowerCase();
  return LOAN_STATUS_LABELS[normalizedStatus as BackendSupportedLoanStatus] || 'no operativo';
};

const formatInstallmentStatus = (installmentStatus?: string): string => {
  const normalizedStatus = String(installmentStatus || '').toLowerCase();
  return INSTALLMENT_STATUS_LABELS[normalizedStatus] || 'no operativa';
};

const sentenceCaseStatus = (label: string): string => label
  ? label.charAt(0).toLowerCase() + label.slice(1)
  : label;

const unavailableLoanStatusReason = (loanStatus?: string): string => (
  `Crédito ${sentenceCaseStatus(formatLoanStatus(loanStatus))}: acción no disponible.`
);

const unavailableInstallmentStatusReason = (installmentStatus?: string): string => (
  `Cuota ${sentenceCaseStatus(formatInstallmentStatus(installmentStatus))}: acción no disponible.`
);

const actionPermissionMap: Partial<Record<GuardedAction, OperationalPermission[]>> = {
  'credit.delete': [PERMISSION.CREDITS_DELETE, 'credits.delete', 'credit.delete'],
  'credit.report.download': [PERMISSION.REPORTS_VIEW_ALL, 'reports.download', 'credit.report.download'],
  'credit.payouts.navigate': [PERMISSION.PAYMENTS_VIEW_ALL, 'payments.view', 'payouts.view', 'credit.payouts.navigate'],
  'credit.status.update': [PERMISSION.CREDITS_UPDATE, 'credits.updateStatus', 'credits.update', 'credit.status.update'],
  'installment.pay': [PERMISSION.PAYMENTS_CREATE, 'payments.create', 'installment.pay'],
  'installment.editPaymentMethod': [PERMISSION.PAYMENTS_UPDATE, 'payments.update', 'installment.editPaymentMethod'],
  'installment.promise': ['promises.create', 'installment.promise'],
  'installment.followUp': ['followups.create', 'installment.followUp'],
  'installment.annul': [PERMISSION.PAYMENTS_REVERSE, 'payments.annul', 'installment.annul'],
  'capital.payment': [PERMISSION.PAYMENTS_CREATE, 'payments.create', 'capital.payment'],
  'lateFee.update': [PERMISSION.CREDITS_UPDATE, 'loans.update', 'lateFee.update'],
  'payout.register': [PERMISSION.PAYMENTS_CREATE, 'payments.create', 'payout.register'],
  'payout.voucher.download': [PERMISSION.PAYMENTS_VIEW_ALL, 'payments.view', 'payout.voucher.download'],
  'payout.credit.view': [PERMISSION.CREDITS_VIEW_ALL, 'credits.view', 'payout.credit.view'],
  'payout.metadata.edit': [PERMISSION.PAYMENTS_UPDATE, 'payments.update', 'payout.metadata.edit'],
  'payout.delete': [PERMISSION.PAYMENTS_DELETE, 'payments.delete', 'payout.delete'],
};

const isAdminRole = (role?: OperationalRole) => role === 'admin';
const isBackofficeRole = (role?: OperationalRole) => role === 'admin' || role === 'employee';

const hasRequiredPermission = (
  role: OperationalRole | undefined,
  permissions: OperationalPermission[] | undefined,
  action: GuardedAction,
): boolean => {
  const requiredPermissions = actionPermissionMap[action];

  if (isAdminRole(role)) {
    return true;
  }

  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (!permissions || permissions.length === 0) {
    return false;
  }

  const granted = new Set(permissions.map((permission) => permission.toLowerCase()));

  if (granted.has('*') || granted.has('admin') || granted.has('all')) {
    return true;
  }

  return requiredPermissions.some((permission) => granted.has(permission.toLowerCase()));
};

const canDeleteCredit = (role?: OperationalRole, loanStatus?: string): GuardResult => {
  if (!isAdminRole(role)) {
    return { visible: false, executable: false, reason: 'Solo administradores pueden eliminar créditos.' };
  }

  if (loanStatus === 'closed' || loanStatus === 'completed') {
    return { visible: true, executable: false, reason: 'No se puede eliminar un crédito cerrado o completado.' };
  }

  return { visible: true, executable: true };
};

const canOperateInstallment = (
  role: OperationalRole | undefined,
  loanStatus: string | undefined,
  installmentStatus: string | undefined,
  actionLabel: string,
): GuardResult => {
  if (!isBackofficeRole(role)) {
    return { visible: false, executable: false, reason: `Solo el equipo autorizado puede gestionar ${actionLabel}.` };
  }

  if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
    return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
  }

  if (installmentStatus && NON_EXECUTABLE_STATUSES.has(installmentStatus)) {
    return { visible: true, executable: false, reason: unavailableInstallmentStatusReason(installmentStatus) };
  }

  return { visible: true, executable: true };
};

const canProcessLoanPayments = (
  role: OperationalRole | undefined,
  loanStatus: string | undefined,
  installmentStatus: string | undefined,
  actionLabel: string,
): GuardResult => {
  if (!isBackofficeRole(role)) {
    return { visible: false, executable: false, reason: 'Acción no disponible para este tipo de usuario.' };
  }

  const installmentGuard = canOperateInstallment(role, loanStatus, installmentStatus, actionLabel);

  if (!installmentGuard.visible || !installmentGuard.executable) {
    return installmentGuard;
  }

  if (loanStatus && !PAYABLE_LOAN_STATUSES.has(loanStatus)) {
    return {
      visible: true,
      executable: false,
      reason: unavailableLoanStatusReason(loanStatus),
    };
  }

  return installmentGuard;
};

const isReconciledPaymentStatus = (status?: string): boolean => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized.includes('reconcil') || normalized === 'bank_reconciled';
};

const canRegisterPayout = (
  role: OperationalRole | undefined,
  payoutType: GuardInput['payoutType'],
): GuardResult => {
  if (!isBackofficeRole(role)) {
    return { visible: false, executable: false, reason: 'Solo el equipo autorizado puede registrar pagos.' };
  }

  if (payoutType === 'regular') {
    return {
      visible: false,
      executable: false,
      reason: 'El pago regular no está disponible en el módulo administrativo.',
    };
  }

  if (payoutType === 'capital') {
    return { visible: true, executable: true };
  }

  return { visible: true, executable: true };
};

export const resolveOperationalGuard = (action: GuardedAction, input: GuardInput): GuardResult => {
  const role = input.role;
  const permissions = input.permissions;
  const loanStatus = input.loanStatus;
  const installmentStatus = input.installmentStatus;
  const paymentStatus = input.paymentStatus;
  const paymentReconciled = Boolean(input.paymentReconciled) || isReconciledPaymentStatus(paymentStatus);
  const payoutType = input.payoutType;

  if (!hasRequiredPermission(role, permissions, action)) {
    return {
      visible: false,
      executable: false,
      reason: 'No cuenta con permisos para ejecutar esta acción.',
    };
  }

  switch (action) {
    case 'credit.view':
      return { visible: true, executable: true };
    case 'credit.report.download':
    case 'credit.payouts.navigate':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Acción disponible solo para usuarios administrativos.' };
      }
      return { visible: true, executable: true };
    case 'credit.delete':
      return canDeleteCredit(role, loanStatus);
    case 'installment.pay':
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'pagos de cuota');
    case 'installment.editPaymentMethod':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Solo el equipo autorizado puede editar métodos de pago.' };
      }
      if (paymentReconciled) {
        return {
          visible: true,
          executable: false,
          reason: 'No se puede editar el método de pago porque el pago ya está conciliado.',
        };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'edición de método de pago');
    case 'installment.promise':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Los compromisos de pago son gestión interna del equipo de cobranza.' };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'promesas de pago');
    case 'installment.followUp':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Los seguimientos son gestión interna del equipo de cobranza.' };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'seguimientos');
    case 'installment.annul':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Solo el equipo autorizado puede anular cuotas.' };
      }
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'anulación de cuotas');
    case 'capital.payment':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'El abono a capital solo está disponible para el equipo autorizado.' };
      }
      if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
      }
      if (loanStatus && !PAYABLE_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
      }
      return { visible: true, executable: true };
    case 'lateFee.update':
      if (!isAdminRole(role)) {
        return { visible: false, executable: false, reason: 'Solo administradores pueden actualizar la tasa de mora.' };
      }
      if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
      }
      return { visible: true, executable: true };
    case 'payout.register':
      return canRegisterPayout(role, payoutType);
    case 'payout.voucher.download':
    case 'payout.credit.view':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Acción disponible solo para usuarios administrativos.' };
      }
      return { visible: true, executable: true };
    case 'credit.status.update':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Solo el equipo autorizado puede actualizar el estado del crédito.' };
      }
      if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
      }
      return { visible: true, executable: true };
    case 'payout.metadata.edit':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: 'Solo el equipo autorizado puede editar pagos.' };
      }
      if (paymentReconciled) {
        return {
          visible: true,
          executable: false,
          reason: 'No se puede editar el método de pago porque el pago está conciliado.',
        };
      }
      if (paymentStatus === 'annulled') {
        return { visible: true, executable: false, reason: 'No se puede editar un pago anulado.' };
      }
      return { visible: true, executable: true };
    case 'payout.delete':
      if (!isAdminRole(role)) {
        return { visible: false, executable: false, reason: 'Solo administradores pueden eliminar pagos.' };
      }
      return {
        visible: true,
        executable: false,
        reason: 'La eliminación directa de pagos no está disponible. Use anulación de cuota desde el detalle del crédito.',
      };
    default:
      return { visible: false, executable: false, reason: 'Acción no reconocida.' };
  }
};
