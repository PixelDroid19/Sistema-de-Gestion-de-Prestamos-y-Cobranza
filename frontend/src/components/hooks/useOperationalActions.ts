import type { QueryClient } from '@tanstack/react-query';
import { toast } from '../../lib/toast';
import type { GuardedAction } from '../../services/operationalGuards';
import { resolveOperationalGuard } from '../../services/operationalGuards';
import { getSafeOperationalGuardMessage, getSafeOperationalMessage } from '../../services/operationalErrorMessages';
import { tTerm } from '../../i18n/terminology';
import { confirmDanger } from '../../lib/confirmModal';

type ActionContext = {
  role?: string;
  permissions?: string[];
  loanStatus?: string;
  installmentStatus?: string;
  paymentStatus?: string;
  paymentReconciled?: boolean;
  payoutType?: 'regular' | 'partial' | 'capital';
};

type ActionOptions = {
  action: GuardedAction;
  context: ActionContext;
  confirmationMessage?: string;
  run: () => Promise<void>;
  onSuccess?: () => Promise<void> | void;
  successMessage?: string;
};

const SAFE_MESSAGING_ACTIONS = new Set<GuardedAction>([
  'installment.pay',
  'installment.editPaymentMethod',
  'installment.promise',
  'installment.followUp',
  'installment.annul',
  'capital.payment',
  'lateFee.update',
  'payout.register',
  'payout.voucher.download',
  'payout.credit.view',
  'payout.metadata.edit',
  'payout.delete',
  'credit.report.download',
]);

const shouldUseSafeMessaging = (action: GuardedAction): boolean => SAFE_MESSAGING_ACTIONS.has(action);

export const useOperationalActions = (_queryClient: QueryClient) => {
  const executeGuardedAction = async (options: ActionOptions): Promise<boolean> => {
    const guard = resolveOperationalGuard(options.action, {
      role: options.context.role,
      permissions: options.context.permissions,
      loanStatus: options.context.loanStatus,
      installmentStatus: options.context.installmentStatus,
      paymentStatus: options.context.paymentStatus,
      paymentReconciled: options.context.paymentReconciled,
      payoutType: options.context.payoutType,
    });

    if (!guard.visible || !guard.executable) {
      if (shouldUseSafeMessaging(options.action)) {
        const guardMessage = getSafeOperationalGuardMessage(options.action);
        toast.error(guardMessage);
      } else {
        toast.error({ title: guard.reason || 'Acción no disponible para este estado.' });
      }
      return false;
    }

    if (options.confirmationMessage) {
      const confirmed = await confirmDanger({
        title: tTerm('confirm.installment.title'),
        message: options.confirmationMessage,
        confirmLabel: tTerm('confirm.installment.confirm'),
      });
      if (!confirmed) return false;
    }

    try {
      await options.run();

      if (options.onSuccess) {
        await options.onSuccess();
      }

      if (options.successMessage) {
        toast.success({ title: options.successMessage });
      }

      return true;
    } catch (error: any) {
      if (shouldUseSafeMessaging(options.action)) {
        const safeMessage = getSafeOperationalMessage(options.action, error);
        toast.error(safeMessage);
        console.error(`[operational] ${options.action} failed`, error);
      } else {
        console.error(`[operational] ${options.action} failed`, error);
        toast.error({
          title: 'No se pudo completar la acción',
          description: 'Intenta nuevamente en unos minutos.',
        });
      }
      return false;
    }
  };

  return {
    executeGuardedAction,
  };
};
