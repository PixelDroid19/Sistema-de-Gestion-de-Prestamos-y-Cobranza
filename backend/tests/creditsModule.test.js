const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  createListLoans,
  createCreateSimulation,
  createAssignRecoveryAssignee,
  createListRecoveryRoster,
  createUpdateLoanStatus,
  createUpdateRecoveryStatus,
  createDeleteLoan,
  createListLoanAttachments,
  createCreateLoanAttachment,
  createDownloadLoanAttachment,
  createListLoanAlerts,
  createGetLoanById,
  createGetPaymentCalendar,
  createGetPayoffQuote,
  createExecutePayoff,
  createListPromisesToPay,
  createCreatePromiseToPay,
  createCreateLoanFollowUp,
  createUpdateLoanAlertStatus,
  createUpdatePromiseToPayStatus,
} = require('../src/modules/credits/application/useCases');
const { createLoanViewService } = require('../src/modules/credits/application/loanFinancials');
const { createLocalAttachmentStorage } = require('../src/modules/credits/infrastructure/attachmentStorage');
const { AuthorizationError, NotFoundError, ValidationError } = require('../src/utils/errorHandler');
const { createCreditsModule } = require('../src/modules/credits');

test('createListLoans scopes repository results through the shared access policy', async () => {
  let filterCall;
  const listLoans = createListLoans({
    loanRepository: {
      async list() {
        return [
          { id: 41, customerId: 7, agentId: 9 },
          { id: 42, customerId: 99, agentId: 11 },
        ];
      },
    },
    loanAccessPolicy: {
      filterVisibleLoans(input) {
        filterCall = input;
        return [input.loans[0]];
      },
    },
  });

  const loans = await listLoans({ actor: { id: 9, role: 'admin' } });

  assert.equal(filterCall.actor.id, 9);
  assert.equal(loans.length, 1);
  assert.equal(loans[0].id, 41);
});

test('createListLoans enriches visible loan rows with additive customer summary data', async () => {
  const listLoans = createListLoans({
    loanRepository: {
      async list() {
        return [
          { id: 41, customerId: 7, Customer: { id: 7, name: 'Ana Customer' } },
        ];
      },
      async attachCustomerSummaries(loans) {
        return loans.map((loan) => ({
          ...loan,
          customerSummary: {
            totalLoans: 2,
            activeLoans: 1,
            totalOutstandingBalance: 450,
            latestLoanId: 41,
            latestLoanStatus: 'approved',
          },
        }));
      },
    },
  });

  const loans = await listLoans({ actor: { id: 9, role: 'admin' } });

  assert.deepEqual(loans[0].customerSummary, {
    totalLoans: 2,
    activeLoans: 1,
    totalOutstandingBalance: 450,
    latestLoanId: 41,
    latestLoanStatus: 'approved',
  });
});

test('createCreateSimulation returns canonical preview data from the domain service', async () => {
  const createSimulation = createCreateSimulation({
    creditDomainService: {
      simulate(input) {
        return {
          lateFeeMode: 'NONE',
          schedule: [{ installmentNumber: 1 }],
          summary: { amount: input.amount },
        };
      },
    },
  });

  const simulation = await createSimulation({ amount: 12000, interestRate: 12, termMonths: 12 });

  assert.equal(simulation.lateFeeMode, 'NONE');
  assert.equal(simulation.summary.amount, 12000);
});

