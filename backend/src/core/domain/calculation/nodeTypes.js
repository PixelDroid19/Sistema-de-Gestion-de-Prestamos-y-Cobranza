const NodeKind = {
  FORMULA: 'FORMULA',
  CONDITIONAL: 'CONDITIONAL',
  LOOKUP: 'LOOKUP',
  CONSTANT: 'CONSTANT',
};

const defineDagNode = (id, label, formula, outputVar, metadata = {}) => ({
  id,
  label: label || id,
  formula,
  outputVar: outputVar || `${id}_result`,
  metadata,
  kind: NodeKind.FORMULA,
});

const defineConditionalNode = (id, label, condition, trueVar, falseVar, outputVar, metadata = {}) => ({
  id,
  label: label || id,
  condition,
  trueVar,
  falseVar,
  outputVar: outputVar || `${id}_result`,
  metadata,
  kind: NodeKind.CONDITIONAL,
});

const defineLookupNode = (id, label, tableName, keyField, valueField, outputVar, metadata = {}) => ({
  id,
  label: label || id,
  tableName,
  keyField,
  valueField,
  outputVar: outputVar || `${id}_result`,
  metadata,
  kind: NodeKind.LOOKUP,
});

const defineConstantNode = (id, label, value, outputVar, metadata = {}) => ({
  id,
  label: label || id,
  value,
  outputVar: outputVar || `${id}_result`,
  metadata,
  kind: NodeKind.CONSTANT,
});

const isValidNode = (node) => {
  if (!node || typeof node !== 'object') {
    return false;
  }

  if (!node.id || typeof node.id !== 'string') {
    return false;
  }

  return true;
};

const isFormulaNode = (node) => {
  return isValidNode(node) && node.kind === NodeKind.FORMULA && typeof node.formula === 'string';
};

const isConditionalNode = (node) => {
  return isValidNode(node) && node.kind === NodeKind.CONDITIONAL;
};

const isLookupNode = (node) => {
  return isValidNode(node) && node.kind === NodeKind.LOOKUP;
};

const isConstantNode = (node) => {
  return isValidNode(node) && node.kind === NodeKind.CONSTANT;
};

module.exports = {
  NodeKind,
  defineDagNode,
  defineConditionalNode,
  defineLookupNode,
  defineConstantNode,
  isValidNode,
  isFormulaNode,
  isConditionalNode,
  isLookupNode,
  isConstantNode,
};