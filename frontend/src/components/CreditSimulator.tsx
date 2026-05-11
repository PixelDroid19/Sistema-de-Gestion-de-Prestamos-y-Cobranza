import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardPlus } from 'lucide-react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';
import { ActionButton, PageHeader, PageShell, SectionSurface } from './shared/Surfaces';

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
      startDate: new Date().toISOString().slice(0, 10),
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
        title="Previsualizar crédito"
        subtitle="Simula un crédito con la regla de cálculo activa. Si el escenario sirve, continúa al registro sin rearmar los parámetros."
        guideKey="credit-calculator"
        tourId="credit-calculator-header"
        actions={(
          <>
            <ActionButton onClick={() => navigate('/credits')}>
            Volver a créditos
            </ActionButton>
            <ActionButton
              disabled={!canContinueToRegistration}
              onClick={navigateToCreditRegistration}
              icon={<ClipboardPlus size={16} />}
              variant="primary"
            >
            Usar este cálculo para registrar
            </ActionButton>
          </>
        )}
      />

      <div data-tour="credit-calculator-simulation">
        <CreditSimulationWorkspace
        title="Escenario previo del crédito"
        description="Revisa cuota, total a pagar, método aplicado y cronograma antes de registrar un crédito real."
        modeLabel="Regla activa"
        input={input}
        result={result}
        error={error}
        fieldErrors={fieldErrors}
        isSimulating={isSimulating}
        isResultStale={isResultStale}
        onInputChange={setInput}
        onSimulate={simulate}
        showScenarioTools
        helperText="Si cambias parámetros después de calcular, la interfaz marca el resultado como desactualizado hasta que vuelvas a ejecutar el cálculo."
        resultBadge={result?.calculationProfileVersionId != null ? `Regla v${result.calculationProfileVersionId}` : null}
        emptyTitle="Configura tu escenario"
        emptyDescription="Ajusta el crédito que quieres proyectar y ejecuta el cálculo para revisar cuota, interés total y cronograma mensual."
        />
      </div>

      {result && (
        <SectionSurface>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Listo para originación</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Este escenario usa la misma regla de cálculo activa que se aplicará al crear el crédito real.
              </p>
            </div>
            <ActionButton
              disabled={!canContinueToRegistration}
              onClick={navigateToCreditRegistration}
              icon={<ArrowRight size={16} />}
            >
              Continuar a registro
            </ActionButton>
          </div>
        </SectionSurface>
      )}
    </PageShell>
  );
}