test('createGetLoanById enriches the loan with canonical payment context and eligibility', async () => {
  const getLoanById = createGetLoanById({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.equal(actor.role, 'customer');
        assert.equal(loanId, 55);
        return {
          id: 55,
          customerId: 7,
          status: 'approved',
          amount: 1000,
          interestRate: 12,
          termMonths: 2,
          startDate: '2026-01-01T00:00:00.000Z',
          financialSnapshot: {
            installmentAmount: 530,
            outstandingBalance: 1000,
            outstandingPrincipal: 1000,
          },
          emiSchedule: [
            {
              installmentNumber: 1,
              dueDate: '2099-01-01T00:00:00.000Z',
              scheduledPayment: 530,
              remainingPrincipal: 500,
              remainingInterest: 30,
              paidTotal: 0,
              status: 'pending',
            },
            {
              installmentNumber: 2,
              dueDate: '2099-02-01T00:00:00.000Z',
              scheduledPayment: 530,
              remainingPrincipal: 500,
              remainingInterest: 0,
              paidTotal: 0,
              status: 'pending',
            },
          ],
        };
      },
    },
    loanRepository: {
      async attachCustomerSummaries(loans) {
        return loans.map((loan) => ({
          ...loan,
          customerSummary: {
            totalLoans: 3,
            activeLoans: 2,
            totalOutstandingBalance: 1000,
            latestLoanId: 55,
            latestLoanStatus: 'approved',
          },
        }))
      },
    },
    loanViewService: createLoanViewService(),
  });

  const loan = await getLoanById({ actor: { id: 7, role: 'customer' }, loanId: 55 });

  assert.equal(loan.id, 55);
  assert.deepEqual(loan.paymentContext.allowedPaymentTypes, ['installment', 'payoff']);
  assert.equal(loan.paymentContext.isPayable, true);
  assert.equal(loan.paymentContext.snapshot.outstandingBalance, 1000);
  assert.equal(loan.paymentContext.payoffEligibility.allowed, true);
  assert.equal(loan.paymentContext.capitalEligibility.allowed, true);
  assert.deepEqual(loan.customerSummary, {
    totalLoans: 3,
    activeLoans: 2,
    totalOutstandingBalance: 1000,
    latestLoanId: 55,
    latestLoanStatus: 'approved',
  });
});

test('createAssignRecoveryAssignee updates the loan and emits a notification payload', async () => {
  let sentNotification;
  const assignRecoveryAssignee = createAssignRecoveryAssignee({
    loanRepository: {
      async findById() {
        return {
          id: 22,
          amount: 8000,
          status: 'defaulted',
          recoveryStatus: 'pending',
          agentId: null,
          customerId: 7,
          Customer: { name: 'Ana Customer', email: 'ana@example.com' },
        };
      },
      async save(loan) {
        return loan;
      },
    },
    recoveryAssignmentRepository: {
      async findById() {
        return { id: 9, email: 'agent@example.com' };
      },
    },
    userRepository: {
      async findRecoveryAssigneeUserByEmail() {
        return { id: 99, role: 'admin' };
      },
    },
    notificationPort: {
      async sendRecoveryAssignment(userId, payload) {
        sentNotification = { userId, payload };
      },
    },
  });

  const loan = await assignRecoveryAssignee({ actor: { id: 1, role: 'admin' }, loanId: 22, recoveryAssigneeId: 9 });

  assert.equal(loan.agentId, 9);
  assert.equal(loan.recoveryStatus, 'assigned');
  assert.equal(sentNotification.userId, 99);
  assert.equal(sentNotification.payload.loanId, 22);
});

test('createListRecoveryRoster returns repository pagination results for admins', async () => {
  const listRecoveryRoster = createListRecoveryRoster({
    recoveryAssignmentRepository: {
      async listPage() {
        return {
          items: [{ id: 9, name: 'Marta Reyes', email: 'marta@lendflow.test' }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        }
      },
    },
  })

  const result = await listRecoveryRoster({ actor: { id: 1, role: 'admin' }, pagination: { page: 1, pageSize: 25 } })

  assert.deepEqual(result, {
    items: [{ id: 9, name: 'Marta Reyes', email: 'marta@lendflow.test' }],
    pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  })
})

test('createUpdateLoanStatus moves defaulted loans into pending recovery', async () => {
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository: {
      async save(loan) {
        return loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return {
          id: 32,
          status: 'approved',
          recoveryStatus: null,
          customerId: 4,
          termMonths: 12,
        };
      },
    },
  });

  const updatedLoan = await updateLoanStatus({
    actor: { id: 1, role: 'admin' },
    loanId: 32,
    status: 'defaulted',
  });

  assert.equal(updatedLoan.status, 'defaulted');
  assert.equal(updatedLoan.recoveryStatus, 'pending');
});

test('createUpdateLoanStatus rejects unauthorized admin mutation attempts through shared policy', async () => {
  const updateLoanStatus = createUpdateLoanStatus({
    loanRepository: {
      async save(loan) {
        return loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        throw new AuthorizationError('You can only update loans assigned to you');
      },
    },
  });

  await assert.rejects(() => updateLoanStatus({
    actor: { id: 8, role: 'admin' },
    loanId: 55,
    status: 'approved',
  }), AuthorizationError);
});

