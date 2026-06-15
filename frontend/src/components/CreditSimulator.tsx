import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPlus } from 'lucide-react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';
import { tTerm } from '../i18n/terminology';
import { ActionButton, PageHeader, PageShell } from './shared/Surfaces';
import { getLocalDateInputValue } from '../lib/dateInput';
import { useSessionStore } from '../store/sessionStore';
import { useResolvedPermissionNames } from '../services/permissionsService';
import { PERMISSION } from '../constants/permissionNames';

/**
 * Standalone credit calculation route for admins.
 * It reuses the same profile-backed calculation workspace used in Credits.
 */
export default function CreditSimulator() {
  const navigate = useNavigate();
  const { user } = useSessionStore();
  const resolvedPermissions = useResolvedPermissionNames(user);
  // The registration route requires CREDITS_CREATE; keep the CTA aligned so a
  // read-only operator is not sent to a screen ProtectedRoute will block.
  const canRegisterCredits = resolvedPermissions.includes('*')
    || resolvedPermissions.includes(PERMISSION.CREDITS_CREATE);
  const {
    input,
    result,
    error,
    fieldErrors,
    isSimulating,
    isResultStale,
    setInput,
    syncInputWithResult,
    simulate,
  } = useActiveCreditSimulation({
    initialInput: {
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      startDate: getLocalDateInputValue(),
      rateSource: 'policy',
      lateFeeSource: 'policy',
    },
    autoRun: true,
  });
  const canContinueToRegistration = Boolean(result) && !isResultStale && canRegisterCredits;
  const displayError = React.useMemo(() => {
    if (!error) {
      return null;
    }

    if (/no active rate policy|credit amount/i.test(error)) {
      return tTerm('creditCalculator.error.ratePolicyUnavailable');
    }

    return error;
  }, [error]);

  React.useEffect(() => {
    const policySnapshot = (result?.policySnapshot || null) as Record<string, unknown> | null;
    const nextInput: Partial<typeof input> = {};

    if (String(policySnapshot?.rateSource || '').toLowerCase() === 'policy') {
      const appliedRate = Number(result?.inputs?.interestRate);
      if (Number.isFinite(appliedRate) && appliedRate !== input.interestRate) {
        nextInput.interestRate = appliedRate;
      }
      if (input.rateSource !== 'policy') {
        nextInput.rateSource = 'policy';
      }
    }

    if (String(policySnapshot?.lateFeeSource || '').toLowerCase() === 'policy') {
      const appliedLateFeeMode = result?.inputs?.lateFeeMode || result?.lateFeeMode || input.lateFeeMode || 'SIMPLE';
      const appliedLateFeeRate = Number(result?.inputs?.annualLateFeeRate ?? input.annualLateFeeRate ?? 0);

      if (appliedLateFeeMode !== input.lateFeeMode) {
        nextInput.lateFeeMode = appliedLateFeeMode;
      }
      if (Number.isFinite(appliedLateFeeRate) && appliedLateFeeRate !== input.annualLateFeeRate) {
        nextInput.annualLateFeeRate = appliedLateFeeRate;
      }
      if (input.lateFeeSource !== 'policy') {
        nextInput.lateFeeSource = 'policy';
      }
    }

    if (Object.keys(nextInput).length > 0) {
      syncInputWithResult(nextInput);
    }
  }, [
    input.annualLateFeeRate,
    input.interestRate,
    input.lateFeeMode,
    input.lateFeeSource,
    input.rateSource,
    result,
    syncInputWithResult,
  ]);

  const displayInterestRate = React.useMemo(() => {
    const usesPolicyBackedRate = String(input.rateSource || '').toLowerCase() === 'policy';
    const lastCalculatedAmount = Number(result?.inputs?.amount);
    const currentAmount = Number(input.amount);
    const shouldHideRateUntilRecalculated = usesPolicyBackedRate
      && (!result || lastCalculatedAmount !== currentAmount);

    return shouldHideRateUntilRecalculated ? undefined : input.interestRate;
  }, [input.amount, input.interestRate, input.rateSource, result]);

  const navigateToCreditRegistration = React.useCallback(() => {
    if (!canContinueToRegistration) {
      return;
    }

    navigate('/credits/new', {
      state: {
        calculationInput: input,
        source: 'credit-calculator',
      },
    });
  }, [canContinueToRegistration, input, navigate]);

  return (
    <PageShell className="h-full" data-tour="credit-calculator-page">
      <PageHeader
        eyebrow={tTerm('creditCalculator.header.eyebrow')}
        title={tTerm('creditCalculator.header.title')}
        subtitle={tTerm('creditCalculator.header.subtitle')}
        guideKey="credit-calculator"
        tourId="credit-calculator-header"
        actions={(
          <>
            <ActionButton onClick={() => navigate('/credits')}>
              {tTerm('newCredit.header.back')}
            </ActionButton>
            <ActionButton
              disabled={!canContinueToRegistration}
              onClick={navigateToCreditRegistration}
              icon={<ClipboardPlus size={16} />}
              variant="primary"
            >
              {tTerm('creditCalculator.action.useForRegistration')}
            </ActionButton>
          </>
        )}
      />

      <div data-tour="credit-calculator-simulation">
        <CreditSimulationWorkspace
          title={tTerm('creditCalculator.workspace.title')}
          description={tTerm('creditCalculator.workspace.description')}
          modeLabel={tTerm('creditCalculator.workspace.modeLabel')}
          input={input}
          result={result}
          error={displayError}
          fieldErrors={fieldErrors}
          isSimulating={isSimulating}
          isResultStale={isResultStale}
          onInputChange={setInput}
          onSimulate={simulate}
          resultBadge={result ? tTerm('newCredit.summary.activeRule') : null}
          emptyTitle={tTerm('creditCalculator.empty.title')}
          emptyDescription={tTerm('creditCalculator.empty.description')}
          rateControl={{
            readOnly: true,
            helper: tTerm('creditCalculator.rate.helper'),
            displayValue: displayInterestRate,
          }}
          lateFeeControl={{
            readOnly: true,
            helper: tTerm('creditCalculator.lateFee.helper'),
          }}
          compactChrome
        />
      </div>
    </PageShell>
  );
}
