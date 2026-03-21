class FormulaCompilationError extends Error {
  constructor(message, formula = null, nodeId = null) {
    super(message);
    this.name = 'FormulaCompilationError';
    this.formula = formula;
    this.nodeId = nodeId;
  }
}

const FormulaCompiler = {
  compile(graphNodes) {
    if (!Array.isArray(graphNodes)) {
      throw new FormulaCompilationError('graphNodes must be an array');
    }

    const compiled = [];

    for (const node of graphNodes) {
      if (!node.id) {
        throw new FormulaCompilationError('Node missing required field: id', null, node.id);
      }

      const label = node.label || node.id;
      const formula = node.formula;
      const outputVar = node.outputVar || `${node.id}_result`;
      const metadata = node.metadata || {};

      if (!formula) {
        compiled.push({
          id: node.id,
          label,
          compiledFormula: null,
          outputVar,
          metadata,
        });
        continue;
      }

      try {
        const BigNumberEngine = require('./BigNumberEngine');
        const compiledFormula = BigNumberEngine.compileFormula(formula);

        compiled.push({
          id: node.id,
          label,
          compiledFormula,
          outputVar,
          metadata,
        });
      } catch (error) {
        if (error instanceof FormulaCompilationError) {
          throw error;
        }
        throw new FormulaCompilationError(
          `Failed to compile formula: ${error.message}`,
          formula,
          node.id
        );
      }
    }

    return compiled;
  },

  validateFormula(formula) {
    if (typeof formula !== 'string' || formula.trim() === '') {
      return { valid: false, error: 'Formula must be a non-empty string' };
    }

    try {
      const BigNumberEngine = require('./BigNumberEngine');
      BigNumberEngine.compileFormula(formula);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },
};

module.exports = {
  FormulaCompiler,
  FormulaCompilationError,
};