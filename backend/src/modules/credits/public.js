const { createCreditsComposition, pickCreditsPublicPorts } = require('./composition');

/**
 * Expose the public credit-domain ports shared with other backend modules.
 * @param {{ composition?: object }} [options]
 * @returns {{ loanAccessPolicy: object, loanViewService: object, paymentApplicationService: object, attachmentStorage: object, creditsDagConfig: object, dagWorkbenchService: object, alertRepository: object, promiseRepository: object }}
 */
const createCreditsPublicPorts = ({ sharedRuntime, composition } = {}) => {
  const runtimePorts = sharedRuntime?.getModulePorts?.('credits');

  if (runtimePorts) {
    return runtimePorts;
  }

  return pickCreditsPublicPorts(composition || createCreditsComposition({ sharedRuntime }));
};

module.exports = {
  createCreditsPublicPorts,
};
