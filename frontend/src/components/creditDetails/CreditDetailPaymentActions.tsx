import { CreditCard, DollarSign, Layers } from 'lucide-react';
import { tTerm } from '../../i18n/terminology';
import {
  FloatingActionDock,
  floatingActionDockButtonClass,
} from '../shared/FloatingActionDock';
import { ActionButton } from '../shared/Surfaces';

type CreditActionGuard = {
  visible: boolean;
  executable: boolean;
  reason?: string;
};

type CreditDetailPaymentActionsProps = {
  registerPaymentLabel: string;
  capitalContributionLabel: string;
  canAccessBackofficeActions: boolean;
  installmentPaymentGuard: CreditActionGuard;
  capitalPaymentGuard: CreditActionGuard;
  payoffPaymentGuard: CreditActionGuard;
  onRegisterPayment: () => void;
  onOpenCapitalPayment: () => void;
  onPayoff: () => void;
};

export function CreditDetailPaymentActions({
  registerPaymentLabel,
  capitalContributionLabel,
  canAccessBackofficeActions,
  installmentPaymentGuard,
  capitalPaymentGuard,
  payoffPaymentGuard,
  onRegisterPayment,
  onOpenCapitalPayment,
  onPayoff,
}: CreditDetailPaymentActionsProps) {
  const showRegister = installmentPaymentGuard.visible;
  const showCapital = canAccessBackofficeActions && capitalPaymentGuard.visible;
  const showPayoff = payoffPaymentGuard.visible;
  const visibleActions = [showRegister, showCapital, showPayoff].filter(Boolean);
  const visibleCount = visibleActions.length;

  if (visibleCount === 0) {
    return null;
  }

  const dockItemCount = visibleCount as 1 | 2 | 3;

  return (
    <div aria-label={tTerm('creditDetails.aria.floatingActions')}>
      <FloatingActionDock
        layout="actions"
        itemCount={dockItemCount}
        ariaLabel={tTerm('creditDetails.header.paymentActions')}
        data-tour="credit-detail-secondary-actions"
      >
        {showRegister ? (
          <ActionButton
            onClick={onRegisterPayment}
            disabled={!installmentPaymentGuard.executable}
            title={installmentPaymentGuard.executable ? undefined : installmentPaymentGuard.reason}
            icon={<DollarSign size={16} />}
            variant="primary"
            fullWidth
            className={floatingActionDockButtonClass}
          >
            {registerPaymentLabel}
          </ActionButton>
        ) : null}
        {showCapital ? (
          <ActionButton
            onClick={onOpenCapitalPayment}
            disabled={!capitalPaymentGuard.executable}
            disabledReason={!capitalPaymentGuard.executable && capitalPaymentGuard.reason
              ? tTerm('creditDetails.header.capitalDisabled', { reason: capitalPaymentGuard.reason })
              : undefined}
            title={tTerm('creditDetails.header.capitalTitle')}
            icon={<Layers size={16} />}
            variant="secondary"
            fullWidth
            className={floatingActionDockButtonClass}
          >
            {capitalContributionLabel}
          </ActionButton>
        ) : null}
        {showPayoff ? (
          <ActionButton
            onClick={onPayoff}
            disabled={!payoffPaymentGuard.executable}
            disabledReason={!payoffPaymentGuard.executable && payoffPaymentGuard.reason
              ? tTerm('creditDetails.header.payoffDisabled', { reason: payoffPaymentGuard.reason })
              : undefined}
            title={tTerm('creditDetails.header.payoffTitle')}
            icon={<CreditCard size={16} />}
            variant="secondary"
            fullWidth
            className={floatingActionDockButtonClass}
          >
            {tTerm('creditDetails.header.payoff')}
          </ActionButton>
        ) : null}
      </FloatingActionDock>
    </div>
  );
}
