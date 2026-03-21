const math = require('mathjs');

const createEngine = () => {
  const mathInstance = math.create(math.all);
  mathInstance.config({
    number: 'BigNumber',
    precision: 64,
  });

  const blockedPatterns = [
    /import\s*\(/,
    /createUnit\s*\(/,
    /evaluate\s*\(/,
    /parse\s*\(/,
    /simplify\s*\(/,
    /derivative\s*\(/,
  ];

  const originalCompile = mathInstance.compile.bind(mathInstance);

  mathInstance.compile = function (formulaString) {
    const formulaLower = formulaString.toLowerCase();
    for (const pattern of blockedPatterns) {
      if (pattern.test(formulaString)) {
        throw new Error(`Unsafe pattern detected in formula`);
      }
    }
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
      return mathInstance.compile(formulaString);
    },

    evaluateCompiled(compiled, scope) {
      return compiled.evaluate(scope);
    },

    _getMathInstance() {
      return mathInstance;
    },
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
};

module.exports = BigNumberEngine;
