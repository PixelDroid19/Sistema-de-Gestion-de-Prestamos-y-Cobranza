const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repositoriesModulePath = path.resolve(__dirname, '../src/modules/associates/infrastructure/repositories.js');
const { associateRepository } = require(repositoriesModulePath);
const { Associate, AssociateContribution } = require('@/models');

test('associateRepository.summarize counts only completed contributions for capital and projected interest', async (t) => {
  const originalAssociateFindAll = Associate.findAll;
  const originalContributionFindAll = AssociateContribution.findAll;

  t.after(() => {
    Associate.findAll = originalAssociateFindAll;
    AssociateContribution.findAll = originalContributionFindAll;
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

  const summary = await associateRepository.summarize();

  assert.equal(capturedContributionQuery.where.status, 'completed');
  assert.equal(summary.totalContributed, 1000);
  assert.equal(summary.monthlyInterestEstimate, 20);
});
