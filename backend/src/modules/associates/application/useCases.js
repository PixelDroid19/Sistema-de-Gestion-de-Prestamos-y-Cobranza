
const {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} = require('@/utils/errorHandler');
const { withAudit } = require('@/modules/audit/application/auditDecorator');
const { parsePositiveCurrencyAmount, roundCurrency, formatCurrency } = require('@/modules/shared/money');
const { validateIntegerRange } = require('@/modules/shared/validators');
const {
  buildDateRangeMessage,
  normalizeOperationalDate,
  normalizeOptionalOperationalDate,
  toDateOnlyOrNull,
  toOperationalDateOrNull,
} = require('@/modules/shared/dateUtils');

const ALLOWED_ASSOCIATE_STATUSES = new Set(['active', 'inactive']);
const ALLOWED_INTEREST_TYPES = new Set(['monthly', 'annual']);
const ALLOWED_ASSOCIATE_CONTRIBUTION_STATUSES = new Set(['completed', 'pending', 'annulled', 'manual_hold']);
const DEFAULT_INTEREST_PAYMENT_DAY = 1;
const DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH = 1;
const ASSOCIATE_PAYMENT_ALERT_WINDOW_DAYS = 7;
const INACTIVE_ASSOCIATE_FINANCIAL_OPERATION_MESSAGE = 'No se pueden registrar movimientos financieros para un socio inactivo.';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ASSOCIATE_CURRENCY_FIELD_LABELS = {
  initialCapital: 'El capital inicial',
};
const ASSOCIATE_DATE_FIELD_LABELS = {
  contributionDate: 'La fecha del aporte',
  distributionDate: 'La fecha de distribución',
  capitalReturnDate: 'La fecha de devolución de capital',
  reinvestmentDate: 'La fecha de reinversión',
  paymentDate: 'La fecha de pago',
};
const REMOVED_ASSOCIATE_FIELDS = new Set([
  'participationPercentage',
  'interestStartDate',
  'interestStartsAt',
]);

const assertNoRemovedAssociateFields = (payload = {}) => {
  const removedField = Object.keys(payload).find((field) => REMOVED_ASSOCIATE_FIELDS.has(field));
  if (removedField) {
    throw new ValidationError('El contrato de socios ya no acepta campos de participación ni fechas opcionales de inicio de intereses.');
  }
};
const ASSOCIATE_FINANCIAL_DETAILS_REQUIRED_MESSAGE = 'Selecciona un socio para consultar su información financiera.';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getAssociateCurrencyFieldLabel = (fieldName) => ASSOCIATE_CURRENCY_FIELD_LABELS[fieldName] || 'El monto';
const getAssociateDateFieldLabel = (fieldName) => ASSOCIATE_DATE_FIELD_LABELS[fieldName] || 'La fecha';

const parseCurrencyAmount = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const fieldLabel = getAssociateCurrencyFieldLabel(fieldName);
  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new ValidationError(`${fieldLabel} debe ser mayor a 0 y usar máximo 2 decimales`);
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new ValidationError(`${fieldLabel} debe ser mayor a 0`);
  }

  return roundCurrency(numericValue);
};

const normalizeInterestType = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'monthly';
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (!ALLOWED_INTEREST_TYPES.has(normalizedValue)) {
    throw new ValidationError('El tipo de interés debe ser mensual o anual');
  }

  return normalizedValue;
};

const normalizeInterestRate = (value) => {
  if (value === undefined || value === null || value === '') {
    return '0.0000';
  }

  const normalizedValue = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
    throw new ValidationError('La tasa de interés debe estar entre 0 y 100 con máximo 4 decimales');
  }

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new ValidationError('La tasa de interés debe estar entre 0 y 100 con máximo 4 decimales');
  }

  return numericValue.toFixed(4);
};

const normalizeAssociateContributionStatus = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'completed';
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (!ALLOWED_ASSOCIATE_CONTRIBUTION_STATUSES.has(normalizedValue)) {
    throw new ValidationError('El estado del aporte debe ser completado, pendiente, anulado o en revisión.');
  }

  return normalizedValue;
};

const contributionCountsTowardCapital = (contribution) => String(
  contribution?.status === undefined || contribution?.status === null || contribution?.status === ''
    ? 'completed'
    : contribution.status,
).trim().toLowerCase() === 'completed';

const filterCapitalBearingContributions = (contributions = []) => (
  contributions.filter(contributionCountsTowardCapital)
);

const ensureAssociateAcceptsFinancialOperations = (associate) => {
  if (String(associate?.status || '').toLowerCase() === 'inactive') {
    throw new ValidationError(INACTIVE_ASSOCIATE_FINANCIAL_OPERATION_MESSAGE);
  }
};

const associateInterestSchedulingFieldsChanged = (associate, normalizedPayload, payload) => {
  const schedulingFields = ['interestType', 'interestRate', 'interestPaymentDay', 'interestPaymentMonth'];
  return schedulingFields.some((field) => {
    if (!hasOwn(payload, field)) {
      return false;
    }
    return String(normalizedPayload[field] ?? '') !== String(associate[field] ?? '');
  });
};

const normalizePaymentDay = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_INTEREST_PAYMENT_DAY;
  }

  if (!validateIntegerRange(value, 1, 28)) {
    throw new ValidationError('El día de pago de intereses debe ser un entero entre 1 y 28');
  }

  return Number(typeof value === 'string' ? value.trim() : value);
};

const normalizePaymentMonth = (value) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_ANNUAL_INTEREST_PAYMENT_MONTH;
  }

  if (!validateIntegerRange(value, 1, 12)) {
    throw new ValidationError('El mes de pago de intereses debe ser un entero entre 1 y 12');
  }

  return Number(typeof value === 'string' ? value.trim() : value);
};

const normalizeOptionalOperationDate = (value, fieldName) => (
  (() => {
    try {
      return value === undefined || value === null || value === ''
        ? new Date()
        : normalizeOperationalDate(value, fieldName);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(`${getAssociateDateFieldLabel(fieldName)} debe ser una fecha operativa válida`);
      }
      throw error;
    }
  })()
);

const mapValidDatedRows = (rows, getDate, mapRow) => rows
  .map((row) => {
    const date = toOperationalDateOrNull(getDate(row));
    return date ? mapRow(row, date) : null;
  })
  .filter(Boolean);

const normalizeAssociatePayload = (payload) => {
  const normalizedPayload = { ...payload };
  assertNoRemovedAssociateFields(normalizedPayload);

  if (hasOwn(payload, 'interestType')) {
    normalizedPayload.interestType = normalizeInterestType(payload.interestType);
  }

  if (hasOwn(payload, 'interestRate')) {
    normalizedPayload.interestRate = normalizeInterestRate(payload.interestRate);
  }

  if (hasOwn(payload, 'interestPaymentDay')) {
    normalizedPayload.interestPaymentDay = normalizePaymentDay(payload.interestPaymentDay);
  }

  if (hasOwn(payload, 'interestPaymentMonth')) {
    normalizedPayload.interestPaymentMonth = normalizePaymentMonth(payload.interestPaymentMonth);
  }

  delete normalizedPayload.initialCapital;

  return normalizedPayload;
};

const normalizeAssociateListFilters = (filters = {}) => {
  const normalized = {};

  const rawSearch = String(filters.search || '').trim();
  if (rawSearch) {
    normalized.search = rawSearch;
  }

  const rawStatus = String(filters.status || '').trim().toLowerCase();
  if (rawStatus) {
    if (!ALLOWED_ASSOCIATE_STATUSES.has(rawStatus)) {
      throw new ValidationError('Filtro de estado de socio inválido.');
    }
    normalized.status = rawStatus;
  }

  return normalized;
};

