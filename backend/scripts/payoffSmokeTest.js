require('dotenv').config();

const jwt = require('jsonwebtoken');

const { startServer } = require('../src/server');
const { resetDatabaseSchema } = require('../src/bootstrap/schema');
const { sequelize, User, Customer, Associate, Loan } = require('../src/models');
const { buildAmortizationSchedule, summarizeSchedule, roundCurrency } = require('../src/services/creditFormulaHelpers');
const { createLoanViewService } = require('../src/modules/credits/application/loanFinancials');

const loanViewService = createLoanViewService();

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const buildToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

const makeFetch = async ({ baseUrl, path, options = {} }) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status,
    body,
  };
};

const createLoanFixture = async ({ id, customerId, amount, interestRate, termMonths, startDate, status, paymentMutator }) => {
  const schedule = buildAmortizationSchedule({
    amount,
    interestRate,
    termMonths,
    startDate,
  });

  if (typeof paymentMutator === 'function') {
    paymentMutator(schedule);
  }

  const snapshot = summarizeSchedule(schedule);

  return Loan.create({
    id,
    customerId,
    associateId: 1,
    amount,
    interestRate,
    termMonths,
    status,
    startDate,
    endDate: new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + termMonths)),
    emiSchedule: schedule,
    installmentAmount: snapshot.installmentAmount,
    totalPayable: snapshot.totalPayable,
    totalPaid: snapshot.totalPaid,
    principalOutstanding: snapshot.outstandingPrincipal,
    interestOutstanding: snapshot.outstandingInterest,
    financialSnapshot: snapshot,
    recoveryStatus: status === 'defaulted' ? 'in_progress' : 'pending',
  });
};

const seedFixtures = async () => {
  await resetDatabaseSchema({ database: sequelize, env: process.env });

  await Associate.create({
    id: 1,
    name: 'Smoke Associate',
    email: 'associate.smoke@example.com',
    phone: '5550001',
    address: 'Smoke Ave',
  });

  await User.bulkCreate([
    { id: 1, name: 'Smoke Admin', email: 'admin.smoke@example.com', password: 'manual-smoke', role: 'admin' },
    { id: 7, name: 'Active Payoff Customer', email: 'active.payoff@example.com', password: 'manual-smoke', role: 'customer' },
    { id: 8, name: 'Overdue Payoff Customer', email: 'overdue.payoff@example.com', password: 'manual-smoke', role: 'customer' },
  ]);

  await Customer.bulkCreate([
    {
      id: 7,
      name: 'Active Payoff Customer',
      email: 'active.payoff@example.com',
      phone: '5551007',
      address: 'Smoke Test Address',
    },
    {
      id: 8,
      name: 'Overdue Payoff Customer',
      email: 'overdue.payoff@example.com',
      phone: '5551008',
      address: 'Smoke Test Address',
    },
  ]);

  await createLoanFixture({
    id: 101,
    customerId: 7,
    amount: 1000,
    interestRate: 12,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    status: 'active',
  });

  await createLoanFixture({
    id: 102,
    customerId: 8,
    amount: 900,
    interestRate: 24,
    termMonths: 3,
    startDate: '2026-01-01T00:00:00.000Z',
    status: 'defaulted',
    paymentMutator: (schedule) => {
      const first = schedule[0];
      first.paidInterest = first.interestComponent;
      first.paidPrincipal = roundCurrency(100);
      first.paidTotal = roundCurrency(first.paidInterest + first.paidPrincipal);
      first.remainingPrincipal = roundCurrency(first.principalComponent - 100);
      first.remainingInterest = 0;
      first.status = 'partial';
    },
  });
};

