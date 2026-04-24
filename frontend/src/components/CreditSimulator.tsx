import React from 'react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';

/**
 * Standalone credit calculation route for admins.
 * It reuses the same formula-backed calculation workspace used in Credits.
 */
export default function CreditSimulator() {
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
    initialInput: DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
    autoRun: true,
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h2 className="text-2xl font-semibold">Calculadora de Crédito</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Usa la misma fórmula activa que originación. No mantiene reglas separadas.
        </p>
      </div>

      <CreditSimulationWorkspace
        title="Cálculo unificado de crédito"
        description="Vista previa operativa con la fórmula activa del sistema de créditos reales."
        modeLabel="Ruta dedicada"
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
        resultBadge={result?.graphVersionId != null ? `Fórmula v${result.graphVersionId}` : null}
        emptyTitle="Configura tu escenario"
        emptyDescription="Ajusta el crédito que quieres proyectar y ejecuta el cálculo para revisar cuota, interés total y cronograma mensual."
      />
    </div>
  );
}