const buildAssociateTrackingRowSnapshot = ({ associate, contributions = [], distributions = [], installments = [], asOfDate = new Date() }) => {
  const capitalBearingContributions = filterCapitalBearingContributions(contributions);
  const capitalState = buildContributionCapitalState({ associate, contributions, distributions });
  const { capitalReturns, interestWithdrawals } = splitAssociateDistributions(distributions);
  const pendingInstallments = installments.filter((installment) => resolveAssociateInstallmentStatus(installment, asOfDate) === 'pending');
  const overdueInstallments = installments.filter((installment) => resolveAssociateInstallmentStatus(installment, asOfDate) === 'overdue');
  const paidInstallments = installments.filter((installment) => installment.status === 'paid');
  const scheduledInterestPaid = sumAmounts(paidInstallments);
  const manualInterestPaid = sumAmounts(interestWithdrawals);
  const nextInstallment = getFirstDatedInstallment([...overdueInstallments, ...pendingInstallments]);
  const lastPaidInstallment = getLastPaidInstallment(paidInstallments);

  return {
    associate,
    totalContributed: sumAmounts(capitalBearingContributions),
    currentCapital: roundCurrency(capitalState.totalCurrentCapital),
    totalCapitalReturned: capitalReturns.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    interestPending: sumAmounts(pendingInstallments),
    interestOverdue: sumAmounts(overdueInstallments),
    scheduledInterestPaid,
    manualInterestPaid,
    interestPaid: roundCurrency(scheduledInterestPaid + manualInterestPaid),
    nextPaymentDate: nextInstallment?.dueDate ? toDateOnlyOrNull(nextInstallment.dueDate) : null,
    lastPaymentDate: lastPaidInstallment?.paidAt ? toDateOnlyOrNull(lastPaidInstallment.paidAt) : null,
    pendingInstallments: pendingInstallments.length,
    overdueInstallments: overdueInstallments.length,
    paidInstallments: paidInstallments.length,
    debtStatus: overdueInstallments.length > 0 ? 'overdue' : (pendingInstallments.length > 0 ? 'pending' : 'current'),
  };
};

const hydrateAssociateListFinancialSnapshot = async ({ associateRepository, associates = [], asOfDate = new Date() }) => {
  if (!Array.isArray(associates) || associates.length === 0 || typeof associateRepository.getFinancialDatasetByAssociateIds !== 'function') {
    return associates;
  }

  const associateIds = associates
    .map((associate) => Number(associate?.id))
    .filter((associateId) => Number.isFinite(associateId));

  if (associateIds.length === 0) {
    return associates;
  }

  const dataset = await associateRepository.getFinancialDatasetByAssociateIds(associateIds);
  const contributionsByAssociate = groupRowsByAssociateId(dataset.contributions);
  const distributionsByAssociate = groupRowsByAssociateId(dataset.distributions);
  const installmentsByAssociate = groupRowsByAssociateId(dataset.installments);
  const normalizedInstallmentsByAssociate = new Map();

  for (const associate of associates) {
    const associateId = Number(associate.id);
    const installments = await persistExpiredAssociateInstallments({
      associateRepository,
      associateId,
      installments: installmentsByAssociate.get(associateId) || [],
      asOfDate,
    });
    normalizedInstallmentsByAssociate.set(associateId, installments);
  }

  return associates.map((associate) => {
    const associateId = Number(associate.id);
    const trackingRow = buildAssociateTrackingRowSnapshot({
      associate,
      contributions: contributionsByAssociate.get(associateId) || [],
      distributions: distributionsByAssociate.get(associateId) || [],
      installments: normalizedInstallmentsByAssociate.get(associateId) || [],
      asOfDate,
    });

    return {
      ...associate,
      totalContributed: trackingRow.totalContributed,
      currentCapital: trackingRow.currentCapital,
      totalCapitalReturned: roundCurrency(trackingRow.totalCapitalReturned),
      interestPending: trackingRow.interestPending,
      interestOverdue: trackingRow.interestOverdue,
      scheduledInterestPaid: trackingRow.scheduledInterestPaid,
      manualInterestPaid: trackingRow.manualInterestPaid,
      interestPaid: trackingRow.interestPaid,
      nextPaymentDate: trackingRow.nextPaymentDate,
      nextInterestPaymentDate: trackingRow.nextPaymentDate,
      lastPaymentDate: trackingRow.lastPaymentDate,
      pendingInstallments: trackingRow.pendingInstallments,
      overdueInstallments: trackingRow.overdueInstallments,
      paidInstallments: trackingRow.paidInstallments,
      debtStatus: trackingRow.debtStatus,
    };
  });
};

const normalizeAssociateRecord = (associate) => {
  const serializedAssociate = typeof associate?.toJSON === 'function' ? associate.toJSON() : associate;
  if (!serializedAssociate) {
    return serializedAssociate;
  }

  return {
    ...serializedAssociate,
    interestType: normalizeInterestType(serializedAssociate.interestType),
    interestRate: normalizeInterestRate(serializedAssociate.interestRate),
    interestPaymentDay: normalizePaymentDay(serializedAssociate.interestPaymentDay),
    interestPaymentMonth: serializedAssociate.interestPaymentMonth === null || serializedAssociate.interestPaymentMonth === undefined
      ? null
      : normalizePaymentMonth(serializedAssociate.interestPaymentMonth),
  };
};

const addMonthsUtc = (date, months) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  date.getUTCDate(),
));

