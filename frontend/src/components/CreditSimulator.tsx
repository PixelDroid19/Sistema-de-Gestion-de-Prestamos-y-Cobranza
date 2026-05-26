import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPlus } from 'lucide-react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';
import { tTerm } from '../i18n/terminology';
import { ActionButton, PageHeader, PageShell } from './shared/Surfaces';
import { getLocalDateInputValue } from '../lib/dateInput';

/**
 * Standalone credit calculation route for admins.
 * It reuses the same profile-backed calculation workspace used in Credits.
 */
export default function CreditSimulator() {
  const navigate = useNavigate();
  const {
    input,
    result,
    error,
    fieldErrors,
    isSimulating,
    isResultStale,
    setInput,
    simulate,
  } = useActiveCreditSimulation({
    initialInput: {
      ...DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
      startDate: getLocalDateInputValue(),
    },
    autoRun: true,
  });
  const canContinueToRegistration = Boolean(result) && !isResultStale;

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
          error={error}
          fieldErrors={fieldErrors}
          isSimulating={isSimulating}
          isResultStale={isResultStale}
          onInputChange={setInput}
          onSimulate={simulate}
          resultBadge={result ? tTerm('newCredit.summary.activeRule') : null}
          emptyTitle={tTerm('creditCalculator.empty.title')}
          emptyDescription={tTerm('creditCalculator.empty.description')}
          compactChrome
        />
      </div>
    </PageShell>
  );
}
