const { ValidationError } = require('@/utils/errorHandler');
const { assertSupportedCalculationMethod } = require('./calculationMethods');
const { assertSupportedLateFeeMode } = require('./lateFeeCalculator');

const DEFAULT_CALCULATION_SCOPE_KEY = 'credit-calculation';

const DEFAULT_PROFILE_PARAMETERS = Object.freeze({
  roundingMode: 'HALF_UP_2_DECIMALS',
  defaultLateFeeMode: 'NONE',
  defaultAnnualLateFeeRate: 0,
  allowCustomInstallmentAmount: false,
});

const DEFAULT_CALCULATION_PROFILE = Object.freeze({
  scopeKey: DEFAULT_CALCULATION_SCOPE_KEY,
  name: 'Perfil base de calculo de credito',
  version: 1,
  status: 'active',
  calculationMethod: 'FRENCH',
  parameters: DEFAULT_PROFILE_PARAMETERS,
  rules: {
    rateSource: 'policy_or_manual',
    lateFeeSource: 'policy_or_manual',
  },
  formulaSet: {
    amortization: 'FRENCH|SIMPLE|COMPOUND',
    lateFee: 'NONE|SIMPLE|COMPOUND|FLAT|TIERED',
  },
  changelog: 'Version base creada para reemplazar el runtime de grafos editable.',
});

const toPlainProfile = (profile) => (typeof profile?.toJSON === 'function' ? profile.toJSON() : profile);

const normalizeProfile = (profile) => {
  const plainProfile = toPlainProfile(profile);
  if (!plainProfile) {
    return null;
  }

  const calculationMethod = assertSupportedCalculationMethod(plainProfile.calculationMethod || 'FRENCH');
  const parameters = {
    ...DEFAULT_PROFILE_PARAMETERS,
    ...(plainProfile.parameters || {}),
  };
  parameters.defaultLateFeeMode = assertSupportedLateFeeMode(parameters.defaultLateFeeMode || 'NONE');

  return {
    ...plainProfile,
    calculationMethod,
    parameters,
    rules: plainProfile.rules || {},
    formulaSet: plainProfile.formulaSet || DEFAULT_CALCULATION_PROFILE.formulaSet,
  };
};

const assertActiveProfile = (profile, scopeKey = DEFAULT_CALCULATION_SCOPE_KEY) => {
  const normalizedProfile = normalizeProfile(profile);
  if (!normalizedProfile) {
    const error = new ValidationError(`No active calculation profile is configured for scope '${scopeKey}'`);
    error.code = 'CALCULATION_PROFILE_NOT_ACTIVE';
    error.recovery = 'Seed or activate a CalculationProfileVersion before running credit calculations.';
    throw error;
  }

  if (String(normalizedProfile.status || '').toLowerCase() !== 'active') {
    throw new ValidationError(`Calculation profile ${normalizedProfile.id || normalizedProfile.version} is not active`);
  }

  return normalizedProfile;
};

module.exports = {
  DEFAULT_CALCULATION_SCOPE_KEY,
  DEFAULT_CALCULATION_PROFILE,
  DEFAULT_PROFILE_PARAMETERS,
  normalizeProfile,
  assertActiveProfile,
};