const toUtcDateOnlyTimestamp = (value) => {
  const date = toOperationalDateOrNull(value);
  if (!date) {
    return null;
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const diffCalendarDaysUtc = (targetDate, baseDate) => {
  const targetTimestamp = toUtcDateOnlyTimestamp(targetDate);
  const baseTimestamp = toUtcDateOnlyTimestamp(baseDate);

  if (targetTimestamp === null || baseTimestamp === null) {
    return null;
  }

  return Math.round((targetTimestamp - baseTimestamp) / DAY_IN_MS);
};

const addYearsUtc = (date, years) => new Date(Date.UTC(
  date.getUTCFullYear() + years,
  date.getUTCMonth(),
  date.getUTCDate(),
));

const buildInterestDueDate = ({ associate, fromDate = new Date(), afterDate = null }) => {
  const interestType = normalizeInterestType(associate.interestType);
  const paymentDay = normalizePaymentDay(associate.interestPaymentDay);
  const paymentMonth = normalizePaymentMonth(associate.interestPaymentMonth);
  const baseDate = normalizeOperationalDate(afterDate || fromDate, 'interest due anchor date');
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  let dueDate = interestType === 'annual'
    ? new Date(Date.UTC(year, paymentMonth - 1, paymentDay))
    : new Date(Date.UTC(year, month, paymentDay));

  if (dueDate.getTime() <= baseDate.getTime()) {
    dueDate = interestType === 'annual' ? addYearsUtc(dueDate, 1) : addMonthsUtc(dueDate, 1);
  }

  return dueDate;
};

const buildInterestPeriod = ({ interestType, dueDate }) => {
  const periodEndDate = new Date(dueDate);
  const periodStartDate = interestType === 'annual'
    ? addYearsUtc(periodEndDate, -1)
    : addMonthsUtc(periodEndDate, -1);

  return { periodStartDate, periodEndDate };
};

const calculateInterestInstallmentAmount = ({ capitalBase, interestRate }) => roundCurrency(
  Number(capitalBase || 0) * (Number(interestRate || 0) / 100),
);

const getContributionInterestRate = ({ contribution, associate }) => normalizeInterestRate(
  contribution.interestRateSnapshot ?? associate.interestRate,
);

const getDistributionBasis = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
  return serializedDistribution?.basis && typeof serializedDistribution.basis === 'object'
    ? serializedDistribution.basis
    : {};
};

const isCapitalReturnDistribution = (distribution) => getDistributionBasis(distribution).type === 'capital-return';

const sortRowsByOperationalDateAsc = (left, right, getDate) => {
  const leftDate = toOperationalDateOrNull(getDate(left));
  const rightDate = toOperationalDateOrNull(getDate(right));
  const leftTimestamp = leftDate?.getTime() || 0;
  const rightTimestamp = rightDate?.getTime() || 0;

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return Number(left?.id || 0) - Number(right?.id || 0);
};

const amountToCents = (value) => Math.round(roundCurrency(Number(value || 0)) * 100);
const centsToAmount = (value) => roundCurrency(Number(value || 0) / 100);

const allocateCentsByWeight = ({ buckets, totalCents, getWeight }) => {
  if (!Array.isArray(buckets) || buckets.length === 0 || totalCents <= 0) {
    return [];
  }

  const weightedBuckets = buckets
    .map((bucket) => ({
      bucket,
      weight: Math.max(0, Number(getWeight(bucket) || 0)),
    }))
    .filter((entry) => entry.weight > 0);

  const totalWeight = weightedBuckets.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return [];
  }

  const baseAllocations = weightedBuckets.map((entry) => {
    const rawAllocation = (totalCents * entry.weight) / totalWeight;
    const flooredCents = Math.floor(rawAllocation);

    return {
      bucket: entry.bucket,
      cents: flooredCents,
      remainder: rawAllocation - flooredCents,
    };
  });

  const allocatedCents = baseAllocations.reduce((sum, entry) => sum + entry.cents, 0);
  let remainingCents = totalCents - allocatedCents;

  if (remainingCents > 0) {
    baseAllocations
      .sort((left, right) => {
        if (right.remainder !== left.remainder) {
          return right.remainder - left.remainder;
        }
        return Number(left.bucket?.id || 0) - Number(right.bucket?.id || 0);
      })
      .slice(0, remainingCents)
      .forEach((entry) => {
        entry.cents += 1;
      });
  }

  return baseAllocations.map((entry) => ({
    bucket: entry.bucket,
    cents: entry.cents,
  }));
};

const buildContributionCapitalState = ({ associate, contributions = [], distributions = [] }) => {
  const capitalBuckets = [...filterCapitalBearingContributions(contributions)]
    .sort((left, right) => sortRowsByOperationalDateAsc(left, right, (row) => row.contributionDate))
    .map((contribution) => {
      const originalAmountCents = amountToCents(contribution.amount);
      return {
        id: Number(contribution.id || 0),
        contributionId: contribution.id,
        contributionDate: contribution.contributionDate,
        interestRate: getContributionInterestRate({ contribution, associate }),
        interestType: normalizeInterestType(contribution.interestTypeSnapshot ?? associate.interestType),
        originalAmountCents,
        remainingAmountCents: originalAmountCents,
      };
    });

  const capitalReturnDistributions = [...distributions]
    .filter(isCapitalReturnDistribution)
    .sort((left, right) => sortRowsByOperationalDateAsc(left, right, (row) => row.distributionDate));

  let totalCapitalReturnedCents = 0;

  capitalReturnDistributions.forEach((distribution) => {
    const requestedReturnCents = amountToCents(distribution.amount);
    const totalRemainingCents = capitalBuckets.reduce((sum, bucket) => sum + bucket.remainingAmountCents, 0);
    const appliedReturnCents = Math.min(requestedReturnCents, totalRemainingCents);

    if (appliedReturnCents <= 0 || totalRemainingCents <= 0) {
      return;
    }

    const allocations = allocateCentsByWeight({
      buckets: capitalBuckets,
      totalCents: appliedReturnCents,
      getWeight: (bucket) => bucket.remainingAmountCents,
    });

    allocations.forEach(({ bucket, cents }) => {
      bucket.remainingAmountCents = Math.max(0, bucket.remainingAmountCents - cents);
    });

    totalCapitalReturnedCents += appliedReturnCents;
  });

  const totalOriginalCapitalCents = capitalBuckets.reduce((sum, bucket) => sum + bucket.originalAmountCents, 0);
  const totalCurrentCapitalCents = capitalBuckets.reduce((sum, bucket) => sum + bucket.remainingAmountCents, 0);

  return {
    buckets: capitalBuckets.map((bucket) => ({
      contributionId: bucket.contributionId,
      contributionDate: bucket.contributionDate,
      interestRate: bucket.interestRate,
      interestType: bucket.interestType,
      originalAmount: centsToAmount(bucket.originalAmountCents),
      remainingAmount: centsToAmount(bucket.remainingAmountCents),
    })),
    totalOriginalCapital: centsToAmount(totalOriginalCapitalCents),
    totalCurrentCapital: centsToAmount(totalCurrentCapitalCents),
    totalCapitalReturned: centsToAmount(totalCapitalReturnedCents),
  };
};

const buildInterestInstallmentBasis = ({
  associate,
  contributions = [],
  distributions = [],
  capitalBaseOverride = null,
}) => {
  if (capitalBaseOverride !== null) {
    const capitalBase = roundCurrency(capitalBaseOverride);
    const interestRate = normalizeInterestRate(associate.interestRate);
    const amount = calculateInterestInstallmentAmount({ capitalBase, interestRate });

    return {
      capitalBase,
      amount,
      effectiveInterestRate: interestRate,
    };
  }

  const capitalState = buildContributionCapitalState({ associate, contributions, distributions });

  const basis = capitalState.buckets.reduce((result, bucket) => {
    const contributionAmount = roundCurrency(bucket.remainingAmount);
    if (contributionAmount <= 0) {
      return result;
    }

    result.capitalBase += contributionAmount;
    result.amount += calculateInterestInstallmentAmount({
      capitalBase: contributionAmount,
      interestRate: bucket.interestRate,
    });
    return result;
  }, { capitalBase: 0, amount: 0 });

  const effectiveInterestRate = basis.capitalBase > 0
    ? ((basis.amount / basis.capitalBase) * 100).toFixed(4)
    : normalizeInterestRate(associate.interestRate);

  return {
    capitalBase: roundCurrency(basis.capitalBase),
    amount: roundCurrency(basis.amount),
    effectiveInterestRate,
  };
};

const buildInterestInstallmentPayload = ({
  associate,
  interestBasis,
  installmentNumber,
  dueDate,
}) => {
  const interestType = normalizeInterestType(associate.interestType);
  const { periodStartDate, periodEndDate } = buildInterestPeriod({ interestType, dueDate });

  return {
    installmentNumber,
    amount: interestBasis.amount,
    dueDate,
    capitalBase: interestBasis.capitalBase,
    interestRate: interestBasis.effectiveInterestRate,
    interestType,
    periodStartDate,
    periodEndDate,
    notes: 'Interés programado sobre capital aportado',
  };
};

const buildContributionTermsSnapshot = (associate) => ({
  interestTypeSnapshot: normalizeInterestType(associate.interestType),
  interestRateSnapshot: normalizeInterestRate(associate.interestRate),
});

const getNextInstallmentNumber = (installments = []) => {
  const maxInstallmentNumber = installments.reduce((max, installment) => (
    Math.max(max, Number(installment.installmentNumber || 0))
  ), 0);

  return maxInstallmentNumber + 1;
};

const isAssociateInstallmentOverdue = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'overdue') {
    return true;
  }

  if (installment?.status !== 'pending') {
    return false;
  }

  const dueDate = toOperationalDateOrNull(installment.dueDate);
  if (!dueDate) {
    return false;
  }

  return dueDate < asOfDate;
};

