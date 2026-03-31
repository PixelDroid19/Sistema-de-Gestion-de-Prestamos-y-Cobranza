const { paymentValidation } = require('../../middleware/validation');
const { createModule, resolveAuthContext } = require('../shared');
const { createCreditsPublicPorts } = require('../credits/public');
const { createAttachmentUpload } = require('../credits/presentation/attachmentUpload');
const {
  createListPayments,
  createCreatePayment,
  createCreatePartialPayment,
  createCreateCapitalPayment,
  createAnnulInstallment,
  createUpdatePaymentMetadata,
  createListPaymentsByLoan,
  createListPaymentDocuments,
  createUploadPaymentDocument,
  createDownloadPaymentDocument,
  createGetPaymentVoucher,
} = require('./application/useCases');
const { paymentRepository } = require('./infrastructure/repositories');
const { createPayoutsRouter } = require('./presentation/router');

/**
 * Compose the payouts module entrypoint from payment and loan public seams.
 */
const createPayoutsModule = ({ sharedRuntime } = {}) => {
  const { authMiddleware } = resolveAuthContext(sharedRuntime);
  const {
    loanAccessPolicy,
    loanViewService,
    paymentApplicationService,
    attachmentStorage,
  } = createCreditsPublicPorts({ sharedRuntime });
  const attachmentUpload = createAttachmentUpload({ storage: attachmentStorage });
  const useCases = {
    listPayments: createListPayments({ paymentRepository }),
    createPayment: createCreatePayment({ paymentApplicationService, loanAccessPolicy }),
    createPartialPayment: createCreatePartialPayment({ paymentApplicationService, loanAccessPolicy }),
    createCapitalPayment: createCreateCapitalPayment({ paymentApplicationService, loanAccessPolicy }),
    annulInstallment: createAnnulInstallment({ paymentApplicationService, loanAccessPolicy }),
    updatePaymentMetadata: createUpdatePaymentMetadata({ paymentRepository, loanAccessPolicy }),
    listPaymentsByLoan: createListPaymentsByLoan({ paymentRepository, loanAccessPolicy, loanViewService }),
    listPaymentDocuments: createListPaymentDocuments({ paymentRepository, loanAccessPolicy }),
    uploadPaymentDocument: createUploadPaymentDocument({ paymentRepository, loanAccessPolicy, attachmentStorage }),
    downloadPaymentDocument: createDownloadPaymentDocument({ paymentRepository, loanAccessPolicy, attachmentStorage }),
    getPaymentVoucher: createGetPaymentVoucher({ paymentRepository, loanAccessPolicy }),
  };

  return createModule({
    name: 'payouts',
    basePath: '/api/payments',
    router: createPayoutsRouter({ authMiddleware, attachmentUpload, paymentValidation, useCases }),
  });
};

module.exports = {
  createPayoutsModule,
};
