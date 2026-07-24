const { BusinessRuleViolationError, NotFoundError, ValidationError } = require('@/utils/errorHandler');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const { parsePositiveCurrencyAmount } = require('@/modules/shared/money');
const { buildDateRangeMessage, normalizeOperationalDate, normalizeOptionalOperationalDate } = require('@/modules/shared/dateUtils');
const { buildInvalidIntegerIdMessage, validateIntegerId } = require('@/modules/shared/validators');

const VALID_EXPENSE_STATUSES = new Set(['completed', 'annulled']);
const OPERATING_EXPENSE_FIELD_LABELS = {
  category: 'La categoría del gasto',
  description: 'La descripción del gasto',
  paymentMethod: 'El método de pago',
  reference: 'La referencia',
  notes: 'Las notas',
  reason: 'El motivo de anulación',
};
const OPERATING_EXPENSE_AMOUNT_MESSAGE = 'El monto del gasto debe ser un valor monetario positivo.';
const OPERATING_EXPENSE_STATUS_MESSAGE = 'El estado del gasto operativo debe ser completado o anulado.';
const OPERATING_EXPENSE_ALREADY_ANNULLED_MESSAGE = 'El gasto operativo ya está anulado.';

const getOperatingExpenseFieldLabel = (field) => OPERATING_EXPENSE_FIELD_LABELS[field] || 'El campo';
const buildRequiredTextMessage = (fieldLabel) => {
  if (fieldLabel.startsWith('Las ')) {
    return `${fieldLabel} son obligatorias.`;
  }
  if (fieldLabel.startsWith('La ')) {
    return `${fieldLabel} es obligatoria.`;
  }
  return `${fieldLabel} es obligatorio.`;
};
const buildMaxLengthTextMessage = (fieldLabel, maxLength) => {
  if (fieldLabel.startsWith('Las ')) {
    return `${fieldLabel} deben tener ${maxLength} caracteres o menos.`;
  }
  return `${fieldLabel} debe tener ${maxLength} caracteres o menos.`;
};

const normalizeText = (value, field, { maxLength = 255 } = {}) => {
  const fieldLabel = getOperatingExpenseFieldLabel(field);
  const text = String(value || '').trim();
  if (!text) {
    throw new ValidationError(buildRequiredTextMessage(fieldLabel));
  }

  if (text.length > maxLength) {
    throw new ValidationError(buildMaxLengthTextMessage(fieldLabel, maxLength));
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
    throw new ValidationError(OPERATING_EXPENSE_STATUS_MESSAGE);
  }

  return normalizedStatus;
};

const normalizeOptionalEmployeeId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (!validateIntegerId(value)) {
    throw new ValidationError(buildInvalidIntegerIdMessage('employeeId'));
  }

  return Number(String(value).trim());
};

const assertDateRangeOrder = ({ fromDate, toDate }) => {
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new ValidationError(buildDateRangeMessage('fromDate', 'toDate'));
  }
};

const normalizeExpensePayload = (payload = {}, actor = {}) => {
  const amount = parsePositiveCurrencyAmount(payload.amount);
  if (amount === null) {
    throw new ValidationError(OPERATING_EXPENSE_AMOUNT_MESSAGE);
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
  const employeeId = normalizeOptionalEmployeeId(filters.employeeId ?? filters.createdByUserId);
  const normalizedFilters = {
    ...(status ? { status } : {}),
    ...(employeeId ? { employeeId } : {}),
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

const createCreateOperatingExpense = ({ operatingExpenseRepository, auditService }) => {
  const useCase = async ({ actor, payload }) => {
    const normalizedPayload = normalizeExpensePayload(payload, actor);
    return operatingExpenseRepository.create(normalizedPayload);
  };

  if (auditService) {
    return withAudit({
      auditService,
      action: 'CREATE',
      module: 'finances',
      getEntityId: (result) => result?.id,
      getEntityType: () => 'OperatingExpense',
    })(useCase);
  }

  return useCase;
};

const createAnnulOperatingExpense = ({ operatingExpenseRepository, auditService }) => {
  const useCase = async ({ actor, expenseId, payload = {} }) => {
    const expense = await operatingExpenseRepository.findById(expenseId);
    if (!expense) {
      throw new NotFoundError('Operating expense');
    }

    if (expense.status === 'annulled') {
      throw new BusinessRuleViolationError(OPERATING_EXPENSE_ALREADY_ANNULLED_MESSAGE, {
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

  if (auditService) {
    return withAudit({
      auditService,
      action: 'UPDATE',
      module: 'finances',
      getEntityId: (params) => params?.expenseId,
      getEntityType: () => 'OperatingExpense',
    })(useCase);
  }

  return useCase;
};

module.exports = {
  createListOperatingExpenses,
  createCreateOperatingExpense,
  createAnnulOperatingExpense,
};