const resolveAssociateInstallmentStatus = (installment, asOfDate = new Date()) => {
  if (installment?.status === 'paid') {
    return 'paid';
  }

  if (installment?.status === 'overdue') {
    return 'overdue';
  }

  return isAssociateInstallmentOverdue(installment, asOfDate) ? 'overdue' : 'pending';
};

const persistExpiredAssociateInstallments = async ({ associateRepository, associateId, installments, asOfDate }) => {
  if (typeof associateRepository.updateInstallmentStatus !== 'function') {
    return installments;
  }

  await Promise.all(installments
    .filter((installment) => installment.status === 'pending' && isAssociateInstallmentOverdue(installment, asOfDate))
    .map((installment) => associateRepository.updateInstallmentStatus(
      associateId,
      installment.installmentNumber,
      'overdue',
      null,
      null,
      installment.paymentMethod || null,
      installment.notes || null,
    )));

  return installments.map((installment) => (
    installment.status === 'pending' && isAssociateInstallmentOverdue(installment, asOfDate)
      ? { ...installment, status: 'overdue' }
      : installment
  ));
};

const buildAssociatePaymentAlerts = (installments, asOfDate = new Date()) => installments
  .map((installment) => {
    const status = resolveAssociateInstallmentStatus(installment, asOfDate);
    if (!['pending', 'overdue'].includes(status)) {
      return null;
    }

    const daysUntilDue = diffCalendarDaysUtc(installment.dueDate, asOfDate);
    if (daysUntilDue === null) {
      return null;
    }

    if (status === 'overdue') {
      return {
        type: 'overdue',
        severity: 'high',
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.amount || 0),
        dueDate: installment.dueDate,
        daysUntilDue: null,
        daysOverdue: Math.abs(daysUntilDue),
      };
    }

    if (daysUntilDue <= ASSOCIATE_PAYMENT_ALERT_WINDOW_DAYS) {
      return {
        type: 'upcoming',
        severity: 'medium',
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.amount || 0),
        dueDate: installment.dueDate,
        daysUntilDue,
        daysOverdue: null,
      };
    }

    return null;
  })
  .filter(Boolean);

const ensureNextInterestInstallment = async ({
  associateRepository,
  associate,
  transaction,
  fromDate = new Date(),
  afterDate = null,
  capitalBaseOverride = null,
  excludeInstallmentNumber = null,
}) => {
  if (typeof associateRepository.createInstallment !== 'function') {
    return null;
  }

  const [contributions, distributions, rawInstallments] = await Promise.all([
    typeof associateRepository.listContributionsByAssociate === 'function'
      ? associateRepository.listContributionsByAssociate(associate.id, { transaction })
      : [],
    typeof associateRepository.listProfitDistributionsByAssociate === 'function'
      ? associateRepository.listProfitDistributionsByAssociate(associate.id, { transaction })
      : [],
    typeof associateRepository.findInstallmentsByAssociateId === 'function'
      ? associateRepository.findInstallmentsByAssociateId(associate.id, { transaction })
      : [],
  ]);

  const openInstallments = rawInstallments
    .filter((installment) => (
      ['pending', 'overdue'].includes(String(installment.status || '').toLowerCase())
        && Number(installment.installmentNumber) !== Number(excludeInstallmentNumber)
    ))
    .sort((left, right) => sortRowsByOperationalDateAsc(left, right, (row) => row.dueDate));
  const pendingInstallment = openInstallments[0] || null;

  const interestBasis = buildInterestInstallmentBasis({
    associate,
    contributions,
    distributions,
    capitalBaseOverride,
  });
  if (interestBasis.capitalBase <= 0 || interestBasis.amount <= 0) {
    if (openInstallments.length > 0 && typeof associateRepository.deleteInstallmentById === 'function') {
      await Promise.all(openInstallments.map((installment) => associateRepository.deleteInstallmentById(
        installment.id,
        { transaction },
      )));
    }
    return null;
  }

  if (pendingInstallment) {
    const dueDate = toOperationalDateOrNull(pendingInstallment.dueDate) || buildInterestDueDate({ associate, fromDate, afterDate });
    const projectionPayload = buildInterestInstallmentPayload({
      associate,
      interestBasis,
      installmentNumber: pendingInstallment.installmentNumber,
      dueDate,
    });

    if (typeof associateRepository.updateInstallmentProjection === 'function') {
      return associateRepository.updateInstallmentProjection(
        pendingInstallment.id,
        projectionPayload,
        { transaction },
      );
    }

    return {
      ...pendingInstallment,
      ...projectionPayload,
    };
  }

  const dueDate = buildInterestDueDate({ associate, fromDate, afterDate });
  const projectionPayload = buildInterestInstallmentPayload({
    associate,
    interestBasis,
    installmentNumber: getNextInstallmentNumber(rawInstallments),
    dueDate,
  });

  return associateRepository.createInstallment({
    associateId: associate.id,
    ...projectionPayload,
    status: 'pending',
  }, { transaction });
};

const normalizeDistributionRecord = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;
  const basis = getDistributionBasis(serializedDistribution);
  const normalizedDistributionType = basis.type === 'capital-return'
    ? 'capital_return'
    : (basis.type === 'reinvestment'
      ? 'reinvestment'
      : 'manual');

  return {
    ...serializedDistribution,
    distributionType: normalizedDistributionType,
    allocatedAmount: formatCurrency(serializedDistribution.amount),
    basis,
  };
};

const splitAssociateDistributions = (distributions = []) => {
  const normalizedDistributions = distributions.map(normalizeDistributionRecord);
  return {
    normalizedDistributions,
    capitalReturns: normalizedDistributions.filter((distribution) => distribution.distributionType === 'capital_return'),
    reinvestments: normalizedDistributions.filter((distribution) => distribution.distributionType === 'reinvestment'),
    interestWithdrawals: normalizedDistributions.filter((distribution) => (
      !['capital_return', 'reinvestment'].includes(distribution.distributionType)
    )),
  };
};

const buildAssociateConflictError = ({ existingAssociate, email, phone }) => {
  const error = new ValidationError('Ya existe un socio con esos datos de contacto.');
  error.errors = [];

  if (email && existingAssociate.email === email) {
    error.errors.push({ field: 'email', message: 'Ya existe un socio con ese correo.' });
  }

  if (phone && existingAssociate.phone === phone) {
    error.errors.push({ field: 'phone', message: 'Ya existe un socio con ese teléfono.' });
  }

  return error;
};

const ensureUniqueAssociateContact = async ({ associateRepository, email, phone, excludeId = null }) => {
  if (!email && !phone) {
    return;
  }

  const existingAssociate = await associateRepository.findConflictingContact({ email, phone, excludeId });

  if (existingAssociate) {
    throw buildAssociateConflictError({ existingAssociate, email, phone });
  }
};

