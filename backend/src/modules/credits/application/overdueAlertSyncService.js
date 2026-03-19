const createOverdueAlertSyncService = ({ loanRepository, alertRepository, loanViewService }) => ({
  async syncAllOverdueAlerts() {
    const loans = await loanRepository.listForOverdueAlertSync();
    const results = [];

    for (const loan of loans) {
      const { schedule } = loanViewService.getCanonicalLoanView(loan);
      const alerts = await alertRepository.syncOverdueInstallmentAlerts({ loan, schedule });
      results.push({ loanId: loan.id, alertCount: alerts.length });
    }

    return {
      processedLoans: results.length,
      results,
    };
  },
});

module.exports = {
  createOverdueAlertSyncService,
};
