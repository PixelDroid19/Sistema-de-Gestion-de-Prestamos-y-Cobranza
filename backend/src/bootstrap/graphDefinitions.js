const createStandardAmortizationGraph = () => {
  const nodes = [
    { id: 'node_principal', formula: 'principal', outputVar: 'principal' },
    { id: 'node_rate', formula: 'rate / 100', outputVar: 'rate_decimal' },
    { id: 'node_payment', formula: 'paymentAmount', outputVar: 'paymentAmount' },
    { id: 'node_period_rate', formula: 'rate_decimal / 12', outputVar: 'periodicRate' },
    { id: 'node_interest', formula: 'balance * periodicRate', outputVar: 'interest_payment' },
    { id: 'node_interest_applied', formula: 'interest_payment', outputVar: 'interestApplied' },
    { id: 'node_principal_paid', formula: 'min(paymentAmount - interest_payment, balance)', outputVar: 'principal_payment' },
    { id: 'node_principal_applied', formula: 'principal_payment', outputVar: 'principalApplied' },
    { id: 'node_new_balance', formula: 'max(balance - principal_payment, 0)', outputVar: 'newBalance' },
    { id: 'node_remaining_balance', formula: 'newBalance', outputVar: 'remainingBalanceAfterPayment' },
    { id: 'node_total_payment', formula: 'principal_payment + interest_payment', outputVar: 'total_payment' },
    { id: 'node_total_payment_alias', formula: 'total_payment', outputVar: 'totalPayment' },
    { id: 'node_total_interest', formula: 'totalInterest + interest_payment', outputVar: 'totalInterest' },
  ];

  const edges = [
    { source: 'principal', target: 'node_rate' },
    { source: 'rate', target: 'node_period_rate' },
    { source: 'node_rate', target: 'node_period_rate' },
    { source: 'paymentAmount', target: 'node_interest' },
    { source: 'balance', target: 'node_interest' },
    { source: 'node_period_rate', target: 'node_interest' },
    { source: 'node_interest', target: 'node_interest_applied' },
    { source: 'node_interest', target: 'node_principal_paid' },
    { source: 'node_payment', target: 'node_principal_paid' },
    { source: 'node_principal_paid', target: 'node_principal_applied' },
    { source: 'balance', target: 'node_new_balance' },
    { source: 'node_principal_paid', target: 'node_new_balance' },
    { source: 'node_new_balance', target: 'node_remaining_balance' },
    { source: 'node_interest', target: 'node_total_payment' },
    { source: 'node_principal_paid', target: 'node_total_payment' },
    { source: 'node_total_payment', target: 'node_total_payment_alias' },
    { source: 'totalInterest', target: 'node_total_interest' },
    { source: 'node_interest', target: 'node_total_interest' },
  ];

  return { nodes, edges };
};

module.exports = { createStandardAmortizationGraph };
