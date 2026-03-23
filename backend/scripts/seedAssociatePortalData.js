require('dotenv').config();

const { sequelize, Customer, Loan, ProfitDistribution } = require('../src/models');
const { createJwtTokenService } = require('../src/modules/shared/auth/tokenService');
const { createLoanAccessPolicy } = require('../src/modules/shared/loanAccessPolicy');
const {
  createRegisterUser,
} = require('../src/modules/auth/application/useCases');
const {
  userRepository,
  customerProfileRepository,
  associateProfileRepository,
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

const API_BASE_URL = process.env.SEED_API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
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

const ensureSeedUser = async ({ registerUser, email, name, role, phone = undefined }) => {
  const existingUser = await userRepository.findByEmail(email);
  const hashedPassword = await passwordHasher.hash(SEED_PASSWORD);

  if (existingUser) {
    await userRepository.update(existingUser.id, {
      name,
      email,
      role,
      password: hashedPassword,
    });

    if (role === 'customer') {
      const customer = await Customer.findByPk(existingUser.id);
      if (customer) {
        await customer.update({
          name,
          email,
          phone: phone || customer.phone || '',
        });
      }
    }

    return userRepository.findById(existingUser.id);
  }

  const result = await registerUser({
    actor: role === 'admin' ? { id: 0, role: 'admin' } : null,
    registrationSource: role === 'admin' ? 'admin' : 'public',
    payload: {
      name,
      email,
      password: SEED_PASSWORD,
      role,
      ...(phone ? { phone } : {}),
    },
  });

  return userRepository.findById(result.user.id);
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
  const registerUser = createRegisterUser({
    userRepository,
    customerProfileRepository,
    associateProfileRepository,
    passwordHasher,
    tokenService,
  });
  const createLoan = createCreateLoan({ loanCreationService });
  const createCustomer = createCreateCustomer({ customerRepository });
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository,
    loanAccessPolicy: createLoanAccessPolicy({ loanRepository }),
  });
  const createAssociateContribution = createCreateAssociateContribution({ associateRepository });
  const createProfitDistribution = createCreateProfitDistribution({ associateRepository });

  const adminUser = await ensureSeedUser({
    registerUser,
    email: SEED_ADMIN_EMAIL,
    name: 'Seed Admin Socios',
    role: 'admin',
  });
  const adminActor = { id: adminUser.id, role: 'admin' };
  const adminToken = tokenService.sign(adminActor);

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
      associateId: associate.id,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!seededLoan) {
    seededLoan = await createLoan({
      actor: adminActor,
      payload: {
        customerId: seededCustomer.id,
        associateId: associate.id,
        amount: 7200,
        interestRate: 12,
        termMonths: 6,
        lateFeeMode: 'NONE',
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
        loanId: seededLoan.id,
        amount: 325.5,
        distributionDate: '2026-03-23',
        notes: SEED_DISTRIBUTION_NOTE,
      },
    });
  }

  const [portalResponse, profitabilityResponse, calendarResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/associates/${associate.id}/portal`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
    fetch(`${API_BASE_URL}/api/reports/associates/profitability/${associate.id}`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
    fetch(`${API_BASE_URL}/api/loans/${seededLoan.id}/calendar`, { headers: createJsonHeaders(adminToken) }).then(ensureOk),
  ]);

  const portal = portalResponse?.data?.portal || {};
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
      portalLoanCount: Array.isArray(portal.loans) ? portal.loans.length : 0,
      portalContributionCount: Array.isArray(portal.contributions) ? portal.contributions.length : 0,
      portalDistributionCount: Array.isArray(portal.distributions) ? portal.distributions.length : 0,
      profitabilityLoanCount: Array.isArray(reportData.loans) ? reportData.loans.length : 0,
      profitabilityContributionCount: Array.isArray(reportData.contributions) ? reportData.contributions.length : 0,
      profitabilityDistributionCount: Array.isArray(reportData.distributions) ? reportData.distributions.length : 0,
      calendarEntryCount: Array.isArray(calendar.entries) ? calendar.entries.length : 0,
      portalLoanCustomerName: portal.loans?.[0]?.Customer?.name || null,
      summary: {
        totalContributed: report.summary?.totalContributed ?? portal.summary?.totalContributed ?? null,
        totalDistributed: report.summary?.totalDistributed ?? portal.summary?.totalDistributed ?? null,
        activeLoanCount: portal.summary?.activeLoanCount ?? null,
      },
    },
  };

  console.log(JSON.stringify(result, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
