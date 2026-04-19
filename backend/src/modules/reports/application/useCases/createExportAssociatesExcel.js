const { AuthorizationError } = require('@/utils/errorHandler');
const { ensureAdminOrSocio, formatMoney } = require('@/modules/reports/application/reportHelpers');

const normalizeParticipationPercentage = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value).toFixed(4);
};

const normalizeDistributionRecord = (distribution) => {
  const serializedDistribution = typeof distribution?.toJSON === 'function' ? distribution.toJSON() : distribution;

  return {
    ...serializedDistribution,
    distributionType: serializedDistribution?.distributionType || 'proportional',
    participationPercentage: normalizeParticipationPercentage(serializedDistribution?.participationPercentage),
    declaredProportionalTotal: serializedDistribution?.declaredProportionalTotal || null,
    allocatedAmount: serializedDistribution?.allocatedAmount || null,
  };
};

const formatIsoDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

/**
 * Create use case: Export Associates to Excel
 * Exports all associates with their contributions, distributions, and loan associations.
 * GET /api/reports/associates/excel
 */
const createExportAssociatesExcel = ({ associateRepository, reportRepository }) => async ({ actor }) => {
  ensureAdminOrSocio(actor, 'Only admins and socios can export associates data');

  // Admin can export all, socio can only export self
  let associateIds;
  if (actor.role === 'admin') {
    // Get all associate IDs
    const allAssociates = await associateRepository.list();
    associateIds = allAssociates.map((a) => a.id);
  } else {
    // Socio can only export their own data
    const associate = await associateRepository.findByLinkedUser(actor.id);
    if (!associate) {
      throw new AuthorizationError('Associate not found for current user');
    }
    associateIds = [associate.id];
  }

  // Build rows for each associate
  const rows = await Promise.all(
    associateIds.map(async (associateId) => {
      const [associate, contributions, distributions, loans] = await Promise.all([
        associateRepository.findById(associateId),
        associateRepository.listContributionsByAssociate(associateId),
        associateRepository.listProfitDistributionsByAssociate(associateId),
        associateRepository.listLoansByAssociate(associateId),
      ]);

      const totalContributed = contributions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalDistributed = distributions.reduce((sum, d) => sum + Number(d.amount || 0), 0);

      // Contribution rows
      const contributionRows = contributions.map((c) => ({
        associateId: associate.id,
        associateName: associate.name,
        section: 'contribution',
        entryId: c.id,
        reference: '',
        amount: formatMoney(c.amount),
        date: formatIsoDate(c.contributionDate),
        status: c.status || 'N/A',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: c.notes || '',
      }));

      // Distribution rows
      const distributionRows = distributions.map((d) => {
        const normalized = normalizeDistributionRecord(d);
        return {
          associateId: associate.id,
          associateName: associate.name,
          section: 'distribution',
          entryId: d.id,
          reference: d.loanId || '',
          amount: formatMoney(d.amount),
          date: formatIsoDate(d.distributionDate),
          status: d.status || 'N/A',
          participationPercentage: normalized.participationPercentage || normalizeParticipationPercentage(associate.participationPercentage),
          distributionType: normalized.distributionType || 'N/A',
          declaredProportionalTotal: normalized.declaredProportionalTotal || 'N/A',
          allocatedAmount: normalized.allocatedAmount || 'N/A',
          notes: d.notes || '',
        };
      });

      // Loan rows
      const loanRows = loans.map((l) => ({
        associateId: associate.id,
        associateName: associate.name,
        section: 'loan',
        entryId: l.id,
        reference: l.Customer?.name || `Customer ${l.customerId}`,
        amount: formatMoney(l.amount),
        date: formatIsoDate(l.createdAt),
        status: l.status || 'N/A',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: `Recovery: ${l.recoveryStatus || 'N/A'}`,
      }));

      // Summary row
      const summaryRow = {
        associateId: associate.id,
        associateName: associate.name,
        section: 'summary',
        entryId: '',
        reference: '',
        amount: formatMoney(totalContributed),
        date: `Distributed: ${formatMoney(totalDistributed)}`,
        status: associate.status || 'N/A',
        participationPercentage: normalizeParticipationPercentage(associate.participationPercentage),
        distributionType: '',
        declaredProportionalTotal: '',
        allocatedAmount: '',
        notes: `Contributions: ${contributions.length}, Distributions: ${distributions.length}, Loans: ${loans.length}`,
      };

      return [summaryRow, ...contributionRows, ...distributionRows, ...loanRows];
    }),
  );

  const flatRows = rows.flat();

  return {
    success: true,
    data: { rows: flatRows },
  };
};

module.exports = { createExportAssociatesExcel };
