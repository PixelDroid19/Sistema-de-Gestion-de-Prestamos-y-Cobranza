import React from 'react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_SIMULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';

/**
 * Standalone simulator route for admins.
 * It now reuses the shared simulation workspace used in Credits and the formula editor.
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
    initialInput: DEFAULT_ACTIVE_CREDIT_SIMULATION_INPUT,
    autoRun: true,
  });

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h2 className="text-2xl font-semibold">Simulador de Crédito</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Mismo motor, misma interfaz y mismas reglas operativas que la simulación usada en cartera y en el editor de fórmulas.
        </p>
      </div>

      <CreditSimulationWorkspace
        title="Simulador unificado de crédito"
        description="Esta vista conserva la ruta independiente para el equipo, pero usa exactamente el mismo módulo compartido que la simulación de cartera y la del editor de fórmulas."
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
        helperText="Si cambias parámetros después de calcular, la interfaz marca el resultado como desactualizado hasta que vuelvas a ejecutar la simulación."
        resultBadge={result?.graphVersionId != null ? `Fórmula v${result.graphVersionId}` : null}
        emptyTitle="Configura tu escenario"
        emptyDescription="Ajusta el crédito que quieres proyectar y ejecuta la simulación para revisar cuota, interés total y cronograma mensual."
      />
    </div>
  );
}
