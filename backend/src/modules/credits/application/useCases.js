const { NotFoundError, ValidationError, AuthorizationError } = require('../../../utils/errorHandler');

/**
 * Create the use case that lists loans, optionally filtered through the shared access policy.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createListLoans = ({ loanRepository, loanAccessPolicy }) => async ({ actor }) => {
  const loans = await loanRepository.list();

  if (loanAccessPolicy) {
    return loanAccessPolicy.filterVisibleLoans({ actor, loans });
  }

  return loans;
};

/**
 * Create the use case that returns a canonical credit simulation preview.
 * @param {{ creditDomainService: object }} dependencies
 * @returns {Function}
 */
const createCreateSimulation = ({ creditDomainService }) => async (payload) => creditDomainService.simulate(payload);

/**
 * Create the use case that retrieves a single loan through the shared access policy.
 * @param {{ loanAccessPolicy?: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const createGetLoanById = ({ loanAccessPolicy, loanRepository }) => async ({ actor, loanId }) => {
  if (loanAccessPolicy) {
    return loanAccessPolicy.findAuthorizedLoan({ actor, loanId });
  }

  const loan = await loanRepository.findById(loanId);
  if (!loan) {
    throw new NotFoundError('Loan');
  }

  if (actor.role === 'customer' && loan.customerId !== actor.id) {
    throw new AuthorizationError('You can only view your own loans');
  }

  if (actor.role === 'agent' && loan.agentId !== actor.id) {
    throw new AuthorizationError('You can only view loans assigned to you');
  }

  return loan;
};

/**
 * Create the use case that persists a new loan while enforcing customer self-service boundaries.
 * @param {{ loanCreationService: object }} dependencies
 * @returns {Function}
 */
const createCreateLoan = ({ loanCreationService }) => async ({ actor, payload }) => {
  if (actor.role === 'customer' && Number(payload.customerId) !== actor.id) {
    throw new AuthorizationError('You can only create loans for your own customer record');
  }

  return loanCreationService.create(payload);
};

/**
 * Create the use case that lists loans for a customer and returns the owning customer record.
 * @param {{ customerRepository: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const createListLoansByCustomer = ({ customerRepository, loanRepository }) => async ({ actor, customerId }) => {
  if (actor.role === 'customer' && actor.id !== Number(customerId)) {
    throw new AuthorizationError('You can only view your own loans');
  }

  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError('Customer');
  }

  const loans = await loanRepository.listByCustomer(customerId);
  return { loans, customer };
};

/**
 * Create the use case that lists loans assigned to a specific agent.
 * @param {{ agentRepository: object, loanRepository: object }} dependencies
 * @returns {Function}
 */
const createListLoansByAgent = ({ agentRepository, loanRepository }) => async ({ actor, agentId }) => {
  if (actor.role === 'agent' && actor.id !== Number(agentId)) {
    throw new AuthorizationError('You can only view your own assigned loans');
  }

  const agent = await agentRepository.findById(agentId);
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  const loans = await loanRepository.listByAgent(agentId);
  return { loans, agent };
};

/**
 * Create the use case that updates the primary loan lifecycle status.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createUpdateLoanStatus = ({ loanRepository, loanAccessPolicy }) => async ({ actor, loanId, status }) => {
  const validStatuses = ['pending', 'approved', 'rejected', 'active', 'closed', 'defaulted'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const loan = loanAccessPolicy
    ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
    : await loanRepository.findById(loanId);

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  if (loan.status === 'closed' && status !== 'closed') {
    throw new ValidationError('Cannot modify a closed loan');
  }

  if (loan.status === 'rejected' && status !== 'rejected') {
    throw new ValidationError('Cannot modify a rejected loan');
  }

  loan.status = status;

  if (status === 'approved') {
    loan.startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + loan.termMonths);
    loan.endDate = endDate;
  }

  if (status === 'defaulted') {
    loan.recoveryStatus = 'pending';
  }

  return loanRepository.save(loan);
};

/**
 * Create the use case that assigns an agent to a recoverable loan and emits a notification.
 * @param {{ loanRepository: object, agentRepository: object, userRepository: object, notificationPort: object }} dependencies
 * @returns {Function}
 */
