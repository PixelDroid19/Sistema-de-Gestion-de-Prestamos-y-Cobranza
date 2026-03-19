const { createCreditsComposition, pickCreditsPublicPorts } = require('./composition');

/**
 * Expose the public credit-domain ports shared with other backend modules.
 * @param {{ composition?: object }} [options]
 * @returns {{ loanAccessPolicy: object, loanViewService: object }}
 */
const createCreditsPublicPorts = ({ composition = createCreditsComposition() } = {}) => pickCreditsPublicPorts(composition);

module.exports = {
  createCreditsPublicPorts,
};
