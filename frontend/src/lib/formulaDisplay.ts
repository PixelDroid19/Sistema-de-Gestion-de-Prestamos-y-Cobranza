import type { LateFeeMode } from '../types/dag';

export type FormulaValueKind = 'currency' | 'percent' | 'integer' | 'mode' | 'date' | 'number';

export interface FormulaOption {
  key: string;
  label: string;
  description: string;
  valueKind: FormulaValueKind;
}

export const FORMULA_INPUT_OPTIONS: FormulaOption[] = [
  {
    key: 'amount',
    label: 'Monto del credito',
    description: 'Capital solicitado por el cliente.',
    valueKind: 'currency',
  },
  {
    key: 'interestRate',
    label: 'Tasa anual',
    description: 'Porcentaje anual aplicado al credito.',
    valueKind: 'percent',
  },
  {
    key: 'termMonths',
    label: 'Plazo en meses',
    description: 'Cantidad de cuotas del credito.',
    valueKind: 'integer',
  },
  {
    key: 'installmentAmount',
    label: 'Cuota calculada',
    description: 'Cuota que se usara para construir el cronograma.',
    valueKind: 'currency',
  },
  {
    key: 'lateFeeMode',
    label: 'Politica de mora',
    description: 'Forma de calcular cargos por atraso.',
    valueKind: 'mode',
  },
  {
    key: 'startDate',
    label: 'Fecha de inicio',
    description: 'Fecha desde la que se genera el cronograma.',
    valueKind: 'date',
  },
];

export const FORMULA_TARGET_OPTIONS: FormulaOption[] = [
  {
    key: 'lateFeeMode',
    label: 'Politica de mora',
    description: 'Define como se calcularan cargos por atraso.',
    valueKind: 'mode',
  },
  {
    key: 'interestRate',
    label: 'Tasa anual aplicada',
    description: 'Permite ajustar la tasa antes de generar el credito.',
    valueKind: 'percent',
  },
  {
    key: 'termMonths',
    label: 'Plazo aplicado',
    description: 'Permite ajustar la cantidad de cuotas.',
    valueKind: 'integer',
  },
  {
    key: 'installmentAmount',
    label: 'Cuota fija',
    description: 'Permite fijar o ajustar la cuota del cronograma.',
    valueKind: 'currency',
  },
];

export const FORMULA_FLOW_STEPS = [
  {
    key: 'inputs',
    label: 'Datos del credito',
    description: 'Monto, tasa, plazo, fecha y politica inicial que vienen de la solicitud.',
    editableTarget: null,
  },
  {
    key: 'interestRate',
    label: 'Tasa aplicada',
    description: 'Ajusta la tasa anual antes de calcular intereses y cuota.',
    editableTarget: 'interestRate',
  },
  {
    key: 'termMonths',
    label: 'Plazo aplicado',
    description: 'Ajusta la cantidad de cuotas que tendra el credito.',
    editableTarget: 'termMonths',
  },
  {
    key: 'installmentAmount',
    label: 'Cuota de cobro',
    description: 'Permite fijar una cuota o dejar que el sistema la calcule.',
    editableTarget: 'installmentAmount',
  },
  {
    key: 'lateFeeMode',
    label: 'Politica de mora',
    description: 'Define como se cobraran atrasos en las cuotas.',
    editableTarget: 'lateFeeMode',
  },
  {
    key: 'schedule',
    label: 'Cronograma',
    description: 'El sistema genera las cuotas reales con la formula activa.',
    editableTarget: null,
  },
  {
    key: 'result',
    label: 'Resultado guardado',
    description: 'Estos valores se persisten en el credito nuevo con su version de formula.',
    editableTarget: null,
  },
] as const;

export const LATE_FEE_MODE_OPTIONS: Array<{ key: LateFeeMode; label: string }> = [
  { key: 'NONE', label: 'Sin mora' },
  { key: 'SIMPLE', label: 'Mora simple' },
  { key: 'COMPOUND', label: 'Mora compuesta' },
  { key: 'FLAT', label: 'Cargo fijo' },
  { key: 'TIERED', label: 'Por tramos' },
];

const OPTION_BY_KEY = new Map(
  [...FORMULA_INPUT_OPTIONS, ...FORMULA_TARGET_OPTIONS].map((option) => [option.key, option]),
);

const LATE_FEE_MODE_BY_KEY = new Map(LATE_FEE_MODE_OPTIONS.map((option) => [option.key, option.label]));

export const getFormulaVariableLabel = (key: string): string => OPTION_BY_KEY.get(key)?.label || key;

export const getFormulaTargetLabel = (key: string): string => (
  FORMULA_TARGET_OPTIONS.find((option) => option.key === key)?.label || getFormulaVariableLabel(key)
);

export const getFormulaTargetKind = (key: string): FormulaValueKind => (
  FORMULA_TARGET_OPTIONS.find((option) => option.key === key)?.valueKind || 'number'
);

export const normalizeModeValue = (value: string | undefined): string => {
  const clean = String(value || '').trim().replace(/^['"]|['"]$/g, '');
  return clean || 'NONE';
};

export const getFormulaValueLabel = (value: string | undefined, outputVar?: string): string => {
  const raw = String(value ?? '').trim();
  if (outputVar === 'lateFeeMode') {
    const mode = normalizeModeValue(raw);
    return LATE_FEE_MODE_BY_KEY.get(mode as LateFeeMode) || mode;
  }

  return raw || '0';
};

export const getInputKindLabel = (valueKind: FormulaValueKind): string => {
  if (valueKind === 'currency') return 'Moneda';
  if (valueKind === 'percent') return 'Porcentaje';
  if (valueKind === 'integer') return 'Entero';
  if (valueKind === 'mode') return 'Opcion';
  if (valueKind === 'date') return 'Fecha';
  return 'Numero';
};