const createAssignAgent = ({ loanRepository, agentRepository, userRepository, notificationPort }) => async ({ actor, loanId, agentId }) => {
  if (actor.role !== 'admin') {
    throw new AuthorizationError('Only admins can assign agents to loans');
  }

  const loan = await loanRepository.findById(loanId);
  if (!loan) {
    throw new NotFoundError('Loan');
  }

  const agent = await agentRepository.findById(agentId);
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  if (!['approved', 'defaulted'].includes(loan.status)) {
    throw new ValidationError('Can only assign agents to approved or defaulted loans');
  }

  if (loan.agentId === agentId) {
    throw new ValidationError('This agent is already assigned to this loan');
  }

  loan.agentId = agentId;
  loan.recoveryStatus = loan.status === 'defaulted' ? 'assigned' : 'pending';
  const savedLoan = await loanRepository.save(loan);

  const user = await userRepository.findAgentUserByEmail(agent.email);
  if (user) {
    await notificationPort.sendAssignment(user.id, {
      loanId: savedLoan.id,
      loanAmount: savedLoan.amount,
      customerName: savedLoan.Customer?.name,
      customerEmail: savedLoan.Customer?.email,
      loanStatus: savedLoan.status,
      recoveryStatus: savedLoan.recoveryStatus,
      assignedBy: actor.id,
      assignedAt: new Date().toISOString(),
    });
  }

  return savedLoan;
};

/**
 * Create the use case that updates recovery state after policy and domain-guard validation.
 * @param {{ loanRepository: object, loanAccessPolicy?: object, recoveryStatusGuard?: object }} dependencies
 * @returns {Function}
 */
const createUpdateRecoveryStatus = ({ loanRepository, loanAccessPolicy, recoveryStatusGuard }) => async ({ actor, loanId, recoveryStatus }) => {
  const validRecoveryStatuses = ['pending', 'assigned', 'in_progress', 'contacted', 'negotiated', 'recovered', 'failed'];
  if (!validRecoveryStatuses.includes(recoveryStatus)) {
    throw new ValidationError(`Invalid recovery status. Must be one of: ${validRecoveryStatuses.join(', ')}`);
  }

  if (!['admin', 'agent'].includes(actor.role)) {
    throw new AuthorizationError('Only admins and agents can update recovery status');
  }

  const loan = loanAccessPolicy
    ? await loanAccessPolicy.findAuthorizedMutationLoan({ actor, loanId })
    : await loanRepository.findById(loanId);

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  if (recoveryStatusGuard) {
    recoveryStatusGuard.assertCanTransition({ loan, nextRecoveryStatus: recoveryStatus });
  }

  loan.recoveryStatus = recoveryStatus;
  return loanRepository.save(loan);
};

/**
 * Create the use case that deletes rejected loans after access checks succeed.
 * @param {{ loanRepository: object, loanAccessPolicy?: object }} dependencies
 * @returns {Function}
 */
const createDeleteLoan = ({ loanRepository, loanAccessPolicy }) => async ({ actor, loanId }) => {
  const loan = loanAccessPolicy
    ? await loanAccessPolicy.findAuthorizedLoan({ actor, loanId })
    : await loanRepository.findById(loanId);

  if (!loan) {
    throw new NotFoundError('Loan');
  }

  if (loan.status !== 'rejected') {
    throw new ValidationError('Only rejected loans can be deleted');
  }

  await loanRepository.destroy(loan);
};

module.exports = {
  createListLoans,
  createCreateSimulation,
  createGetLoanById,
  createCreateLoan,
  createListLoansByCustomer,
  createListLoansByAgent,
  createUpdateLoanStatus,
  createAssignAgent,
  createUpdateRecoveryStatus,
  createDeleteLoan,
};