/**
 * Create the use case that lists associates in repository-defined order.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createListAssociates = ({ associateRepository }) => async ({ pagination, filters } = {}) => {
  const normalizedFilters = normalizeAssociateListFilters(filters);
  const summary = typeof associateRepository.summarize === 'function'
    ? await associateRepository.summarize(normalizedFilters)
    : undefined;

  if (pagination) {
    const result = await associateRepository.listPage({ ...pagination, filters: normalizedFilters });
    const normalizedItems = result.items.map(normalizeAssociateRecord);
    const items = await hydrateAssociateListFinancialSnapshot({
      associateRepository,
      associates: normalizedItems,
    });
    const response = {
      items,
      pagination: result.pagination,
    };
    if (summary) {
      response.summary = summary;
    }
    return response;
  }

  const associates = await associateRepository.list(normalizedFilters);
  const normalizedItems = associates.map(normalizeAssociateRecord);
  const items = await hydrateAssociateListFinancialSnapshot({
    associateRepository,
    associates: normalizedItems,
  });
  return summary ? { items, summary } : items;
};

/**
 * Create the use case that validates unique associate contact details before creation.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createCreateAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, payload }) => {
    const normalizedPayload = normalizeAssociatePayload(payload);
    const initialCapital = parseCurrencyAmount(payload.initialCapital, 'initialCapital');

    await ensureUniqueAssociateContact({
      associateRepository,
      email: normalizedPayload.email,
      phone: normalizedPayload.phone,
    });

    const createAssociateWithFinancialTrace = async (transaction) => {
      const associate = await associateRepository.create(normalizedPayload, { transaction });
      if (initialCapital !== null) {
        const operationDate = new Date();
        await associateRepository.createContribution({
          associateId: associate.id,
          amount: initialCapital,
          contributionDate: operationDate,
          ...buildContributionTermsSnapshot(associate),
          createdByUserId: actor?.id || null,
          notes: 'Capital inicial registrado al crear el socio',
        }, { transaction });

        await ensureNextInterestInstallment({
          associateRepository,
          associate,
          transaction,
          fromDate: operationDate,
          capitalBaseOverride: initialCapital,
        });
      }

      return associate;
    };

    const associate = initialCapital !== null && typeof associateRepository.runInTransaction === 'function'
      ? await associateRepository.runInTransaction(createAssociateWithFinancialTrace)
      : await createAssociateWithFinancialTrace();

    return normalizeAssociateRecord(associate);
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.id, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that retrieves a single associate by identifier.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateById = ({ associateRepository }) => async (associateId) => {
  const associate = await associateRepository.findById(associateId);
  if (!associate) {
    throw new NotFoundError('Associate');
  }

  return normalizeAssociateRecord(associate);
};

/**
 * Create the use case that updates an associate while preserving unique contact data.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createUpdateAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ associateId, payload }) => {
    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    const normalizedPayload = normalizeAssociatePayload(payload);

    await ensureUniqueAssociateContact({
      associateRepository,
      email: normalizedPayload.email,
      phone: normalizedPayload.phone,
      excludeId: associate.id,
    });

    const shouldReprojectInterestInstallments = associateInterestSchedulingFieldsChanged(
      associate,
      normalizedPayload,
      payload,
    );
    const updatedAssociate = normalizeAssociateRecord(
      await associateRepository.update(associate, normalizedPayload),
    );

    if (shouldReprojectInterestInstallments) {
      await ensureNextInterestInstallment({
        associateRepository,
        associate: updatedAssociate,
        fromDate: new Date(),
      });
    }

    return updatedAssociate;
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that deactivates an associate while preserving financial history.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createDeleteAssociate = ({ associateRepository, auditService }) => {
  const useCase = async ({ associateId }) => {
    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    return normalizeAssociateRecord(await associateRepository.update(associate, { status: 'inactive' }));
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'Associate' })(useCase);
  }
  return useCase;
};

/**
 * Ensure an administrative actor can inspect a specific associate's financial details.
 * Socios are investor records in this backoffice and are not authenticated portal users.
 * @param {{ actor: { role: string }, associateRepository: object, associateId?: number|string|null }} params
 * @returns {Promise<object>} Associate record authorized for the request.
 * @throws {AuthorizationError|ValidationError|NotFoundError}
 */
const ensureAssociateFinancialDetailsAccess = async ({ actor, associateRepository, associateId = null }) => {
  if (actor.role !== 'admin' && actor.role !== 'employee') {
    throw new AuthorizationError('Solo usuarios administrativos autorizados pueden consultar información financiera de socios.');
  }

  if (actor.role === 'admin' || actor.role === 'employee') {
    if (!associateId) {
      throw new ValidationError(ASSOCIATE_FINANCIAL_DETAILS_REQUIRED_MESSAGE);
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }

    return associate;
  }
};

