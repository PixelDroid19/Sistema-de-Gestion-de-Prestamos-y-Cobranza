require('module-alias/register');
require('dotenv').config({ quiet: true });

const { sequelize, Customer, Loan, ProfitDistribution, User } = require('../src/models');
const { createJwtTokenService } = require('../src/modules/shared/auth/tokenService');
const { createLoanAccessPolicy } = require('../src/modules/shared/loanAccessPolicy');
const {
  userRepository,
  passwordHasher,
} = require('../src/modules/auth/infrastructure/repositories');
const {
  createCreateLoan,
  createUpdateLoanStatus,
} = require('../src/modules/credits/application/useCases');
const {
  loanCreationService,
  loanRepository,
} = require('../src/modules/credits/infrastructure/repositories');
const {
  createCreateAssociateContribution,
  createCreateProfitDistribution,
} = require('../src/modules/associates/application/useCases');
const {
  associateRepository,
} = require('../src/modules/associates/infrastructure/repositories');
const {
  createCreateCustomer,
} = require('../src/modules/customers/application/useCases');
const {
  customerRepository,
} = require('../src/modules/customers/infrastructure/repositories');
const { parseTcpPort } = require('../src/bootstrap/ports');

const DEFAULT_PORT = 5000;
const resolveApiBaseUrl = (env = process.env) => {
  if (env.SEED_API_BASE_URL) {
    return String(env.SEED_API_BASE_URL).replace(/\/+$/, '');
  }

  const port = parseTcpPort('PORT', env.PORT || DEFAULT_PORT, { allowZero: false });
  return `http://localhost:${port}`;
};

const SEED_ADMIN_EMAIL = 'seed.admin.socios.local@example.com';
const SEED_CUSTOMER_EMAIL = 'seed.customer.socios.local@example.com';
const SEED_PASSWORD = 'Seed123!';
const SEED_CUSTOMER_DOCUMENT = 'SOCIOS-SEED-0001';
const SEED_DISTRIBUTION_NOTE = 'Local seed distribution for associates workspace verification';
const SEED_CONTRIBUTION_NOTE = 'Local seed contribution for associates workspace verification';

const createJsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const ensureOk = async (response) => {
  if (response.ok) {
    return response.json();
  }

  const body = await response.text();
  throw new Error(`HTTP ${response.status}: ${body}`);
};

