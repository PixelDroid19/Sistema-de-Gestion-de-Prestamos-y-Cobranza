const createDagExecutionResult = ({ ok = true, mode = 'off', nodeOrder = [], outputs = {}, error = null, metadata = {} } = {}) => ({
  ok,
  mode,
  nodeOrder,
  outputs,
  error,
  metadata,
});

const defineDagNode = ({ id, dependencies = [], execute }) => ({
  id,
  dependencies,
  execute,
});

module.exports = {
  createDagExecutionResult,
  defineDagNode,
};
