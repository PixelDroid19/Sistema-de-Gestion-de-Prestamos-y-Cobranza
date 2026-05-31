import { CLOSED_OR_BLOCKED_LOAN_STATUSES, NON_EXECUTABLE_INSTALLMENT_STATUSES } from '../constants/operationalStates';
import type { BackendSupportedLoanStatus } from '../constants/loanStates';
import { PERMISSION } from '../constants/permissionNames';
import { tTerm, type TermKey } from '../i18n/terminology';

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
const LOAN_STATUS_LABEL_KEYS: Record<BackendSupportedLoanStatus, TermKey> = {
  pending: 'operational.guard.status.loan.pending',
  approved: 'operational.guard.status.loan.approved',
  rejected: 'operational.guard.status.loan.rejected',
  active: 'operational.guard.status.loan.active',
  overdue: 'operational.guard.status.loan.overdue',
  paid: 'operational.guard.status.loan.paid',
  closed: 'operational.guard.status.loan.closed',
  defaulted: 'operational.guard.status.loan.defaulted',
  cancelled: 'operational.guard.status.loan.cancelled',
};
const INSTALLMENT_STATUS_LABEL_KEYS: Record<string, TermKey> = {
  paid: 'operational.guard.status.installment.paid',
  annulled: 'operational.guard.status.installment.annulled',
};

const formatLoanStatus = (loanStatus?: string): string => {
  const normalizedStatus = String(loanStatus || '').toLowerCase();
  return tTerm(LOAN_STATUS_LABEL_KEYS[normalizedStatus as BackendSupportedLoanStatus] ?? 'operational.guard.status.loan.fallback');
};

const formatInstallmentStatus = (installmentStatus?: string): string => {
  const normalizedStatus = String(installmentStatus || '').toLowerCase();
  return tTerm(INSTALLMENT_STATUS_LABEL_KEYS[normalizedStatus] ?? 'operational.guard.status.installment.fallback');
};

const sentenceCaseStatus = (label: string): string => label
  ? label.charAt(0).toLowerCase() + label.slice(1)
  : label;

const unavailableLoanStatusReason = (loanStatus?: string): string => tTerm('operational.guard.reason.loanStatusUnavailable', {
  status: sentenceCaseStatus(formatLoanStatus(loanStatus)),
});

const unavailableInstallmentStatusReason = (installmentStatus?: string): string => tTerm('operational.guard.reason.installmentStatusUnavailable', {
  status: sentenceCaseStatus(formatInstallmentStatus(installmentStatus)),
});

const actionPermissionMap: Partial<Record<GuardedAction, OperationalPermission[]>> = {
  'credit.delete': [PERMISSION.CREDITS_DELETE, 'credits.delete', 'credit.delete'],
  'credit.report.download': [PERMISSION.REPORTS_VIEW_ALL, 'reports.download', 'credit.report.download'],
  'credit.payouts.navigate': [PERMISSION.PAYMENTS_VIEW_ALL, 'payments.view', 'payouts.view', 'credit.payouts.navigate'],
  'credit.status.update': [PERMISSION.CREDITS_UPDATE, 'credits.updateStatus', 'credits.update', 'credit.status.update'],
  'installment.pay': [PERMISSION.PAYMENTS_CREATE, 'payments.create', 'installment.pay'],
  'installment.editPaymentMethod': [PERMISSION.PAYMENTS_UPDATE, 'payments.update', 'installment.editPaymentMethod'],
  'installment.promise': [PERMISSION.CREDITS_UPDATE, 'promises.create', 'installment.promise'],
  'installment.followUp': [PERMISSION.CREDITS_UPDATE, 'followups.create', 'installment.followUp'],
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
    return { visible: false, executable: false, reason: tTerm('operational.guard.reason.creditCancelAdminOnly') };
  }

  if (loanStatus === 'closed' || loanStatus === 'completed') {
    return { visible: true, executable: false, reason: tTerm('operational.guard.reason.creditCancelClosed') };
  }

  if (loanStatus !== 'rejected') {
    return { visible: true, executable: false, reason: tTerm('operational.guard.reason.creditCancelRejectedOnly') };
  }

  return { visible: true, executable: true };
};

const canOperateInstallment = (
  role: OperationalRole | undefined,
  loanStatus: string | undefined,
  installmentStatus: string | undefined,
  actionLabelKey: TermKey,
): GuardResult => {
  if (!isBackofficeRole(role)) {
    return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedManage', { action: tTerm(actionLabelKey) }) };
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
  actionLabelKey: TermKey,
): GuardResult => {
  if (!isBackofficeRole(role)) {
    return { visible: false, executable: false, reason: tTerm('operational.guard.reason.unavailableForUserType') };
  }

  const installmentGuard = canOperateInstallment(role, loanStatus, installmentStatus, actionLabelKey);

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
    return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedRegisterPayments') };
  }

  if (payoutType === 'regular') {
    return {
      visible: false,
      executable: false,
      reason: tTerm('operational.guard.reason.regularPaymentUnavailable'),
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
      reason: tTerm('operational.guard.reason.missingPermission'),
    };
  }

  switch (action) {
    case 'credit.view':
      return { visible: true, executable: true };
    case 'credit.report.download':
    case 'credit.payouts.navigate':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.adminUsersOnly') };
      }
      return { visible: true, executable: true };
    case 'credit.delete':
      return canDeleteCredit(role, loanStatus);
    case 'installment.pay':
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'operational.guard.action.installmentPayments');
    case 'installment.editPaymentMethod':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedEditPaymentMethods') };
      }
      if (paymentReconciled) {
        return {
          visible: true,
          executable: false,
          reason: tTerm('operational.guard.reason.paymentMethodReconciled'),
        };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'operational.guard.action.paymentMethodEdit');
    case 'installment.promise':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.promisesInternal') };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'operational.guard.action.paymentPromises');
    case 'installment.followUp':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.followUpsInternal') };
      }
      return canOperateInstallment(role, loanStatus, installmentStatus, 'operational.guard.action.followUps');
    case 'installment.annul':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedAnnulInstallments') };
      }
      return canProcessLoanPayments(role, loanStatus, installmentStatus, 'operational.guard.action.installmentAnnulment');
    case 'capital.payment':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.capitalPaymentAuthorizedOnly') };
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
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.lateFeeAdminOnly') };
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
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.adminUsersOnly') };
      }
      return { visible: true, executable: true };
    case 'credit.status.update':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedCreditStatusUpdate') };
      }
      if (loanStatus && CLOSED_LOAN_STATUSES.has(loanStatus)) {
        return { visible: true, executable: false, reason: unavailableLoanStatusReason(loanStatus) };
      }
      return { visible: true, executable: true };
    case 'payout.metadata.edit':
      if (!isBackofficeRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.authorizedEditPayments') };
      }
      if (paymentReconciled) {
        return {
          visible: true,
          executable: false,
          reason: tTerm('operational.guard.reason.paymentMethodReconciled'),
        };
      }
      if (paymentStatus === 'annulled') {
        return { visible: true, executable: false, reason: tTerm('operational.guard.reason.annulledPaymentEditUnavailable') };
      }
      return { visible: true, executable: true };
    case 'payout.delete':
      if (!isAdminRole(role)) {
        return { visible: false, executable: false, reason: tTerm('operational.guard.reason.payoutDeleteAdminOnly') };
      }
      return {
        visible: true,
        executable: false,
        reason: tTerm('operational.guard.reason.payoutDirectDeleteUnavailable'),
      };
    default:
      return { visible: false, executable: false, reason: tTerm('operational.guard.reason.unknownAction') };
  }
};
