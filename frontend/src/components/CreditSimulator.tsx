import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardPlus } from 'lucide-react';
import CreditSimulationWorkspace from './shared/CreditSimulationWorkspace';
import { DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT, useActiveCreditSimulation } from './hooks/useActiveCreditSimulation';

/**
 * Standalone credit calculation route for admins.
 * It reuses the same formula-backed calculation workspace used in Credits.
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

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Previsualizar crédito</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Simula un crédito con la fórmula activa. Si el escenario sirve, continúa al registro sin rearmar los parámetros.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/credits"
            className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary transition hover:bg-hover-bg"
          >
            Volver a créditos
          </Link>
          <button
            type="button"
            disabled={!result}
            onClick={() => navigate('/credits/new', {
              state: {
                simulationInput: input,
                source: 'credit-calculator',
              },
            })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            <ClipboardPlus size={16} />
            Usar este cálculo para registrar
          </button>
        </div>
      </div>

      <CreditSimulationWorkspace
        title="Escenario previo del crédito"
        description="Revisa cuota, total a pagar, método aplicado y cronograma antes de registrar un crédito real."
        modeLabel="Fórmula activa"
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

      {result && (
        <section className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Listo para originación</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Este escenario usa la misma fórmula activa que se aplicará al crear el crédito real.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/credits/new', {
                state: {
                  simulationInput: input,
                  source: 'credit-calculator',
                },
              })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-primary bg-brand-primary/5 px-4 py-3 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10"
            >
              Continuar a registro
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