/**
 * Build the administrative associate financial-details read model.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createListAssociateFinancialDetails = ({ associateRepository }) => async ({ actor, associateId }) => {
  const associate = await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });
  const [contributions, distributions, rawInstallments] = await Promise.all([
    associateRepository.listContributionsByAssociate(associate.id),
    associateRepository.listProfitDistributionsByAssociate(associate.id),
    associateRepository.findInstallmentsByAssociateId(associate.id),
  ]);
  const installments = await persistExpiredAssociateInstallments({
    associateRepository,
    associateId: associate.id,
    installments: rawInstallments,
    asOfDate: new Date(),
  });

  const capitalState = buildContributionCapitalState({ associate, contributions, distributions });
  const {
    normalizedDistributions,
    capitalReturns,
    interestWithdrawals,
  } = splitAssociateDistributions(distributions);
  const capitalBearingContributions = filterCapitalBearingContributions(contributions);
  const totalContributed = capitalBearingContributions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalCapitalReturned = capitalReturns.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalManualInterestPaid = interestWithdrawals.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalScheduledInterestPaid = installments
    .filter((installment) => installment.status === 'paid')
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const totalInterestPaid = roundCurrency(totalScheduledInterestPaid + totalManualInterestPaid);
  const interestDebt = installments
    .filter((installment) => ['pending', 'overdue'].includes(installment.status))
    .reduce((sum, installment) => sum + Number(installment.amount || 0), 0);
  const nextInterestPayment = installments
    .filter((installment) => ['pending', 'overdue'].includes(installment.status))
    .map((installment) => ({ installment, dateOnly: toDateOnlyOrNull(installment.dueDate) }))
    .filter((entry) => entry.dateOnly)
    .sort((left, right) => normalizeOperationalDate(left.dateOnly).getTime() - normalizeOperationalDate(right.dateOnly).getTime())[0]?.installment || null;
  const paymentHistory = [
    ...installments
      .filter((installment) => installment.status === 'paid')
      .map((installment) => mapAssociateInterestPayment({
        payment: installment,
        associate,
        paymentType: 'scheduled',
      })),
    ...interestWithdrawals.map((distribution) => mapAssociateInterestPayment({
      payment: distribution,
      associate,
      paymentType: 'manual',
    })),
    ...capitalReturns.map((distribution) => mapAssociateInterestPayment({
      payment: distribution,
      associate,
      paymentType: 'capital_return',
    })),
  ].sort((left, right) => {
    const rightDate = toOperationalDateOrNull(right.paidAt || right.dueDate);
    const leftDate = toOperationalDateOrNull(left.paidAt || left.dueDate);
    return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
  });

  const capitalReturnHistory = capitalReturns
    .sort((left, right) => sortRowsByOperationalDateAsc(right, left, (row) => row.distributionDate))
    .map((distribution) => ({
      id: distribution.id,
      amount: roundCurrency(distribution.amount),
      distributionDate: distribution.distributionDate,
      createdBy: distribution.createdBy || null,
      notes: distribution.notes || null,
    }));

  return {
    associate: normalizeAssociateRecord(associate),
    summary: {
      totalContributed: roundCurrency(totalContributed),
      currentCapital: roundCurrency(capitalState.totalCurrentCapital),
      totalCapitalReturned: roundCurrency(totalCapitalReturned),
      totalInterestWithdrawn: roundCurrency(totalManualInterestPaid),
      scheduledInterestPaid: roundCurrency(totalScheduledInterestPaid),
      manualInterestPaid: roundCurrency(totalManualInterestPaid),
      totalInterestPaid,
      interestDebt: roundCurrency(interestDebt),
      nextInterestPaymentDate: nextInterestPayment?.dueDate ? toDateOnlyOrNull(nextInterestPayment.dueDate) : null,
      debtStatus: installments.some((installment) => installment.status === 'overdue')
        ? 'overdue'
        : (interestDebt > 0 ? 'pending' : 'up_to_date'),
    },
    contributions,
    distributions: normalizedDistributions,
    capitalReturns: capitalReturnHistory,
    paymentHistory,
  };
};

const groupRowsByAssociateId = (rows = []) => rows.reduce((groups, row) => {
  const associateId = Number(row.associateId);
  if (!Number.isFinite(associateId)) {
    return groups;
  }

  const currentRows = groups.get(associateId) || [];
  currentRows.push(row);
  groups.set(associateId, currentRows);
  return groups;
}, new Map());

const sumAmounts = (rows = []) => roundCurrency(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));

const getFirstDatedInstallment = (installments = []) => installments
  .map((installment) => ({ installment, dateOnly: toDateOnlyOrNull(installment.dueDate) }))
  .filter((entry) => entry.dateOnly)
  .sort((left, right) => normalizeOperationalDate(left.dateOnly).getTime() - normalizeOperationalDate(right.dateOnly).getTime())[0]?.installment || null;

const getLastPaidInstallment = (installments = []) => installments
  .filter((installment) => installment.status === 'paid')
  .sort((left, right) => {
    const rightDate = toOperationalDateOrNull(right.paidAt || right.updatedAt);
    const leftDate = toOperationalDateOrNull(left.paidAt || left.updatedAt);
    return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
  })[0] || null;

const mapTrackingObligation = (installment, associate) => ({
  id: installment.id,
  associateId: installment.associateId,
  associateName: associate?.name || null,
  installmentNumber: installment.installmentNumber,
  amount: roundCurrency(installment.amount),
  dueDate: installment.dueDate,
  periodStartDate: installment.periodStartDate,
  periodEndDate: installment.periodEndDate,
  capitalBase: installment.capitalBase === null || installment.capitalBase === undefined
    ? null
    : roundCurrency(installment.capitalBase),
  interestRate: installment.interestRate,
  interestType: installment.interestType,
  status: installment.status,
  paidAt: installment.paidAt,
  paidByUser: installment.paidByUser || null,
  paymentMethod: installment.paymentMethod || null,
});

const getInterestPaymentDisplayType = (payment) => {
  if (payment?.paymentType === 'capital_return') {
    return 'Devolución de capital';
  }

  if (payment?.paymentType === 'manual') {
    return 'Pago manual de rentabilidad';
  }

  const installmentNumber = Number(payment?.installmentNumber || 0);
  return installmentNumber > 0
    ? `Pago programado #${installmentNumber}`
    : 'Pago de interés';
};

const mapAssociateInterestPayment = ({ payment, associate, paymentType }) => {
  if (paymentType === 'manual' || paymentType === 'capital_return') {
    return {
      id: payment.id,
      associateId: payment.associateId,
      associateName: associate?.name || null,
      installmentNumber: null,
      displayType: getInterestPaymentDisplayType({ ...payment, paymentType }),
      paymentType,
      amount: roundCurrency(payment.amount),
      dueDate: null,
      paidAt: payment.distributionDate,
      paidByUser: payment.createdBy || null,
      paymentMethod: null,
      notes: payment.notes || null,
    };
  }

  return {
    id: payment.id,
    associateId: payment.associateId,
    associateName: associate?.name || null,
    installmentNumber: payment.installmentNumber,
    displayType: getInterestPaymentDisplayType({
      paymentType,
      installmentNumber: payment.installmentNumber,
    }),
    paymentType,
    amount: roundCurrency(payment.amount),
    dueDate: payment.dueDate,
    paidAt: payment.paidAt,
    paidByUser: payment.paidByUser || null,
    paymentMethod: payment.paymentMethod || null,
    notes: payment.notes || null,
  };
};

const serializeInstallmentRecord = (installment) => (
  typeof installment?.toJSON === 'function' ? installment.toJSON() : installment
);

/**
 * Build the aggregate investor-associate tracking read model.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateTracking = ({ associateRepository, clock = () => new Date() }) => async ({ actor, filters } = {}) => {
  if (!actor || !['admin', 'employee'].includes(actor.role)) {
    throw new AuthorizationError('Solo usuarios administrativos autorizados pueden consultar seguimiento financiero de socios.');
  }

  const normalizedFilters = normalizeAssociateListFilters(filters);
  const dataset = await associateRepository.getTrackingDataset(normalizedFilters);
  const asOfDate = clock();
  const contributionsByAssociate = groupRowsByAssociateId(dataset.contributions);
  const distributionsByAssociate = groupRowsByAssociateId(dataset.distributions);
  const installmentsByAssociate = groupRowsByAssociateId(dataset.installments);
  const normalizedAssociates = dataset.associates.map(normalizeAssociateRecord);
  const associateById = new Map(normalizedAssociates.map((associate) => [Number(associate.id), associate]));

  const normalizedInstallments = [];
  for (const associate of normalizedAssociates) {
    const associateId = Number(associate.id);
    const rawInstallments = installmentsByAssociate.get(associateId) || [];
    const installments = await persistExpiredAssociateInstallments({
      associateRepository,
      associateId,
      installments: rawInstallments,
      asOfDate,
    });
    normalizedInstallments.push(...installments);
    installmentsByAssociate.set(associateId, installments);
  }

  const associateRows = normalizedAssociates.map((associate) => {
    const associateId = Number(associate.id);
    return buildAssociateTrackingRowSnapshot({
      associate,
      contributions: contributionsByAssociate.get(associateId) || [],
      distributions: distributionsByAssociate.get(associateId) || [],
      installments: installmentsByAssociate.get(associateId) || [],
      asOfDate,
    });
  });

  const openObligations = normalizedInstallments
    .map((installment) => ({
      installment,
      status: resolveAssociateInstallmentStatus(installment, asOfDate),
    }))
    .filter(({ status }) => ['pending', 'overdue'].includes(status))
    .map(({ installment, status }) => mapTrackingObligation(
      { ...serializeInstallmentRecord(installment), status },
      associateById.get(Number(installment.associateId)),
    ))
    .sort((left, right) => {
      const leftDate = toOperationalDateOrNull(left.dueDate);
      const rightDate = toOperationalDateOrNull(right.dueDate);
      return (leftDate?.getTime() || 0) - (rightDate?.getTime() || 0);
    });

  const recentPayments = [
    ...normalizedInstallments
      .filter((installment) => installment.status === 'paid')
      .map((installment) => mapAssociateInterestPayment({
        payment: installment,
        associate: associateById.get(Number(installment.associateId)),
        paymentType: 'scheduled',
      })),
    ...dataset.distributions
      .map(normalizeDistributionRecord)
      .filter((distribution) => !['reinvestment', 'capital_return'].includes(distribution.distributionType))
      .map((distribution) => mapAssociateInterestPayment({
        payment: distribution,
        associate: associateById.get(Number(distribution.associateId)),
        paymentType: 'manual',
      })),
  ].sort((left, right) => {
    const rightDate = toOperationalDateOrNull(right.paidAt || right.dueDate);
    const leftDate = toOperationalDateOrNull(left.paidAt || left.dueDate);
    return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
  }).slice(0, 12);

  const recentContributions = dataset.contributions
    .map((contribution) => ({
      id: contribution.id,
      associateId: contribution.associateId,
      associateName: associateById.get(Number(contribution.associateId))?.name || null,
      amount: roundCurrency(contribution.amount),
      contributionDate: contribution.contributionDate,
      status: normalizeAssociateContributionStatus(contribution.status),
      createdBy: contribution.createdBy || null,
      notes: contribution.notes || null,
    }))
    .sort((left, right) => {
      const rightDate = toOperationalDateOrNull(right.contributionDate);
      const leftDate = toOperationalDateOrNull(left.contributionDate);
      return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
    })
    .slice(0, 12);

  const recentCapitalReturns = dataset.distributions
    .map(normalizeDistributionRecord)
    .filter((distribution) => distribution.distributionType === 'capital_return')
    .map((distribution) => ({
      id: distribution.id,
      associateId: distribution.associateId,
      associateName: associateById.get(Number(distribution.associateId))?.name || null,
      amount: roundCurrency(distribution.amount),
      distributionDate: distribution.distributionDate,
      createdBy: distribution.createdBy || null,
      notes: distribution.notes || null,
    }))
    .sort((left, right) => {
      const rightDate = toOperationalDateOrNull(right.distributionDate);
      const leftDate = toOperationalDateOrNull(left.distributionDate);
      return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
    })
    .slice(0, 12);

  const summary = associateRows.reduce((result, row) => {
    result.totalAssociates += 1;
    result.activeAssociates += row.associate.status === 'active' ? 1 : 0;
    result.totalCapital += row.currentCapital;
    result.totalCapitalReturned += row.totalCapitalReturned;
    result.interestPending += row.interestPending;
    result.interestOverdue += row.interestOverdue;
    result.interestPaid += row.interestPaid;
    result.upcomingObligations += row.pendingInstallments;
    result.overdueObligations += row.overdueInstallments;
    return result;
  }, {
    totalAssociates: 0,
    activeAssociates: 0,
    totalCapital: 0,
    totalCapitalReturned: 0,
    interestPending: 0,
    interestOverdue: 0,
    interestPaid: 0,
    upcomingObligations: 0,
    overdueObligations: 0,
  });

  return {
    summary: {
      ...summary,
      totalCapital: roundCurrency(summary.totalCapital),
      totalCapitalReturned: roundCurrency(summary.totalCapitalReturned),
      interestPending: roundCurrency(summary.interestPending),
      interestOverdue: roundCurrency(summary.interestOverdue),
      interestPaid: roundCurrency(summary.interestPaid),
      totalPayable: roundCurrency(summary.interestPending + summary.interestOverdue),
    },
    associates: associateRows,
    obligations: openObligations,
    recentPayments,
    recentContributions,
    recentCapitalReturns,
  };
};

const createCreateAssociateContribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    assertNoRemovedAssociateFields(payload);
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar aportes de socios.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
    ensureAssociateAcceptsFinancialOperations(associate);

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto del aporte debe ser mayor a 0');
    }

    const contributionPayload = {
      associateId: associate.id,
      amount,
      contributionDate: normalizeOptionalOperationDate(payload.contributionDate, 'contributionDate'),
      status: normalizeAssociateContributionStatus(payload.status),
      ...buildContributionTermsSnapshot(associate),
      createdByUserId: actor.id,
      notes: payload.notes ? String(payload.notes).trim() : null,
    };

    const createContributionWithProjection = async (transaction) => {
      const contribution = await associateRepository.createContribution(contributionPayload, { transaction });

      await ensureNextInterestInstallment({
        associateRepository,
        associate,
        transaction,
        fromDate: contribution.contributionDate || contributionPayload.contributionDate || new Date(),
      });

      return contribution;
    };

    return typeof associateRepository.runInTransaction === 'function'
      ? associateRepository.runInTransaction(createContributionWithProjection)
      : createContributionWithProjection();
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateContribution' })(useCase);
  }
  return useCase;
};

const createCreateProfitDistribution = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    assertNoRemovedAssociateFields(payload);
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar distribuciones de utilidades.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
    ensureAssociateAcceptsFinancialOperations(associate);

    if (hasOwn(payload || {}, 'basis')) {
      throw new ValidationError('El contrato de socios no acepta tipos de movimiento definidos por el cliente.');
    }

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto de la distribución debe ser mayor a 0');
    }

    return associateRepository.createProfitDistribution({
      associateId: associate.id,
      loanId: null,
      amount,
      distributionDate: normalizeOptionalOperationDate(payload.distributionDate, 'distributionDate'),
      createdByUserId: actor.id,
      notes: payload.notes ? String(payload.notes).trim() : null,
      basis: { type: 'manual' },
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'ProfitDistribution' })(useCase);
  }
  return useCase;
};

const createCreateAssociateCapitalReturn = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    assertNoRemovedAssociateFields(payload);
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar devoluciones de capital.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
    ensureAssociateAcceptsFinancialOperations(associate);

    if (hasOwn(payload || {}, 'distributionDate')) {
      throw new ValidationError('El contrato de socios no acepta distributionDate para devoluciones de capital.');
    }

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto de la devolución de capital debe ser mayor a 0');
    }

    const operationDate = normalizeOptionalOperationDate(payload.capitalReturnDate, 'capitalReturnDate');
    const notes = payload.notes ? String(payload.notes).trim() : null;

    return associateRepository.runInTransaction(async (transaction) => {
      const [contributions, distributions] = await Promise.all([
        associateRepository.listContributionsByAssociate(associate.id, { transaction }),
        associateRepository.listProfitDistributionsByAssociate(associate.id, { transaction }),
      ]);

      const capitalState = buildContributionCapitalState({ associate, contributions, distributions });
      const currentCapital = roundCurrency(capitalState.totalCurrentCapital);

      if (currentCapital <= 0) {
        throw new ValidationError('El socio no tiene capital vigente para devolver.');
      }

      if (amount > currentCapital) {
        throw new ValidationError('La devolución de capital no puede superar el capital vigente del socio.');
      }

      const distribution = await associateRepository.createProfitDistribution({
        associateId: associate.id,
        loanId: null,
        amount,
        distributionDate: operationDate,
        createdByUserId: actor.id,
        notes,
        basis: {
          type: 'capital-return',
          capitalReturn: true,
          direction: 'distribution',
          previousCapitalBase: formatCurrency(currentCapital),
        },
      }, { transaction });

      await ensureNextInterestInstallment({
        associateRepository,
        associate,
        transaction,
        fromDate: operationDate,
      });

      return {
        associate: normalizeAssociateRecord(associate),
        capitalReturn: normalizeDistributionRecord(distribution),
        summary: {
          previousCurrentCapital: currentCapital,
          currentCapital: roundCurrency(currentCapital - amount),
        },
      };
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateCapitalReturn' })(useCase);
  }
  return useCase;
};

const createCreateAssociateReinvestment = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, payload }) => {
    assertNoRemovedAssociateFields(payload);
    if (!['admin', 'employee'].includes(actor.role)) {
      throw new AuthorizationError('Solo usuarios administrativos autorizados pueden registrar reinversiones de socios.');
    }

    const associate = await associateRepository.findById(associateId);
    if (!associate) {
      throw new NotFoundError('Associate');
    }
    ensureAssociateAcceptsFinancialOperations(associate);

    const amount = parsePositiveCurrencyAmount(payload.amount);
    if (amount === null) {
      throw new ValidationError('El monto de la reinversión debe ser mayor a 0');
    }

    const operationDate = normalizeOptionalOperationDate(payload.reinvestmentDate, 'reinvestmentDate');

    return associateRepository.runInTransaction(async (transaction) => {
      const note = payload.notes ? String(payload.notes).trim() : null;
      const distribution = await associateRepository.createProfitDistribution({
        associateId: associate.id,
        loanId: null,
        amount,
        distributionDate: operationDate,
        createdByUserId: actor.id,
        notes: note,
        basis: {
          type: 'reinvestment',
          reinvestment: true,
          direction: 'distribution',
        },
      }, { transaction });

      const contribution = await associateRepository.createContribution({
        associateId: associate.id,
        amount,
        contributionDate: operationDate,
        ...buildContributionTermsSnapshot(associate),
        createdByUserId: actor.id,
        notes: note,
      }, { transaction });

      await ensureNextInterestInstallment({
        associateRepository,
        associate,
        transaction,
        fromDate: operationDate,
      });

      return {
        associate: normalizeAssociateRecord(associate),
        reinvestment: {
          amount: formatCurrency(amount),
          reinvestmentDate: operationDate.toISOString(),
          notes: note,
        },
        distribution: normalizeDistributionRecord(distribution),
        contribution,
      };
    });
  };

  if (auditService) {
    return withAudit({ auditService, action: 'CREATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateReinvestment' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that lists scheduled interest installments for an associate.
 * @param {{ associateRepository: object, clock?: Function }} dependencies
 * @returns {Function}
 */
