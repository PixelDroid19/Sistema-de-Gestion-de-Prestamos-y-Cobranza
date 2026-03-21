const { buildAmortizationSchedule, summarizeSchedule } = require('../creditFormulaHelpers');
const { createDagRuntime } = require('./runtime');
const { defineDagNode } = require('./types');
const { assertSupportedLateFeeMode } = require('./lateFeeMode');

const createSimulationGraph = () => createDagRuntime({
  nodes: [
    defineDagNode({
      id: 'lateFeeMode',
      execute: ({ input }) => assertSupportedLateFeeMode(input.lateFeeMode),
    }),
    defineDagNode({
      id: 'schedule',
      execute: ({ input }) => buildAmortizationSchedule(input),
    }),
    defineDagNode({
      id: 'summary',
      dependencies: ['schedule'],
      execute: ({ values }) => summarizeSchedule(values.schedule),
    }),
    defineDagNode({
      id: 'result',
      dependencies: ['lateFeeMode', 'schedule', 'summary'],
      execute: ({ values }) => ({
        lateFeeMode: values.lateFeeMode,
        schedule: values.schedule,
        summary: values.summary,
      }),
    }),
  ],
});

const createSimulationDagExecutor = ({ runtime = createSimulationGraph() } = {}) => (input) => runtime.execute({
  input,
  requestedOutputs: ['result'],
});

module.exports = {
  createSimulationGraph,
  createSimulationDagExecutor,
};
