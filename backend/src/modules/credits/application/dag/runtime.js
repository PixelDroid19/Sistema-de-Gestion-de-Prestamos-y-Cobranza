const { createDagExecutionResult } = require('./types');

const normalizeNodes = (nodes = []) => {
  const byId = new Map();
  nodes.forEach((node) => {
    byId.set(node.id, {
      dependencies: Array.isArray(node.dependencies) ? node.dependencies : [],
      execute: node.execute,
    });
  });
  return byId;
};

const resolveExecutionOrder = ({ nodesById, requestedOutputs }) => {
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  const visit = (nodeId) => {
    if (visited.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
      throw new Error(`Circular DAG dependency detected at node '${nodeId}'`);
    }

    const node = nodesById.get(nodeId);
    if (!node) {
      throw new Error(`Unknown DAG node '${nodeId}'`);
    }

    visiting.add(nodeId);
    node.dependencies.forEach(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  };

  const targets = requestedOutputs?.length ? requestedOutputs : [...nodesById.keys()];
  targets.forEach(visit);
  return order;
};

const createDagRuntime = ({ nodes = [] } = {}) => {
  const nodesById = normalizeNodes(nodes);

  return {
    execute({ input = {}, requestedOutputs } = {}) {
      const nodeOrder = resolveExecutionOrder({ nodesById, requestedOutputs });
      const values = {};

      for (const nodeId of nodeOrder) {
        const node = nodesById.get(nodeId);
        values[nodeId] = node.execute({
          input,
          values,
          nodeId,
        });
      }

      const outputs = (requestedOutputs?.length ? requestedOutputs : nodeOrder)
        .reduce((result, nodeId) => {
          result[nodeId] = values[nodeId];
          return result;
        }, {});

      return createDagExecutionResult({
        ok: true,
        nodeOrder,
        outputs,
      });
    },
  };
};

module.exports = {
  createDagRuntime,
  resolveExecutionOrder,
};
