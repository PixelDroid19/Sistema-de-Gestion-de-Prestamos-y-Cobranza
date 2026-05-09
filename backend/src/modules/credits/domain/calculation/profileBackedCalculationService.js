const { DEFAULT_CALCULATION_SCOPE_KEY, assertActiveProfile } = require('./calculationProfiles');
const { calculateCredit } = require('./creditCalculationEngine');

const createProfileBackedCalculationService = ({
  calculationProfileRepository,
  scopeKey = DEFAULT_CALCULATION_SCOPE_KEY,
} = {}) => {
  if (!calculationProfileRepository || typeof calculationProfileRepository.getLatestActive !== 'function') {
    throw new Error('profileBackedCalculationService requires calculationProfileRepository.getLatestActive');
  }

  return {
    async calculate(input, { policySnapshot = null, profileVersionId = null } = {}) {
      const profile = profileVersionId
        ? await calculationProfileRepository.findById(profileVersionId)
        : await calculationProfileRepository.getLatestActive(scopeKey);
      const activeProfile = assertActiveProfile(profile, scopeKey);
      const calculation = calculateCredit({
        input,
        profileVersion: activeProfile,
        policySnapshot,
      });

      return {
        result: calculation,
        calculationProfileVersionId: activeProfile.id,
        calculationVersionId: activeProfile.id,
        profileVersion: activeProfile,
      };
    },
  };
};

module.exports = {
  createProfileBackedCalculationService,
};
