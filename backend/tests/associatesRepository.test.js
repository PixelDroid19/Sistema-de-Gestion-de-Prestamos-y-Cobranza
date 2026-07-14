const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Op } = require('sequelize');

const repositoriesModulePath = path.resolve(__dirname, '../src/modules/associates/infrastructure/repositories.js');
const { associateRepository } = require(repositoriesModulePath);
const { Associate, AssociateContribution, ProfitDistribution } = require('@/models');

test('associateRepository.summarize counts only completed contributions for capital and projected interest', async (t) => {
  const originalAssociateFindAll = Associate.findAll;
  const originalContributionFindAll = AssociateContribution.findAll;
  const originalDistributionFindAll = ProfitDistribution.findAll;

  t.after(() => {
    Associate.findAll = originalAssociateFindAll;
    AssociateContribution.findAll = originalContributionFindAll;
    ProfitDistribution.findAll = originalDistributionFindAll;
  });

  let capturedContributionQuery = null;

  Associate.findAll = async () => [{
    id: 12,
    status: 'active',
    interestRate: '2.0000',
    interestType: 'monthly',
  }];

  AssociateContribution.findAll = async (query) => {
    capturedContributionQuery = query;
    return [{
      associateId: 12,
      totalContributed: '1000.00',
    }];
  };

  ProfitDistribution.findAll = async () => [];

  const summary = await associateRepository.summarize();

  assert.equal(capturedContributionQuery.where.status, 'completed');
  assert.equal(summary.totalContributed, 1000);
  assert.equal(summary.monthlyInterestEstimate, 20);
});

test('associateRepository.summarize estimates monthly interest from active capital after returns', async (t) => {
  const originalAssociateFindAll = Associate.findAll;
  const originalContributionFindAll = AssociateContribution.findAll;
  const originalDistributionFindAll = ProfitDistribution.findAll;

  t.after(() => {
    Associate.findAll = originalAssociateFindAll;
    AssociateContribution.findAll = originalContributionFindAll;
    ProfitDistribution.findAll = originalDistributionFindAll;
  });

  Associate.findAll = async () => [
    { id: 12, status: 'active', interestRate: '2.0000', interestType: 'monthly' },
    { id: 13, status: 'inactive', interestRate: '12.0000', interestType: 'annual' },
  ];
  AssociateContribution.findAll = async () => [
    { associateId: 12, totalContributed: '1000.00' },
    { associateId: 13, totalContributed: '1200.00' },
  ];
  ProfitDistribution.findAll = async (query) => {
    assert.deepEqual(query.where.basis, { [Op.contains]: { type: 'capital-return' } });
    return [{ associateId: 12, totalCapitalReturned: '250.00' }];
  };

  const summary = await associateRepository.summarize();

  assert.equal(summary.totalAssociates, 2);
  assert.equal(summary.totalContributed, 2200);
  assert.equal(summary.monthlyInterestEstimate, 15);
});
