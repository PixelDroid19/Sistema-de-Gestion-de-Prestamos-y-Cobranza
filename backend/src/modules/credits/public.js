const { createCreditsComposition, pickCreditsPublicPorts } = require('./composition');

const createCreditsPublicPorts = ({ composition = createCreditsComposition() } = {}) => pickCreditsPublicPorts(composition);

module.exports = {
  createCreditsPublicPorts,
};