test('createUpdateRecoveryStatus lets admins progress recovery', async () => {
  const updateRecoveryStatus = createUpdateRecoveryStatus({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.equal(actor.id, 9);
        assert.equal(loanId, 32);
        return {
          id: 32,
          status: 'defaulted',
          recoveryStatus: 'assigned',
          agentId: 9,
          async save() {
            return this;
          },
        };
      },
    },
    recoveryStatusGuard: {
      assertCanTransition({ loan, nextRecoveryStatus }) {
        assert.equal(loan.status, 'defaulted');
        assert.equal(nextRecoveryStatus, 'in_progress');
      },
    },
    loanRepository: {
      async save(loan) {
        return loan.save();
      },
    },
  });

  const updatedLoan = await updateRecoveryStatus({
    actor: { id: 9, role: 'admin' },
    loanId: 32,
    recoveryStatus: 'in_progress',
  });

  assert.equal(updatedLoan.recoveryStatus, 'in_progress');
});

test('createDeleteLoan rejects deletion of a foreign rejected loan before destroy', async () => {
  let destroyed = false;
  const deleteLoan = createDeleteLoan({
    loanRepository: {
      async destroy() {
        destroyed = true;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new AuthorizationError('You can only access loans assigned to you');
      },
    },
  });

  await assert.rejects(() => deleteLoan({
    actor: { id: 12, role: 'admin' },
    loanId: 88,
  }), (error) => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.message, 'You can only access loans assigned to you');
    return true;
  });

  assert.equal(destroyed, false);
});

test('createDeleteLoan deletes an authorized rejected loan', async () => {
  let destroyedLoan = null;
  const rejectedLoan = { id: 77, status: 'rejected', customerId: 7, agentId: 9 };
  const deleteLoan = createDeleteLoan({
    loanRepository: {
      async destroy(loan) {
        destroyedLoan = loan;
      },
    },
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.equal(actor.id, 7);
        assert.equal(actor.role, 'customer');
        assert.equal(loanId, 77);
        return rejectedLoan;
      },
    },
  });

  await deleteLoan({
    actor: { id: 7, role: 'customer' },
    loanId: 77,
  });

  assert.equal(destroyedLoan, rejectedLoan);
});

test('createListLoanAttachments hides internal-only documents from customers', async () => {
  const listLoanAttachments = createListLoanAttachments({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.equal(actor.id, 7);
        assert.equal(loanId, 22);
        return { id: 22, customerId: 7 };
      },
    },
    attachmentRepository: {
      async listByLoan() {
        return [
          { id: 1, customerVisible: true, originalName: 'visible.pdf' },
          { id: 2, customerVisible: false, originalName: 'internal.pdf' },
        ];
      },
    },
  });

  const attachments = await listLoanAttachments({ actor: { id: 7, role: 'customer' }, loanId: 22 });

  assert.deepEqual(attachments, [
    { id: 1, customerVisible: true, originalName: 'visible.pdf' },
  ]);
});

test('createCreateLoanAttachment persists metadata for an authorized admin upload', async () => {
  let createdPayload;
  const createLoanAttachment = createCreateLoanAttachment({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan({ actor, loanId }) {
        assert.equal(actor.id, 9);
        assert.equal(loanId, 22);
        return { id: 22, agentId: 9 };
      },
    },
    attachmentRepository: {
      async create(payload) {
        createdPayload = payload;
        return { id: 5, ...payload };
      },
    },
    attachmentStorage: {
      toRelativePath(filePath) {
        assert.equal(filePath, '/tmp/loan-proof.pdf');
        return 'loan-proof.pdf';
      },
      async deleteByAbsolutePath() {},
    },
  });

  const attachment = await createLoanAttachment({
    actor: { id: 9, role: 'admin' },
    loanId: 22,
    file: {
      path: '/tmp/loan-proof.pdf',
      filename: 'loan-proof.pdf',
      originalname: 'Loan Proof.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    },
    metadata: {
      customerVisible: 'true',
      category: 'contract',
      description: 'Signed contract',
    },
  });

  assert.equal(attachment.id, 5);
  assert.deepEqual(createdPayload, {
    loanId: 22,
    uploadedByUserId: 9,
    storageDisk: 'local',
    storagePath: 'loan-proof.pdf',
    storedName: 'loan-proof.pdf',
    originalName: 'Loan Proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    customerVisible: true,
    category: 'contract',
    description: 'Signed contract',
  });
});

