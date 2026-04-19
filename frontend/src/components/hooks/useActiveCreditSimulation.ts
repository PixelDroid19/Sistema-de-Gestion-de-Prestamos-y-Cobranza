import { useCallback, useEffect, useRef, useState } from 'react';
import { dagService } from '../../services/dagService';
import { getSafeErrorText } from '../../services/safeErrorMessages';
import type { SimulationInput, SimulationResult } from '../../types/dag';

export const DEFAULT_ACTIVE_CREDIT_SIMULATION_INPUT: SimulationInput = {
  amount: 2000000,
  interestRate: 60,
  termMonths: 12,
  lateFeeMode: 'SIMPLE',
};

export type SimulationFieldErrors = Record<string, string>;

const validateSimulationInput = (input: SimulationInput): SimulationFieldErrors => {
  const errors: SimulationFieldErrors = {};

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

const areSimulationInputsEqual = (
  left: SimulationInput | null,
  right: SimulationInput | null,
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
  initialInput?: SimulationInput;
  autoRun?: boolean;
};

export const useActiveCreditSimulation = ({
  initialInput = DEFAULT_ACTIVE_CREDIT_SIMULATION_INPUT,
  autoRun = false,
}: UseActiveCreditSimulationOptions = {}) => {
  const [input, setInput] = useState<SimulationInput>(initialInput);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SimulationFieldErrors>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastSimulatedInput, setLastSimulatedInput] = useState<SimulationInput | null>(null);
  const hasAutoRunOnceRef = useRef(false);

  const simulate = useCallback(async () => {
    const localFieldErrors = validateSimulationInput(input);
    if (Object.keys(localFieldErrors).length > 0) {
      setFieldErrors(localFieldErrors);
      setError('Corrige los campos marcados antes de simular.');
      return;
    }

    setFieldErrors({});
    setIsSimulating(true);
    setError(null);

    try {
      const response = await dagService.simulate(input);
      setResult(response.data.simulation);
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

  const updateInput = useCallback((partialInput: Partial<SimulationInput>) => {
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

  const isResultStale = result !== null && !areSimulationInputsEqual(input, lastSimulatedInput);

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
