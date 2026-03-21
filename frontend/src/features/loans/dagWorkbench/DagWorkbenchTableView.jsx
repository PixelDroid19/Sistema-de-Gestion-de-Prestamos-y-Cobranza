import React from 'react';

function DagWorkbenchTableView({ simulationResult, outputsByVariable }) {
  const schedule = simulationResult?.schedule || [];
  const summary = simulationResult?.summary || {};
  const outputEntries = Object.entries(outputsByVariable || {});

  return (
    <div className="loans-dag-workbench__table-view">
      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Simulation summary</div>
        <div className="metric-grid loans-dag-workbench__summary-grid">
          <div className="metric-card metric-card--brand">
            <div className="metric-card__label">Monthly installment</div>
            <div className="metric-card__value">{summary.monthlyInstallment ?? '--'}</div>
          </div>
          <div className="metric-card metric-card--info">
            <div className="metric-card__label">Total payable</div>
            <div className="metric-card__value">{summary.totalPayable ?? '--'}</div>
          </div>
          <div className="metric-card metric-card--success">
            <div className="metric-card__label">Installments</div>
            <div className="metric-card__value">{schedule.length}</div>
          </div>
        </div>
      </section>

      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Output variables</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {outputEntries.length ? outputEntries.map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value ?? '--'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={2}>Run a simulation to inspect node outputs.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="loans-dag-workbench__panel">
        <div className="section-eyebrow">Amortization preview</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Installment</th>
                <th>Payment</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.length ? schedule.map((row, index) => (
                <tr key={`${row.installmentNumber || row.installment || index}`}>
                  <td>{row.installmentNumber || row.installment || index + 1}</td>
                  <td>{row.scheduledPayment ?? row.payment ?? '--'}</td>
                  <td>{row.principalComponent ?? row.principal ?? '--'}</td>
                  <td>{row.interestComponent ?? row.interest ?? '--'}</td>
                  <td>{row.remainingBalance ?? row.balance ?? '--'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5}>No amortization rows yet. Simulate the graph to populate this table.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DagWorkbenchTableView;