test('createDownloadLoanAttachment blocks customers from internal-only files', async () => {
  const downloadLoanAttachment = createDownloadLoanAttachment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7 };
      },
    },
    attachmentRepository: {
      async findByIdForLoan() {
        return { id: 4, loanId: 22, customerVisible: false, originalName: 'internal.pdf' };
      },
    },
    attachmentStorage: {
      async assertExists() {},
      resolveAbsolutePath(storagePath) {
        return storagePath;
      },
    },
  });

  await assert.rejects(() => downloadLoanAttachment({
    actor: { id: 7, role: 'customer' },
    loanId: 22,
    attachmentId: 4,
  }), AuthorizationError);
});

test('createDownloadLoanAttachment surfaces missing backing files as not found', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lendflow-missing-attachment-'));
  const downloadLoanAttachment = createDownloadLoanAttachment({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7 };
      },
    },
    attachmentRepository: {
      async findByIdForLoan() {
        return { id: 4, loanId: 22, customerVisible: true, originalName: 'visible.pdf', storagePath: 'visible.pdf' };
      },
    },
    attachmentStorage: createLocalAttachmentStorage({ baseDirectory: temporaryDirectory }),
  });

  try {
    await assert.rejects(() => downloadLoanAttachment({
      actor: { id: 9, role: 'admin' },
      loanId: 22,
      attachmentId: 4,
    }), NotFoundError);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('createListLoanAlerts syncs overdue alerts before returning the latest list', async () => {
  let listLoanId;
  let syncedInput;
  const loan = { id: 22, customerId: 7, emiSchedule: [] };
  const schedule = [{ installmentNumber: 1, dueDate: '2026-01-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 20, scheduledPayment: 120 }];
  const listLoanAlerts = createListLoanAlerts({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return loan;
      },
    },
    loanViewService: {
      getCanonicalLoanView() {
        return {
          schedule,
        };
      },
    },
    alertRepository: {
      async syncOverdueInstallmentAlerts(input) {
        syncedInput = input;
      },
      async listByLoan(loanId) {
        listLoanId = loanId;
        return [{ id: 5, loanId: 22, status: 'active' }];
      },
    },
  });

  const alerts = await listLoanAlerts({ actor: { id: 1, role: 'admin' }, loanId: 22 });

  assert.deepEqual(syncedInput, { loan, schedule });
  assert.equal(listLoanId, 22);
  assert.equal(alerts[0].id, 5);
});

test('createGetPaymentCalendar maps schedule rows into overdue-aware entries', async () => {
  let listedLoanId;
  const getPaymentCalendar = createGetPaymentCalendar({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, customerId: 7, emiSchedule: [] };
      },
    },
    loanViewService: {
      getCanonicalLoanView() {
        return {
          schedule: [
            { installmentNumber: 1, dueDate: '2026-01-01T00:00:00.000Z', remainingPrincipal: 100, remainingInterest: 20, scheduledPayment: 120, paidTotal: 0 },
            { installmentNumber: 2, dueDate: '2026-04-01T00:00:00.000Z', remainingPrincipal: 0, remainingInterest: 0, scheduledPayment: 120, paidTotal: 120 },
          ],
          snapshot: { outstandingBalance: 120 },
        };
      },
    },
    alertRepository: {
      async listByLoan(loanId) {
        listedLoanId = loanId;
        return [{ id: 10, installmentNumber: 1, status: 'active' }];
      },
    },
  });

  const calendar = await getPaymentCalendar({ actor: { id: 7, role: 'customer' }, loanId: 22 });

  assert.equal(calendar.entries[0].status, 'overdue');
  assert.equal(calendar.entries[1].status, 'paid');
  assert.equal(calendar.snapshot.outstandingBalance, 120);
  assert.equal(calendar.alerts.length, 1);
  assert.equal(listedLoanId, 22);
});

test('createGetPaymentCalendar keeps annulled installments hidden from overdue alerts and zeroes outstanding amount', async () => {
  const getPaymentCalendar = createGetPaymentCalendar({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 25, customerId: 7, emiSchedule: [] };
      },
    },
    loanViewService: {
      getCanonicalLoanView() {
        return {
          schedule: [
            {
              installmentNumber: 1,
              dueDate: '2026-01-01T00:00:00.000Z',
              remainingPrincipal: 100,
              remainingInterest: 20,
              scheduledPayment: 120,
              paidTotal: 0,
              status: 'annulled',
            },
          ],
          snapshot: { outstandingBalance: 0 },
        };
      },
    },
    alertRepository: {
      async listByLoan() {
        return [{ id: 11, installmentNumber: 1, status: 'resolved' }];
      },
    },
  });

  const calendar = await getPaymentCalendar({ actor: { id: 7, role: 'customer' }, loanId: 25 });

  assert.equal(calendar.entries[0].status, 'annulled');
  assert.equal(calendar.entries[0].outstandingAmount, 0);
  assert.equal(calendar.entries[0].alertId, null);
});

