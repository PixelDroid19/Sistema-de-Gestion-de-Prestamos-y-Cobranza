class TopologicalCycleException extends Error {
  constructor(message, cyclePath = []) {
    super(message);
    this.name = 'TopologicalCycleException';
    this.cyclePath = cyclePath;
  }
}

const buildAdjacencyList = (nodes, edges) => {
  const adjacency = new Map();
  const inDegree = new Map();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const from = edge.from || edge.source;
    const to = edge.to || edge.target;
    if (adjacency.has(from) && adjacency.has(to)) {
      adjacency.get(from).push(to);
      inDegree.set(to, inDegree.get(to) + 1);
    }
  });

  return { adjacency, inDegree };
};

const findCycleDFS = (adjacency, nodes) => {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  const parent = new Map();

  nodes.forEach(node => color.set(node.id, WHITE));

  const dfsVisit = (nodeId, path) => {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStart);
        cyclePath.push(neighbor);
        return cyclePath;
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, nodeId);
        const cycle = dfsVisit(neighbor, path);
        if (cycle) return cycle;
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
    return null;
  };

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const cycle = dfsVisit(node.id, []);
      if (cycle) return cycle;
    }
  }

  return null;
};

const topologicalSortKahn = (nodes, edges) => {
  const { adjacency, inDegree } = buildAdjacencyList(nodes, edges);
  const queue = [];
  const result = [];

  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift();
    result.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== nodes.length) {
    const cycle = findCycleDFS(adjacency, nodes);
    const cyclePathStr = cycle ? cycle.join(' -> ') : 'unknown';
    throw new TopologicalCycleException(
      `Cycle detected in DAG: ${cyclePathStr}`,
      cycle || []
    );
  }

  return result;
};

const topologicalSortDFS = (nodes, edges) => {
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, []));

  edges.forEach(edge => {
    const from = edge.from || edge.source;
    const to = edge.to || edge.target;
    if (adjacency.has(from) && adjacency.has(to)) {
      adjacency.get(from).push(to);
    }
  });

  const visited = new Set();
  const result = [];
  const visiting = new Set();

  const visit = (nodeId) => {
    if (visiting.has(nodeId)) {
      throw new TopologicalCycleException(
        `Cycle detected at node '${nodeId}'`,
        [nodeId]
      );
    }
    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    result.unshift(nodeId);
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  }

  return result;
};

const TopologicalSorter = {
  sort(nodes, edges) {
    if (!nodes || nodes.length === 0) {
      return [];
    }
    return topologicalSortKahn(nodes, edges);
  },

  sortDFS(nodes, edges) {
    if (!nodes || nodes.length === 0) {
      return [];
    }
    return topologicalSortDFS(nodes, edges);
  },

  hasCycle(nodes, edges) {
    try {
      topologicalSortKahn(nodes, edges);
      return false;
    } catch (e) {
      if (e instanceof TopologicalCycleException) {
        return true;
      }
      throw e;
    }
  },
};

module.exports = {
  TopologicalSorter,
  TopologicalCycleException,
};