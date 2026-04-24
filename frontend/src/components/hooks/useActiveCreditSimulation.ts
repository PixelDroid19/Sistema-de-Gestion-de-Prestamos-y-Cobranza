import { useCallback, useEffect, useRef, useState } from 'react';
import { dagService } from '../../services/dagService';
import { getSafeErrorText } from '../../services/safeErrorMessages';
import type { CreditCalculationInput, CreditCalculationResult } from '../../types/dag';

export const DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT: CreditCalculationInput = {
  amount: 2000000,
  interestRate: 60,
  termMonths: 12,
  lateFeeMode: 'SIMPLE',
};

export const DEFAULT_ACTIVE_CREDIT_SIMULATION_INPUT = DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT;

export type CreditCalculationFieldErrors = Record<string, string>;
export type SimulationFieldErrors = CreditCalculationFieldErrors;

const validateCalculationInput = (input: CreditCalculationInput): CreditCalculationFieldErrors => {
  const errors: CreditCalculationFieldErrors = {};

  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    errors.amount = 'El monto debe ser un número mayor a 0.';
  }

  if (typeof input.interestRate !== 'number' || !Number.isFinite(input.interestRate) || input.interestRate < 0 || input.interestRate > 100) {
    errors.interestRate = 'La tasa debe estar entre 0% y 100%.';
  }

  if (typeof input.termMonths !== 'number' || !Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 360) {
    errors.termMonths = 'El plazo debe ser un entero entre 1 y 360 meses.';
  }

  return errors;
};

const extractBackendFieldErrors = (error: unknown): SimulationFieldErrors => {
  if (!error || typeof error !== 'object') return {};
  const candidate = error as {
    response?: { data?: { error?: { validationErrors?: Array<{ field?: string; message?: string }> } } };
  };
  const validationErrors = candidate.response?.data?.error?.validationErrors;
  if (!Array.isArray(validationErrors)) return {};

  const fieldErrors: SimulationFieldErrors = {};
  for (const ve of validationErrors) {
    if (ve.field && ve.message) {
      fieldErrors[ve.field] = ve.message;
    }
  }
  return fieldErrors;
};

const areCalculationInputsEqual = (
  left: CreditCalculationInput | null,
  right: CreditCalculationInput | null,
) => {
  if (!left || !right) {
    return false;
  }

  return left.amount === right.amount
    && left.interestRate === right.interestRate
    && left.termMonths === right.termMonths
    && (left.lateFeeMode || 'SIMPLE') === (right.lateFeeMode || 'SIMPLE')
    && (left.startDate || '') === (right.startDate || '');
};

type UseActiveCreditSimulationOptions = {
  initialInput?: CreditCalculationInput;
  autoRun?: boolean;
};

export const useActiveCreditSimulation = ({
  initialInput = DEFAULT_ACTIVE_CREDIT_CALCULATION_INPUT,
  autoRun = false,
}: UseActiveCreditSimulationOptions = {}) => {
  const [input, setInput] = useState<CreditCalculationInput>(initialInput);
  const [result, setResult] = useState<CreditCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SimulationFieldErrors>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastSimulatedInput, setLastSimulatedInput] = useState<CreditCalculationInput | null>(null);
  const hasAutoRunOnceRef = useRef(false);

  const simulate = useCallback(async () => {
    const localFieldErrors = validateCalculationInput(input);
    if (Object.keys(localFieldErrors).length > 0) {
      setFieldErrors(localFieldErrors);
      setError('Corrige los campos marcados antes de calcular.');
      return;
    }

    setFieldErrors({});
    setIsSimulating(true);
    setError(null);

    try {
      const response = await dagService.calculate(input);
      setResult(response.data.calculation || response.data.simulation || null);
      setLastSimulatedInput({ ...input });
    } catch (simulationError) {
      const backendFields = extractBackendFieldErrors(simulationError);
      if (Object.keys(backendFields).length > 0) {
        setFieldErrors(backendFields);
        setError('El servidor rechazó los parámetros. Revisa los campos marcados.');
      } else {
        setError(getSafeErrorText(simulationError, {
          domain: 'credits',
          action: 'credit.simulate',
        }));
      }
    } finally {
      setIsSimulating(false);
    }
  }, [input]);

  useEffect(() => {
    if (!autoRun || hasAutoRunOnceRef.current) {
      return;
    }

    hasAutoRunOnceRef.current = true;
    void simulate();
  }, [autoRun, simulate]);

  const updateInput = useCallback((partialInput: Partial<CreditCalculationInput>) => {
    setInput((currentInput) => ({
      ...currentInput,
      ...partialInput,
    }));
    setError(null);
    setFieldErrors((currentFieldErrors) => {
      const nextFieldErrors = { ...currentFieldErrors };
      for (const key of Object.keys(partialInput)) {
        delete nextFieldErrors[key];
      }
      return nextFieldErrors;
    });
  }, []);

  const isResultStale = result !== null && !areCalculationInputsEqual(input, lastSimulatedInput);

  return {
    input,
    result,
    error,
    fieldErrors,
    isSimulating,
    isResultStale,
    setInput: updateInput,
    simulate,
  };
};

export default useActiveCreditSimulation;
