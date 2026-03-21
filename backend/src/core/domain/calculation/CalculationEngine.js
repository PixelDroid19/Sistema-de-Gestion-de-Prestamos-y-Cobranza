const BigNumberEngine = require('./BigNumberEngine');
const { TopologicalSorter, TopologicalCycleException } = require('./TopologicalSorter');
const { FormulaCompiler } = require('./FormulaCompiler');
const { buildInitialScope, scopeToPlainObject } = require('./scopeBuilder');
const { createDagExecutionResult, createAmortizationBreakdown, createCalculationError } = require('./resultTypes');

const CalculationEngine = {
  execute(graph, contractVars = {}) {
    const { nodes = [], edges = [] } = graph;

    const phase1Validate = () => {
      if (nodes.length === 0) {
        return { valid: true };
      }
      const hasCycle = TopologicalSorter.hasCycle(nodes, edges);
      if (hasCycle) {
        throw new TopologicalCycleException('Cycle detected in graph');
      }
      return { valid: true };
    };

    const phase2Sort = () => {
      if (nodes.length === 0) {
        return [];
      }
      return TopologicalSorter.sort(nodes, edges);
    };

    const phase3Compile = (executionOrder) => {
      const nodesById = new Map(nodes.map(n => [n.id, n]));
      const orderedNodes = executionOrder.map(id => nodesById.get(id)).filter(Boolean);
      return FormulaCompiler.compile(orderedNodes);
    };

    const phase4InstantiateScope = (vars) => {
      return buildInitialScope(vars);
    };

    const phase5Evaluate = (compiledNodes, scope) => {
      const resultScope = { ...scope };
      const engine = BigNumberEngine.getInstance();

      for (const compiledNode of compiledNodes) {
        if (!compiledNode.compiledFormula) {
          if (compiledNode.outputVar && !(compiledNode.outputVar in resultScope)) {
            resultScope[compiledNode.outputVar] = 0;
          }
          continue;
        }

        try {
          const mathInstance = engine._getMathInstance();
          const nodeScope = { ...resultScope };
          const evaluated = compiledNode.compiledFormula.evaluate(nodeScope);
          resultScope[compiledNode.outputVar] = evaluated;
        } catch (error) {
          const err = new Error(`EvaluationError: Failed to evaluate node '${compiledNode.id}': ${error.message}`);
          err.nodeId = compiledNode.id;
          err.errorType = 'EvaluationError';
          throw err;
        }
      }

      return resultScope;
    };

    const phase6Extract = (scope) => {
      return scopeToPlainObject(scope);
    };

    const startTime = Date.now();

    phase1Validate();
    const executionOrder = phase2Sort();
    const compiledNodes = phase3Compile(executionOrder);
    const scope = phase4InstantiateScope(contractVars);
    const evaluatedScope = phase5Evaluate(compiledNodes, scope);
    const result = phase6Extract(evaluatedScope);

    const metrics = {
      executionTimeMs: Date.now() - startTime,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };

    return createDagExecutionResult(result, executionOrder, metrics);
  },

  calculateAmortization({ principal, interestRate, term, paymentAmount }) {
    const scope = buildInitialScope({ principal, interestRate, term, paymentAmount });
    const engine = BigNumberEngine.getInstance();
    const mathInstance = engine._getMathInstance();

    const balance = { ...scope };
    const schedule = [];
    let period = 0;

    const balanceVar = 'balance';
    const principalVar = 'principal_paid';
    const interestVar = 'interest_paid';

    while (period < term && mathInstance.compare(balance[balanceVar] || scope.principal, 0) > 0) {
      const interestPayment = mathInstance.multiply(
        balance[balanceVar] || scope.principal,
        scope.interestRate
      );

      let principalPayment;
      let actualPayment;

      if (paymentAmount) {
        actualPayment = mathInstance.min(paymentAmount, balance[balanceVar] || scope.principal);
        principalPayment = mathInstance.subtract(actualPayment, interestPayment);
      } else {
        principalPayment = mathInstance.divide(scope.principal, scope.term);
        actualPayment = mathInstance.add(principalPayment, interestPayment);
      }

      principalPayment = mathInstance.max(principalPayment, 0);

      balance[balanceVar] = mathInstance.subtract(balance[balanceVar] || scope.principal, principalPayment);
      balance[principalVar] = principalPayment;
      balance[interestVar] = interestPayment;

      schedule.push({
        period: period + 1,
        principal: scopeToPlainObject(principalPayment),
        interest: scopeToPlainObject(interestPayment),
        balance: scopeToPlainObject(balance[balanceVar]),
      });

      period++;
    }

    return createAmortizationBreakdown(
      scopeToPlainObject(scope.principal),
      schedule.reduce((sum, p) => sum + parseFloat(p.interest), 0),
      0,
      0
    );
  },
};

module.exports = { CalculationEngine };