const createGetAssociateInstallments = ({ associateRepository, clock = () => new Date() }) => async ({ actor, associateId }) => {
  await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });

  const rawInstallments = await associateRepository.findInstallmentsByAssociateId(associateId);
  const asOfDate = clock();
  const installments = await persistExpiredAssociateInstallments({
    associateRepository,
    associateId,
    installments: rawInstallments,
    asOfDate,
  });

  const totalPending = installments
    .filter((i) => resolveAssociateInstallmentStatus(i, asOfDate) === 'pending')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalPaid = installments
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  const totalOverdue = installments
    .filter((i) => resolveAssociateInstallmentStatus(i, asOfDate) === 'overdue')
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return {
    associateId,
    installments: installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      amount: Number(i.amount),
      dueDate: i.dueDate,
      status: resolveAssociateInstallmentStatus(i, asOfDate),
      paidAt: i.paidAt,
      paidBy: i.paidBy,
      paidByUser: i.paidByUser,
    })),
    totals: {
      totalPending: roundCurrency(totalPending),
      totalPaid: roundCurrency(totalPaid),
      totalOverdue: roundCurrency(totalOverdue),
    },
    alerts: buildAssociatePaymentAlerts(installments, asOfDate),
  };
};

/**
 * Create the use case that marks an installment as paid.
 * @param {{ associateRepository: object, auditService?: object }} dependencies
 * @returns {Function}
 */