test('createGetPayoffQuote reuses visible-loan authorization for quotes', async () => {
  let requestedLoanId;
  const getPayoffQuote = createGetPayoffQuote({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        requestedLoanId = loanId;
        assert.equal(actor.role, 'admin');
        return { id: 22, status: 'active', startDate: '2026-01-01T00:00:00.000Z' };
      },
    },
    loanViewService: {
      getPayoffQuote(loan, asOfDate) {
        assert.equal(loan.id, 22);
        assert.equal(asOfDate, '2026-03-15');
        return { asOfDate, total: 100, breakdown: {} };
      },
    },
  });

  const quote = await getPayoffQuote({ actor: { id: 9, role: 'admin' }, loanId: 22, asOfDate: '2026-03-15' });

  assert.equal(requestedLoanId, 22);
  assert.equal(quote.total, 100);
});

test('createGetPayoffQuote rejects already settled loans', async () => {
  const getPayoffQuote = createGetPayoffQuote({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return {
          id: 22,
          customerId: 7,
          status: 'closed',
          amount: 1000,
          interestRate: 12,
          termMonths: 3,
          startDate: '2026-01-01T00:00:00.000Z',
          emiSchedule: [],
          financialSnapshot: {
            outstandingPrincipal: 0,
            outstandingInterest: 0,
            outstandingBalance: 0,
          },
        };
      },
    },
    loanViewService: createLoanViewService(),
  });

  await assert.rejects(() => getPayoffQuote({ actor: { id: 7, role: 'customer' }, loanId: 22, asOfDate: '2026-03-15' }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /not allowed/i);
    assert.equal(error.code, 'PAYOFF_NOT_ALLOWED');
    return true;
  });
});

test('createExecutePayoff requires customer payment authority and forwards execution inputs', async () => {
  let executionInput;
  const executePayoff = createExecutePayoff({
    loanAccessPolicy: {
      async findAuthorizedLoan({ actor, loanId }) {
        assert.equal(actor.role, 'customer');
        assert.equal(loanId, 22);
        return { id: 22, customerId: 7 };
      },
    },
    paymentApplicationService: {
      async applyPayoff(input) {
        executionInput = input;
        return { payment: { id: 1 }, allocation: { payoff: { total: input.quotedTotal } }, loan: { id: input.loanId } };
      },
    },
    clock: () => new Date('2026-03-15T18:30:00.000Z'),
  });

  const result = await executePayoff({
    actor: { id: 7, role: 'customer' },
    loanId: 22,
    asOfDate: '2026-03-15',
    quotedTotal: 104.56,
  });

  assert.equal(result.payment.id, 1);
  assert.deepEqual(executionInput, {
    loanId: 22,
    asOfDate: '2026-03-15',
    quotedTotal: 104.56,
    paymentDate: new Date('2026-03-15T18:30:00.000Z'),
  });
});

test('createExecutePayoff rejects non-customer actors before payment execution', async () => {
  const executePayoff = createExecutePayoff({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        throw new Error('findAuthorizedLoan should not be called');
      },
    },
    paymentApplicationService: {
      async applyPayoff() {
        throw new Error('applyPayoff should not be called');
      },
    },
  });

  await assert.rejects(() => executePayoff({
    actor: { id: 1, role: 'admin' },
    loanId: 22,
    asOfDate: '2026-03-15',
    quotedTotal: 104.56,
  }), AuthorizationError);
});

test('createCreatePromiseToPay records a pending promise with status history', async () => {
  let createdPayload;
  const createPromiseToPay = createCreatePromiseToPay({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return { id: 22, agentId: 9 };
      },
    },
    promiseRepository: {
      async create(payload) {
        createdPayload = payload;
        return { id: 4, ...payload };
      },
    },
  });

  const promise = await createPromiseToPay({
    actor: { id: 9, role: 'admin' },
    loanId: 22,
    payload: { promisedDate: '2026-03-25', amount: 300, notes: 'Customer confirmed payday' },
  });

  assert.equal(promise.id, 4);
  assert.equal(createdPayload.status, 'pending');
  assert.equal(createdPayload.statusHistory[0].status, 'pending');
});