const run = async () => {
  let startedServer = null;

  try {
    await sequelize.authenticate();
    await seedFixtures();

    startedServer = await startServer({ port: 0 });
    const port = startedServer.server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const activeLoan = await Loan.findByPk(101);
    const overdueLoan = await Loan.findByPk(102);

    const activeQuote = loanViewService.getPayoffQuote(activeLoan, '2026-03-15');
    const overdueQuote = loanViewService.getPayoffQuote(overdueLoan, '2026-03-20');

    const adminToken = buildToken({ id: 1, role: 'admin' });
    const activeCustomerToken = buildToken({ id: 7, role: 'customer' });
    const overdueCustomerToken = buildToken({ id: 8, role: 'customer' });

    const activeQuoteResponse = await makeFetch({
      baseUrl,
      path: '/api/loans/101/payoff-quote?asOfDate=2026-03-15',
      options: {
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      },
    });

    const activeExecuteResponse = await makeFetch({
      baseUrl,
      path: '/api/loans/101/payoff-executions',
      options: {
        method: 'POST',
        headers: {
          authorization: `Bearer ${activeCustomerToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ asOfDate: '2026-03-15', quotedTotal: activeQuote.total }),
      },
    });

    const activeHistoryResponse = await makeFetch({
      baseUrl,
      path: '/api/reports/credit-history/loan/101',
      options: {
        headers: { authorization: `Bearer ${activeCustomerToken}` },
      },
    });

    const overdueQuoteResponse = await makeFetch({
      baseUrl,
      path: '/api/loans/102/payoff-quote?asOfDate=2026-03-20',
      options: {
        headers: { authorization: `Bearer ${overdueCustomerToken}` },
      },
    });

    const overdueExecuteResponse = await makeFetch({
      baseUrl,
      path: '/api/loans/102/payoff-executions',
      options: {
        method: 'POST',
        headers: {
          authorization: `Bearer ${overdueCustomerToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ asOfDate: '2026-03-20', quotedTotal: overdueQuote.total }),
      },
    });

    const overdueHistoryResponse = await makeFetch({
      baseUrl,
      path: '/api/reports/credit-history/loan/102',
      options: {
        headers: { authorization: `Bearer ${overdueCustomerToken}` },
      },
    });

    const recoveryResponse = await makeFetch({
      baseUrl,
      path: '/api/reports/recovery',
      options: {
        headers: { authorization: `Bearer ${adminToken}` },
      },
    });

    assert(activeQuoteResponse.status === 200, 'Active payoff quote failed');
    assert(activeQuoteResponse.body?.data?.payoffQuote?.total === activeQuote.total, 'Active quote total mismatch');
    assert(activeExecuteResponse.status === 201, 'Active payoff execution failed');
    assert(activeExecuteResponse.body?.data?.loan?.status === 'closed', 'Active loan did not close');
    assert(activeExecuteResponse.body?.data?.loan?.closureReason === 'payoff', 'Active closure reason mismatch');
    assert(activeExecuteResponse.body?.data?.allocation?.payoff?.total === activeQuote.total, 'Active payoff allocation mismatch');
    assert(activeHistoryResponse.status === 200, 'Active history fetch failed');
    assert(activeHistoryResponse.body?.data?.history?.payoffHistory?.length === 1, 'Active history missing payoff record');
    assert(activeHistoryResponse.body?.data?.history?.closure?.closureReason === 'payoff', 'Active history missing closure reason');

    assert(overdueQuoteResponse.status === 200, 'Overdue payoff quote failed');
    assert(overdueQuoteResponse.body?.data?.payoffQuote?.total === overdueQuote.total, 'Overdue quote total mismatch');
    assert(overdueQuoteResponse.body?.data?.payoffQuote?.breakdown?.overduePrincipal > 0, 'Overdue quote missing overdue principal');
    assert(overdueQuoteResponse.body?.data?.payoffQuote?.breakdown?.overdueInterest > 0, 'Overdue quote missing overdue interest');
    assert(overdueExecuteResponse.status === 201, 'Overdue payoff execution failed');
    assert(overdueExecuteResponse.body?.data?.loan?.status === 'closed', 'Overdue loan did not close');
    assert(overdueExecuteResponse.body?.data?.allocation?.payoff?.breakdown?.overduePrincipal > 0, 'Overdue execution missing overdue principal allocation');
    assert(overdueHistoryResponse.status === 200, 'Overdue history fetch failed');
    assert(overdueHistoryResponse.body?.data?.history?.payoffHistory?.length === 1, 'Overdue history missing payoff record');

    assert(recoveryResponse.status === 200, 'Recovery report fetch failed');

    console.log(JSON.stringify({
      active: {
        quoteTotal: activeQuoteResponse.body.data.payoffQuote.total,
        executedStatus: activeExecuteResponse.body.data.loan.status,
        closureReason: activeExecuteResponse.body.data.loan.closureReason,
        payoffHistoryCount: activeHistoryResponse.body.data.history.payoffHistory.length,
      },
      overdue: {
        quoteTotal: overdueQuoteResponse.body.data.payoffQuote.total,
        overduePrincipal: overdueQuoteResponse.body.data.payoffQuote.breakdown.overduePrincipal,
        overdueInterest: overdueQuoteResponse.body.data.payoffQuote.breakdown.overdueInterest,
        executedStatus: overdueExecuteResponse.body.data.loan.status,
        payoffHistoryCount: overdueHistoryResponse.body.data.history.payoffHistory.length,
      },
      recovery: {
        recoveredLoans: recoveryResponse.body.data.recoveredLoans.length,
        outstandingLoans: recoveryResponse.body.data.outstandingLoans.length,
      },
    }, null, 2));
  } finally {
    startedServer?.bootstrap?.overdueAlerts?.stop?.();

    if (startedServer?.server) {
      await new Promise((resolve, reject) => {
        startedServer.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await sequelize.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
