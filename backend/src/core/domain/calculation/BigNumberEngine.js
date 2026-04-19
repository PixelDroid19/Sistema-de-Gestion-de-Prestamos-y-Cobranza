const math = require('mathjs');

// Whitelist of allowed mathjs functions for formula evaluation
// This prevents injection attacks via malicious function calls
const ALLOWED_FUNCTIONS = new Set([
  // Arithmetic
  'add',
  'subtract',
  'multiply',
  'divide',
  'mod',
  'pow',
  // Math
  'abs',
  'ceil',
  'floor',
  'round',
  'sqrt',
  'log',
  'exp',
  'max',
  'min',
  'mean',
  'median',
  // Utilities
  'format',
  'conj',
  're',
  'im',
  'fix',
  'gamma',
  // Custom formula helpers (must be explicitly allowed)
  'calculateLateFee',
  'buildAmortizationSchedule',
  'summarizeSchedule',
  'roundCurrency',
  'assertSupportedLateFeeMode',
  'buildSimulationResult',
]);

// Blocked patterns that could bypass the whitelist
const BLOCKED_PATTERNS = [
  /import\s*\(/i,
  /createUnit\s*\(/i,
  /evaluate\s*\(/i,
  /parse\s*\(/i,
  /simplify\s*\(/i,
  /derivative\s*\(/i,
  /chain\s*\(/i,
  /typed\s*\(/i,
  /config\s*\(/i,
  /importFrom\s*\(/i,
];

// Error class for validation failures
class FormulaValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormulaValidationError';
  }
}

/**
 * Extract all function names from a formula string by parsing the AST
 */
const extractFunctions = (formulaString) => {
  const functions = [];
  // Match function calls: functionName(
  const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let match;
  while ((match = functionPattern.exec(formulaString)) !== null) {
    functions.push(match[1]);
  }
  return functions;
};

/**
 * Validate formula string against the whitelist
 * @param {string} formulaString - The formula to validate
 * @throws {FormulaValidationError} - If formula contains disallowed functions
 */
const validateFormula = (formulaString) => {
  // First check for blocked patterns that could bypass security
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(formulaString)) {
      throw new FormulaValidationError(`Blocked pattern detected in formula: potentially unsafe operation`);
    }
  }

  // Extract and validate all function names against whitelist
  const functions = extractFunctions(formulaString);
  const disallowedFunctions = functions.filter(fn => !ALLOWED_FUNCTIONS.has(fn));

  if (disallowedFunctions.length > 0) {
    throw new FormulaValidationError(
      `Formula contains disallowed functions: ${disallowedFunctions.join(', ')}. ` +
      `Allowed functions are: ${[...ALLOWED_FUNCTIONS].join(', ')}`
    );
  }
};

const createEngine = () => {
  const mathInstance = math.create(math.all);
  mathInstance.config({
    number: 'BigNumber',
    precision: 64,
  });

  const originalCompile = mathInstance.compile.bind(mathInstance);

  mathInstance.compile = function (formulaString) {
    // Validate formula against whitelist BEFORE compilation
    validateFormula(formulaString);
    return originalCompile(formulaString);
  };

  return {
    createScope(initialVars = {}) {
      const scope = {};
      for (const [key, value] of Object.entries(initialVars)) {
        if (typeof value === 'number') {
          scope[key] = mathInstance.bignumber(value);
        } else if (typeof value === 'string') {
          scope[key] = mathInstance.bignumber(value);
        } else {
          scope[key] = value;
        }
      }
      return scope;
    },

    compileFormula(formulaString) {
      // Validate formula against whitelist before compilation
      validateFormula(formulaString);
      return mathInstance.compile(formulaString);
    },

    evaluateCompiled(compiled, scope) {
      return compiled.evaluate(scope);
    },

    _getMathInstance() {
      return mathInstance;
    },

    // Expose validation for external use (e.g., testing)
    _validateFormula: validateFormula,
    _ALLOWED_FUNCTIONS: ALLOWED_FUNCTIONS,
  };
};

let engineInstance = null;

const BigNumberEngine = {
  getInstance() {
    if (!engineInstance) {
      engineInstance = createEngine();
    }
    return engineInstance;
  },

  createScope(initialVars) {
    return this.getInstance().createScope(initialVars);
  },

  compileFormula(formulaString) {
    return this.getInstance().compileFormula(formulaString);
  },

  evaluateCompiled(compiled, scope) {
    return this.getInstance().evaluateCompiled(compiled, scope);
  },

  // Expose for testing
  validateFormula(formulaString) {
    return this.getInstance()._validateFormula(formulaString);
  },
};

module.exports = BigNumberEngine;
