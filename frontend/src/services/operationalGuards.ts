import { CLOSED_OR_BLOCKED_LOAN_STATUSES, NON_EXECUTABLE_INSTALLMENT_STATUSES } from '../constants/operationalStates';

export type OperationalRole = 'admin' | 'socio' | 'customer' | string;

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
const PAYABLE_LOAN_STATUSES = new Set<string>(['approved', 'active', 'defaulted', 'overdue']);

const actionPermissionMap: Partial<Record<GuardedAction, OperationalPermission[]>> = {
  'credit.delete': ['credits.delete', 'credit.delete'],
  'credit.report.download': ['reports_export', 'reports.download', 'credit.report.download'],
  'credit.payouts.navigate': ['payments.view', 'payouts.view', 'credit.payouts.navigate'],
  'credit.status.update': ['credits.updateStatus', 'credits.update', 'credit.status.update'],
  'installment.pay': ['payments_create', 'payments.create', 'installment.pay'],
  'installment.editPaymentMethod': ['payments_update', 'payments.update', 'installment.editPaymentMethod'],
  'installment.promise': ['promises.create', 'installment.promise'],
  'installment.followUp': ['followups.create', 'installment.followUp'],
  'installment.annul': ['payments_annul', 'payments.annul', 'installment.annul'],
  'capital.payment': ['payments_create', 'payments.create', 'capital.payment'],
  'lateFee.update': ['loans_update', 'loans.update', 'lateFee.update'],
  'payout.register': ['payments_create', 'payments.create', 'payout.register'],
  'payout.voucher.download': ['payments_view_all', 'payments.view', 'payout.voucher.download'],
  'payout.credit.view': ['credits_view_all', 'credits.view', 'payout.credit.view'],
  'payout.metadata.edit': ['payments_update', 'payments.update', 'payout.metadata.edit'],
  'payout.delete': ['payments_delete', 'payments.delete', 'payout.delete'],
};

const hasRequiredPermission = (permissions: OperationalPermission[] | undefined, action: GuardedAction): boolean => {
  const requiredPermissions = actionPermissionMap[action];

  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  if (!permissions || permissions.length === 0) {
    return true;
  }

  const granted = new Set(permissions.map((permission) => permission.toLowerCase()));

  if (granted.has('*') || granted.has('admin') || granted.has('all')) {
    return true;
  }

  return requiredPermissions.some((permission) => granted.has(permission.toLowerCase()));
};

const canDeleteCredit = (role?: OperationalRole, loanStatus?: string): GuardResult => {
  if (role !== 'admin') {
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
  if (role === 'customer') {
    return { visible: false, executable: false, reason: `Clientes no pueden ejecutar ${actionLabel}.` };
  }

  if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
    return { visible: true, executable: false, reason: `Crédito ${loanStatus}: acción no disponible.` };
  }

  if (installmentStatus && NON_EXECUTABLE_STATUSES.has(installmentStatus)) {
    return { visible: true, executable: false, reason: `Cuota ${installmentStatus}: acción no disponible.` };
  }

  return { visible: true, executable: true };
};

const canProcessLoanPayments = (
  role: OperationalRole | undefined,
  loanStatus: string | undefined,
  installmentStatus: string | undefined,
  actionLabel: string,
): GuardResult => {
  const installmentGuard = canOperateInstallment(role, loanStatus, installmentStatus, actionLabel);

  if (!installmentGuard.visible || !installmentGuard.executable) {
    return installmentGuard;
  }

  if (loanStatus && !PAYABLE_LOAN_STATUSES.has(loanStatus)) {
    return {
      visible: true,
      executable: false,
      reason: `Crédito ${loanStatus}: acción no disponible.`,
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
  if (payoutType === 'regular') {
    if (role === 'customer') {
      return { visible: true, executable: true };
    }

    return {
      visible: false,
      executable: false,
      reason: 'El pago regular solo está disponible para clientes autenticados.',
    };
  }

  if (payoutType === 'capital') {
    if (role === 'admin') {
      return { visible: true, executable: true };
    }

    return {
      visible: false,
      executable: false,
      reason: 'El abono a capital solo está disponible para administradores.',
    };
  }

  if (role === 'admin' || role === 'customer') {
    return { visible: true, executable: true };
  }

  return {
    visible: false,
    executable: false,
    reason: 'El pago parcial solo está disponible para administradores o clientes.',
  };
};

export const resolveOperationalGuard = (action: GuardedAction, input: GuardInput): GuardResult => {
  const role = input.role;
  const permissions = input.permissions;
  const loanStatus = input.loanStatus;
  const installmentStatus = input.installmentStatus;
  const paymentStatus = input.paymentStatus;
  const paymentReconciled = Boolean(input.paymentReconciled) || isReconciledPaymentStatus(paymentStatus);
  const payoutType = input.payoutType;

  if (!hasRequiredPermission(permissions, action)) {
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
      if (role === 'customer') {
        return { visible: false, executable: false, reason: 'Acción no disponible para clientes.' };
      }
      return { visible: true, executable: true };
    case 'credit.delete':
      return canDeleteCredit(role, loanStatus);
    case 'installment.pay':
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'pagos de cuota');
    case 'installment.editPaymentMethod':
      if (paymentReconciled) {
        return {
          visible: true,
          executable: false,
          reason: 'No se puede editar el método de pago porque el pago ya está conciliado.',
        };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'edición de método de pago');
    case 'installment.promise':
      return canOperateInstallment(role, loanStatus, installmentStatus, 'promesas de pago');
    case 'installment.followUp':
      return canOperateInstallment(role, loanStatus, installmentStatus, 'seguimientos');
    case 'installment.annul':
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'anulación de cuotas');
    case 'capital.payment':
      if (role === 'customer') {
        return { visible: false, executable: false, reason: 'Acción no disponible para clientes.' };
      }
      if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: `Crédito ${loanStatus}: acción no disponible.` };
      }
      if (loanStatus && !PAYABLE_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: `Crédito ${loanStatus}: acción no disponible.` };
      }
      return { visible: true, executable: true };
    case 'lateFee.update':
      if (role !== 'admin') {
        return { visible: false, executable: false, reason: 'Solo administradores pueden actualizar la tasa de mora.' };
      }
      return { visible: true, executable: true };
    case 'payout.register':
      return canRegisterPayout(role, payoutType);
    case 'payout.voucher.download':
    case 'payout.credit.view':
      if (role === 'customer') {
        return { visible: false, executable: false, reason: 'Acción no disponible para clientes.' };
      }
      return { visible: true, executable: true };
    case 'credit.status.update':
      if (role !== 'admin') {
        return { visible: false, executable: false, reason: 'Solo administradores pueden actualizar el estado del crédito.' };
      }
      return { visible: true, executable: true };
    case 'payout.metadata.edit':
      if (role !== 'admin') {
        return { visible: false, executable: false, reason: 'Solo administradores pueden editar pagos.' };
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
      if (role !== 'admin') {
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