const createPayAssociateInstallment = ({ associateRepository, auditService }) => {
  const useCase = async ({ actor, associateId, installmentNumber, payload }) => {
    assertNoRemovedAssociateFields(payload);
    const associate = await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });
    ensureAssociateAcceptsFinancialOperations(associate);

    const installments = await associateRepository.findInstallmentsByAssociateId(associateId);
    const installment = installments.find(
      (i) => Number(i.installmentNumber) === Number(installmentNumber),
    );

    if (!installment) {
      throw new NotFoundError('Installment');
    }

    if (installment.status === 'paid') {
      throw new ValidationError('La cuota del socio ya fue pagada');
    }

    if (payload && hasOwn(payload, 'notes')) {
      throw new ValidationError('El pago de interés programado solo acepta fecha real de pago y método de pago.');
    }

    if (payload?.paymentDate === undefined || payload?.paymentDate === null || payload?.paymentDate === '') {
      throw new ValidationError('La fecha real de pago es obligatoria');
    }

    const paymentDate = normalizeOptionalOperationDate(payload.paymentDate, 'paymentDate');
    const paymentMethod = payload?.paymentMethod === undefined || payload?.paymentMethod === null
      ? ''
      : String(payload.paymentMethod).trim();
    if (!paymentMethod) {
      throw new ValidationError('El método de pago es obligatorio');
    }

    const paidBy = actor.id;

    await associateRepository.updateInstallmentStatus(
      associateId,
      installmentNumber,
      'paid',
      paymentDate,
      paidBy,
      paymentMethod,
      null,
    );

    await ensureNextInterestInstallment({
      associateRepository,
      associate,
      afterDate: installment.dueDate,
      excludeInstallmentNumber: installmentNumber,
    });

    const updatedInstallment = {
      ...installment.toJSON(),
      status: 'paid',
      paidAt: paymentDate,
      paidBy,
      paymentMethod,
    };

    return {
      success: true,
      installment: {
        id: updatedInstallment.id,
        installmentNumber: updatedInstallment.installmentNumber,
        amount: Number(updatedInstallment.amount),
        dueDate: updatedInstallment.dueDate,
        status: updatedInstallment.status,
        paidAt: updatedInstallment.paidAt,
        paidBy: updatedInstallment.paidBy,
        paymentMethod: updatedInstallment.paymentMethod,
      },
    };
  };

  if (auditService) {
    return withAudit({ auditService, action: 'UPDATE', module: 'associates', getEntityId: (p) => p?.associateId, getEntityType: () => 'AssociateInstallment' })(useCase);
  }
  return useCase;
};

/**
 * Create the use case that retrieves calendar events for an associate.
 * @param {{ associateRepository: object }} dependencies
 * @returns {Function}
 */
const createGetAssociateCalendar = ({ associateRepository }) => async ({ actor, associateId, startDate, endDate }) => {
  await ensureAssociateFinancialDetailsAccess({ actor, associateRepository, associateId });

  const normalizedStartDate = normalizeOptionalOperationalDate(startDate, 'startDate');
  const normalizedEndDate = normalizeOptionalOperationalDate(endDate, 'endDate');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate.getTime() > normalizedEndDate.getTime()) {
    throw new ValidationError(buildDateRangeMessage('startDate', 'endDate'));
  }

  const events = await associateRepository.findCalendarEvents(associateId, normalizedStartDate, normalizedEndDate);

  const allEvents = [
    ...mapValidDatedRows(events.contributions, (c) => c.date, (c, date) => ({
      ...c,
      date,
      displayType: 'Aporte',
      displayAmount: `+${c.amount.toFixed(2)}`,
    })),
    ...mapValidDatedRows(events.distributions, (d) => d.date, (d, date) => ({
      ...d,
      date,
      displayType: d.displayType || 'Pago manual de rentabilidad',
      displayAmount: `-${d.amount.toFixed(2)}`,
    })),
    ...mapValidDatedRows(events.installments, (i) => i.dueDate, (i, date) => ({
      ...i,
      date,
      displayType: 'Cuota',
      displayAmount: i.status === 'paid' ? `✓ ${i.amount.toFixed(2)}` : i.amount.toFixed(2),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    associateId,
    startDate: toDateOnlyOrNull(normalizedStartDate),
    endDate: toDateOnlyOrNull(normalizedEndDate),
    events: allEvents,
    summary: {
      contributionCount: events.contributions.length,
      distributionCount: events.distributions.length,
      installmentCount: events.installments.length,
      pendingInstallments: events.installments.filter((installment) => (
        ['pending', 'overdue'].includes(String(installment.status || '').toLowerCase())
      )).length,
    },
  };
};

module.exports = {
  normalizeDistributionRecord,
  normalizeAssociateRecord,
  filterCapitalBearingContributions,
  createListAssociates,
  createCreateAssociate,
  createGetAssociateById,
  createUpdateAssociate,
  createDeleteAssociate,
  createListAssociateFinancialDetails,
  createGetAssociateTracking,
  createCreateAssociateContribution,
  createCreateProfitDistribution,
  createCreateAssociateCapitalReturn,
  createCreateAssociateReinvestment,
  createGetAssociateInstallments,
  createPayAssociateInstallment,
  createGetAssociateCalendar,
};