test('createListPromisesToPay expires broken pending promises before returning history', async () => {
  const listPromisesToPay = createListPromisesToPay({
    loanAccessPolicy: {
      async findAuthorizedLoan() {
        return { id: 22, agentId: 9 };
      },
    },
    promiseRepository: {
      async expireBrokenPromises({ loanId }) {
        assert.equal(loanId, 22);
        return [{ id: 8, status: 'broken' }];
      },
    },
  });

  const promises = await listPromisesToPay({ actor: { id: 9, role: 'admin' }, loanId: 22 });

  assert.equal(promises[0].status, 'broken');
});

test('createCreateLoanFollowUp creates a reminder and notifies the customer', async () => {
  let sentPayload;
  const createLoanFollowUp = createCreateLoanFollowUp({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return { id: 22, customerId: 7 };
      },
    },
    alertRepository: {
      async create(payload) {
        return { id: 91, ...payload };
      },
    },
    notificationPort: {
      async sendLoanReminder(userId, payload) {
        sentPayload = { userId, payload };
      },
    },
  });

  const result = await createLoanFollowUp({
    actor: { id: 9, role: 'admin' },
    loanId: 22,
    payload: { installmentNumber: 5, dueDate: '2026-03-30', outstandingAmount: 120, notes: 'Reminder sent' },
  });

  assert.equal(result.reminder.id, 91);
  assert.equal(sentPayload.userId, 7);
  assert.equal(sentPayload.payload.installmentNumber, 5);
});

test('createUpdateLoanAlertStatus resolves active alerts with audit notes', async () => {
  const alert = { id: 8, status: 'active', notes: null, async save() { return this; } };
  const updateLoanAlertStatus = createUpdateLoanAlertStatus({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return { id: 22 };
      },
    },
    alertRepository: {
      async findByIdForLoan() {
        return alert;
      },
      async save(savedAlert) {
        return savedAlert;
      },
    },
  });

  const updated = await updateLoanAlertStatus({
    actor: { id: 1, role: 'admin' },
    loanId: 22,
    alertId: 8,
    payload: { status: 'resolved', notes: 'Paid manually' },
  });

  assert.equal(updated.status, 'resolved');
  assert.match(updated.notes, /Paid manually/);
});

test('createUpdatePromiseToPayStatus updates status history and notifies customer', async () => {
  let notificationPayload;
  const promise = {
    id: 5,
    status: 'pending',
    statusHistory: [],
    notes: null,
    async save() { return this; },
  };
  const updatePromiseToPayStatus = createUpdatePromiseToPayStatus({
    loanAccessPolicy: {
      async findAuthorizedMutationLoan() {
        return { id: 22, customerId: 7 };
      },
    },
    promiseRepository: {
      async findByIdForLoan() {
        return promise;
      },
      async save(record) {
        return record;
      },
    },
    notificationPort: {
      async sendPromiseStatus(userId, payload) {
        notificationPayload = { userId, payload };
      },
    },
  });

  const updated = await updatePromiseToPayStatus({
    actor: { id: 1, role: 'admin' },
    loanId: 22,
    promiseId: 5,
    payload: { status: 'kept', notes: 'Customer completed payment' },
  });

  assert.equal(updated.status, 'kept');
  assert.equal(updated.statusHistory.length, 1);
  assert.equal(notificationPayload.userId, 7);
});

test('createCreditsModule reuses auth and credit ports from the shared runtime', () => {
  let requestedModuleName;
  const authMiddleware = () => (req, res, next) => next();
  const loanAccessPolicy = { findAuthorizedLoan() {}, findAuthorizedMutationLoan() {}, filterVisibleLoans() {} };
  const loanViewService = { getCanonicalLoanView() { return { schedule: [], snapshot: {} }; }, getPayoffQuote() { return { total: 0, breakdown: {} }; } };

  const moduleRegistration = createCreditsModule({
    sharedRuntime: {
      authContext: {
        tokenService: { sign() {}, verify() {} },
        authMiddleware,
      },
      registerModulePorts() {},
      getModulePorts(name) {
        requestedModuleName = name;
        if (name === 'credits') {
          return { loanAccessPolicy, loanViewService };
        }
        return null;
      },
    },
  });

  assert.equal(moduleRegistration.name, 'credits');
  assert.equal(moduleRegistration.basePath, '/api/loans');
  assert.equal(requestedModuleName, undefined);
});
