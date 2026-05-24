const { BusinessRuleViolationError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const { parsePositiveCurrencyAmount } = require('@/modules/shared/money');
const { normalizeOperationalDate, normalizeOptionalOperationalDate } = require('@/modules/shared/dateUtils');

const VALID_EXPENSE_STATUSES = new Set(['completed', 'annulled']);

const normalizeText = (value, field, { maxLength = 255 } = {}) => {
  const text = String(value || '').trim();
  if (!text) {
    throw new ValidationError(`${field} is required`);
  }

  if (text.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or less`);
  }

  return text;
};

const normalizeOptionalText = (value, field, { maxLength = 255 } = {}) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeText(value, field, { maxLength });
};

const normalizeStatusFilter = (status) => {
  if (status === undefined || status === null || status === '') {
    return null;
  }

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!VALID_EXPENSE_STATUSES.has(normalizedStatus)) {
    throw new ValidationError('status must be completed or annulled');
  }

  return normalizedStatus;
};

const assertDateRangeOrder = ({ fromDate, toDate }) => {
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new ValidationError('fromDate must be before or equal to toDate');
  }
};

const normalizeExpensePayload = (payload = {}, actor = {}) => {
  const amount = parsePositiveCurrencyAmount(payload.amount);
  if (amount === null) {
    throw new ValidationError('amount must be a valid positive currency amount');
  }

  return {
    amount,
    expenseDate: normalizeOperationalDate(payload.expenseDate, 'expenseDate'),
    category: normalizeText(payload.category, 'category'),
    description: normalizeText(payload.description, 'description', { maxLength: 500 }),
    status: 'completed',
    paymentMethod: normalizeOptionalText(payload.paymentMethod, 'paymentMethod'),
    reference: normalizeOptionalText(payload.reference, 'reference'),
    notes: normalizeOptionalText(payload.notes, 'notes', { maxLength: 2000 }),
    createdByUserId: actor?.id || null,
  };
};

const normalizeListFilters = (filters = {}) => {
  const status = normalizeStatusFilter(filters.status);
  const normalizedFilters = {
    ...(status ? { status } : {}),
    ...(filters.fromDate ? { fromDate: normalizeOptionalOperationalDate(filters.fromDate, 'fromDate') } : {}),
    ...(filters.toDate ? { toDate: normalizeOptionalOperationalDate(filters.toDate, 'toDate') } : {}),
  };
  assertDateRangeOrder(normalizedFilters);
  return normalizedFilters;
};

const createListOperatingExpenses = ({ operatingExpenseRepository }) => ({ filters = {}, pagination = {} } = {}) => (
  operatingExpenseRepository.listPage({
    filters: normalizeListFilters(filters),
    pagination,
  })
);

const createCreateOperatingExpense = ({ operatingExpenseRepository }) => async ({ actor, payload }) => {
  const normalizedPayload = normalizeExpensePayload(payload, actor);
  return operatingExpenseRepository.create(normalizedPayload);
};

const createAnnulOperatingExpense = ({ operatingExpenseRepository }) => async ({ actor, expenseId, payload = {} }) => {
  const expense = await operatingExpenseRepository.findById(expenseId);
  if (!expense) {
    throw new NotFoundError('Operating expense');
  }

  if (expense.status === 'annulled') {
    throw new BusinessRuleViolationError('Operating expense is already annulled', {
      code: 'OPERATING_EXPENSE_ALREADY_ANNULLED',
    });
  }

  const reason = normalizeText(payload.reason, 'reason', { maxLength: 1000 });
  return expense.update({
    status: 'annulled',
    annulledAt: new Date(),
    annulledByUserId: actor?.id || null,
    annulmentReason: reason,
  });
};

module.exports = {
  createListOperatingExpenses,
  createCreateOperatingExpense,
  createAnnulOperatingExpense,
  normalizeExpensePayload,
  normalizeListFilters,
};
