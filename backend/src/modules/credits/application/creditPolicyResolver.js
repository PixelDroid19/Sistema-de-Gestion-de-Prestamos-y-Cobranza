const {
  createResolveRatePolicy,
  createResolveLateFeePolicy,
} = require('@/modules/config/application/useCases');

const MANUAL_SOURCE = 'manual';
const POLICY_SOURCE = 'policy';
const NONE_SOURCE = 'none';

const isBlank = (value) => value === undefined || value === null || value === '';

const toNumberOrNull = (value) => {
  if (isBlank(value)) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeSource = (value) => String(value || '').trim().toLowerCase();

const shouldApplyPolicy = ({ source, policy, explicitValue }) => {
  if (!policy) {
    return false;
  }

  if (normalizeSource(source) === MANUAL_SOURCE) {
    return false;
  }

  return normalizeSource(source) === POLICY_SOURCE || isBlank(explicitValue);
};

const buildRatePolicySnapshot = ({ policy, source, appliedInterestRate }) => ({
  ratePolicyId: policy?.id ?? null,
  ratePolicyKey: policy?.key ?? null,
  ratePolicyLabel: policy?.label ?? null,
  ratePolicyRate: policy?.annualEffectiveRate ?? null,
  rateSource: policy ? source : NONE_SOURCE,
  appliedInterestRate,
});

const buildLateFeePolicySnapshot = ({ policy, source, appliedLateFeeMode, appliedAnnualLateFeeRate }) => ({
  lateFeePolicyId: policy?.id ?? null,
  lateFeePolicyKey: policy?.key ?? null,
  lateFeePolicyLabel: policy?.label ?? null,
  lateFeePolicyMode: policy?.lateFeeMode ?? null,
  lateFeePolicyRate: policy?.annualEffectiveRate ?? null,
  lateFeeSource: policy ? source : NONE_SOURCE,
  appliedLateFeeMode,
  appliedAnnualLateFeeRate,
});

/**
 * Create the production policy resolver used before DAG credit calculations.
 * It keeps configuration as the backend source of truth when the caller marks
 * a field as policy-driven, while still allowing explicit manual operator
 * overrides that are traced in the loan snapshot.
 *
 * @param {{ configRepository?: object }} [dependencies]
 * @returns {{ resolve(input: { input?: object }): Promise<{ calculationInput: object, policySnapshot: object }> }}
 */
const createCreditPolicyResolver = ({ configRepository } = {}) => {
  if (!configRepository) {
    return {
      async resolve({ input = {} } = {}) {
        return {
          calculationInput: { ...input },
          policySnapshot: {
            ...buildRatePolicySnapshot({
              policy: null,
              source: NONE_SOURCE,
              appliedInterestRate: toNumberOrNull(input.interestRate),
            }),
            ...buildLateFeePolicySnapshot({
              policy: null,
              source: NONE_SOURCE,
              appliedLateFeeMode: input.lateFeeMode ?? null,
              appliedAnnualLateFeeRate: toNumberOrNull(input.annualLateFeeRate ?? input.lateFeeRate),
            }),
          },
        };
      },
    };
  }

  const resolveRatePolicy = createResolveRatePolicy({ configRepository });
  const resolveLateFeePolicy = createResolveLateFeePolicy({ configRepository });

  return {
    async resolve({ input = {} } = {}) {
      const [ratePolicy, lateFeePolicy] = await Promise.all([
        resolveRatePolicy({ amount: input.amount }),
        resolveLateFeePolicy(),
      ]);

      const applyRatePolicy = shouldApplyPolicy({
        source: input.rateSource,
        policy: ratePolicy,
        explicitValue: input.interestRate,
      });
      const applyLateFeePolicy = shouldApplyPolicy({
        source: input.lateFeeSource,
        policy: lateFeePolicy,
        explicitValue: input.lateFeeMode,
      });
      const applyLateFeeRatePolicy = shouldApplyPolicy({
        source: input.lateFeeSource,
        policy: lateFeePolicy,
        explicitValue: input.annualLateFeeRate ?? input.lateFeeRate,
      });

      const appliedInterestRate = applyRatePolicy
        ? Number(ratePolicy.annualEffectiveRate)
        : toNumberOrNull(input.interestRate);
      const appliedLateFeeMode = applyLateFeePolicy
        ? lateFeePolicy.lateFeeMode
        : input.lateFeeMode;
      const appliedAnnualLateFeeRate = applyLateFeeRatePolicy
        ? Number(lateFeePolicy.annualEffectiveRate || 0)
        : toNumberOrNull(input.annualLateFeeRate ?? input.lateFeeRate);

      const calculationInput = {
        ...input,
        interestRate: appliedInterestRate,
        lateFeeMode: appliedLateFeeMode,
        annualLateFeeRate: appliedAnnualLateFeeRate ?? undefined,
      };

      return {
        calculationInput,
        policySnapshot: {
          ...buildRatePolicySnapshot({
            policy: ratePolicy,
            source: applyRatePolicy ? POLICY_SOURCE : MANUAL_SOURCE,
            appliedInterestRate,
          }),
          ...buildLateFeePolicySnapshot({
            policy: lateFeePolicy,
            source: (applyLateFeePolicy || applyLateFeeRatePolicy) ? POLICY_SOURCE : MANUAL_SOURCE,
            appliedLateFeeMode,
            appliedAnnualLateFeeRate,
          }),
        },
      };
    },
  };
};

module.exports = {
  createCreditPolicyResolver,
};