const ensureSeedAdmin = async ({ email, name }) => {
  const existingUser = await userRepository.findByEmail(email);
  const hashedPassword = await passwordHasher.hash(SEED_PASSWORD);

  if (existingUser) {
    await userRepository.update(existingUser.id, {
      name,
      email,
      role: 'admin',
      password: hashedPassword,
    });

    return userRepository.findById(existingUser.id);
  }

  return User.create({
    name,
    email,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
};

const selectAssociate = async () => {
  const activeAssociates = await associateRepository.listActiveAssociatesWithParticipation();
  if (!activeAssociates.length) {
    throw new Error('No active associates found. Create at least one active associate before seeding.');
  }

  for (const associate of activeAssociates) {
    const contributions = await associateRepository.listContributionsByAssociate(associate.id);
    if (contributions.length > 0) {
      return associate;
    }
  }

  return activeAssociates[0];
};

const main = async () => {
  await sequelize.authenticate();

  const tokenService = createJwtTokenService();
  const createLoan = createCreateLoan({ loanCreationService });
  const createCustomer = createCreateCustomer({ customerRepository });
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository,
    loanAccessPolicy: createLoanAccessPolicy({ loanRepository }),
  });
  const createAssociateContribution = createCreateAssociateContribution({ associateRepository });
  const createProfitDistribution = createCreateProfitDistribution({ associateRepository });

  const adminUser = await ensureSeedAdmin({
    email: SEED_ADMIN_EMAIL,
    name: 'Seed Admin Socios',
  });
  const adminActor = { id: adminUser.id, role: 'admin' };
  const adminToken = tokenService.sign(adminActor);
  const apiBaseUrl = resolveApiBaseUrl();

  let seededCustomer = await Customer.findOne({ where: { email: SEED_CUSTOMER_EMAIL } });
  if (!seededCustomer) {
    seededCustomer = await createCustomer({
      name: 'Seed Customer Socios',
      email: SEED_CUSTOMER_EMAIL,
      phone: '+5491123456789',
      address: 'Local seed dataset',
      documentNumber: SEED_CUSTOMER_DOCUMENT,
    });
  }

  const associate = await selectAssociate();

  const existingContributions = await associateRepository.listContributionsByAssociate(associate.id);
  let seededContribution = existingContributions[0] || null;

  if (!seededContribution) {
    seededContribution = await createAssociateContribution({
      actor: adminActor,
      associateId: associate.id,
      payload: {
        amount: 150000,
        contributionDate: '2026-03-22',
        notes: SEED_CONTRIBUTION_NOTE,
      },
    });
  }

  let seededLoan = await Loan.findOne({
    where: {
      customerId: seededCustomer.id,
      amount: 7200,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!seededLoan) {
    seededLoan = await createLoan({
      actor: adminActor,
      payload: {
        customerId: seededCustomer.id,
        amount: 7200,
        termMonths: 6,
        startDate: '2026-03-22',
        rateSource: 'policy',
        lateFeeSource: 'policy',
      },
    });
  }

  if (seededLoan.status === 'pending') {
    seededLoan = await updateLoanStatus({ actor: adminActor, loanId: seededLoan.id, status: 'approved' });
  }

  let seededDistribution = await ProfitDistribution.findOne({
    where: {
      associateId: associate.id,
      notes: SEED_DISTRIBUTION_NOTE,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!seededDistribution) {
    seededDistribution = await createProfitDistribution({
      actor: adminActor,
      associateId: associate.id,
      payload: {
        amount: 325.5,
        distributionDate: '2026-03-23',
        notes: SEED_DISTRIBUTION_NOTE,
      },
    });
  }

  const [financialDetailsResponse, profitabilityResponse, calendarResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/api/associates/${associate.id}/financial-details`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
    fetch(`${apiBaseUrl}/api/reports/associates/profitability/${associate.id}`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
    fetch(`${apiBaseUrl}/api/loans/${seededLoan.id}/calendar`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
  ]);

  const financialDetails = financialDetailsResponse?.data?.details || financialDetailsResponse?.data?.financialDetails || {};
  const report = profitabilityResponse?.data?.report || {};
  const reportData = report.data || {};
  const calendar = calendarResponse?.data?.calendar || {};

  const result = {
    associate: {
      id: associate.id,
      name: associate.name,
      status: associate.status,
      participationPercentage: associate.participationPercentage,
    },
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
    },
    seededCustomer: {
      id: seededCustomer.id,
      email: seededCustomer.email,
    },
    seededContribution: seededContribution ? {
      id: seededContribution.id,
      amount: seededContribution.amount,
      contributionDate: seededContribution.contributionDate,
    } : null,
    seededLoan: {
      id: seededLoan.id,
      customerId: seededLoan.customerId,
      associateId: seededLoan.associateId,
      status: seededLoan.status,
      amount: seededLoan.amount,
      installmentCount: Array.isArray(seededLoan.emiSchedule) ? seededLoan.emiSchedule.length : 0,
    },
    seededDistribution: seededDistribution ? {
      id: seededDistribution.id,
      loanId: seededDistribution.loanId,
      amount: seededDistribution.amount,
      distributionDate: seededDistribution.distributionDate,
      notes: seededDistribution.notes,
    } : null,
    liveRecheck: {
      financialDetailsContributionCount: Array.isArray(financialDetails.contributions) ? financialDetails.contributions.length : 0,
      financialDetailsDistributionCount: Array.isArray(financialDetails.distributions) ? financialDetails.distributions.length : 0,
      financialDetailsPaymentHistoryCount: Array.isArray(financialDetails.paymentHistory) ? financialDetails.paymentHistory.length : 0,
      profitabilityContributionCount: Array.isArray(reportData.contributions) ? reportData.contributions.length : 0,
      profitabilityDistributionCount: Array.isArray(reportData.distributions) ? reportData.distributions.length : 0,
      calendarEntryCount: Array.isArray(calendar.entries) ? calendar.entries.length : 0,
      summary: {
        totalContributed: report.summary?.totalContributed ?? financialDetails.summary?.totalContributed ?? null,
        totalDistributed: report.summary?.totalDistributed ?? financialDetails.summary?.totalDistributed ?? null,
        debtStatus: financialDetails.summary?.debtStatus ?? null,
      },
    },
  };

  console.log(JSON.stringify(result, null, 2));
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  resolveApiBaseUrl,
};
