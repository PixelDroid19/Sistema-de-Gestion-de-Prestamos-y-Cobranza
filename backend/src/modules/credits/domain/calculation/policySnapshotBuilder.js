const buildPolicySnapshot = ({ policySnapshot, profile, input, method, lateFeeMode }) => ({
  ...(policySnapshot || {}),
  calculationProfileVersionId: profile?.id ?? null,
  calculationProfileVersion: profile?.version ?? null,
  calculationProfileName: profile?.name ?? null,
  calculationProfileScopeKey: profile?.scopeKey ?? null,
  calculationMethod: method,
  appliedInterestRate: Number(input.interestRate || 0),
  appliedLateFeeMode: lateFeeMode,
  appliedAnnualLateFeeRate: input.annualLateFeeRate ?? input.lateFeeRate ?? 0,
});

module.exports = {
  buildPolicySnapshot,
};
