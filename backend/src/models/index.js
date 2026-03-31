const sequelize = require('./database');
const Customer = require('./Customer');
const Associate = require('./Associate');
const Loan = require('./Loan');
const Payment = require('./Payment');
const User = require('./User');
const DocumentAttachment = require('./DocumentAttachment');
const LoanAlert = require('./LoanAlert');
const PromiseToPay = require('./PromiseToPay');
const AssociateContribution = require('./AssociateContribution');
const ProfitDistribution = require('./ProfitDistribution');
const IdempotencyKey = require('./IdempotencyKey');
const Notification = require('./Notification');
const PushSubscription = require('./PushSubscription');
const DagGraphVersion = require('./DagGraphVersion');
const DagSimulationSummary = require('./DagSimulationSummary');
const FinancialProduct = require('./FinancialProduct');
const GraphTopology = require('./GraphTopology');
const OutboxEvent = require('./OutboxEvent');
const ConfigEntry = require('./ConfigEntry');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const UserPermission = require('./UserPermission');
const AuditLog = require('./AuditLog');
const RefreshToken = require('./RefreshToken');
const AssociateInstallment = require('./AssociateInstallment');

Loan.belongsTo(Customer, { foreignKey: 'customerId' });
Customer.hasMany(Loan, { foreignKey: 'customerId' });

Loan.belongsTo(Associate, { foreignKey: 'associateId' });
Associate.hasMany(Loan, { foreignKey: 'associateId' });

Loan.belongsTo(FinancialProduct, { foreignKey: 'financialProductId', as: 'financialProduct' });
FinancialProduct.hasMany(Loan, { foreignKey: 'financialProductId', as: 'loans' });

User.belongsTo(Associate, { foreignKey: 'associateId', as: 'associate' });
Associate.hasMany(User, { foreignKey: 'associateId', as: 'portalUsers' });

Payment.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(Payment, { foreignKey: 'loanId' });

LoanAlert.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(LoanAlert, { foreignKey: 'loanId', as: 'alerts' });

PromiseToPay.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(PromiseToPay, { foreignKey: 'loanId', as: 'promises' });

PromiseToPay.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(PromiseToPay, { foreignKey: 'createdByUserId', as: 'promisesCreated' });

DocumentAttachment.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(DocumentAttachment, { foreignKey: 'loanId', as: 'attachments' });

DocumentAttachment.belongsTo(Payment, { foreignKey: 'paymentId' });
Payment.hasMany(DocumentAttachment, { foreignKey: 'paymentId', as: 'attachments' });

DocumentAttachment.belongsTo(Customer, { foreignKey: 'customerId' });
Customer.hasMany(DocumentAttachment, { foreignKey: 'customerId', as: 'documents' });

DocumentAttachment.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploadedBy' });
User.hasMany(DocumentAttachment, { foreignKey: 'uploadedByUserId', as: 'uploadedAttachments' });

Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

PushSubscription.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(PushSubscription, { foreignKey: 'userId', as: 'pushSubscriptions' });

DagGraphVersion.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(DagGraphVersion, { foreignKey: 'createdByUserId', as: 'dagGraphsCreated' });

DagSimulationSummary.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(DagSimulationSummary, { foreignKey: 'createdByUserId', as: 'dagSummariesCreated' });

DagSimulationSummary.belongsTo(DagGraphVersion, { foreignKey: 'graphVersionId', as: 'graphVersion' });
DagGraphVersion.hasMany(DagSimulationSummary, { foreignKey: 'graphVersionId', as: 'simulationSummaries' });

Loan.belongsTo(DagGraphVersion, { foreignKey: 'dagGraphVersionId', as: 'dagGraph' });
DagGraphVersion.hasMany(Loan, { foreignKey: 'dagGraphVersionId', as: 'loans' });

FinancialProduct.hasMany(GraphTopology, { foreignKey: 'productId', as: 'topologies' });
GraphTopology.belongsTo(FinancialProduct, { foreignKey: 'productId', as: 'product' });

AssociateContribution.belongsTo(Associate, { foreignKey: 'associateId' });
Associate.hasMany(AssociateContribution, { foreignKey: 'associateId', as: 'contributions' });

AssociateContribution.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(AssociateContribution, { foreignKey: 'createdByUserId', as: 'createdContributions' });

AssociateInstallment.belongsTo(Associate, { foreignKey: 'associateId' });
Associate.hasMany(AssociateInstallment, { foreignKey: 'associateId', as: 'installments' });

AssociateInstallment.belongsTo(User, { foreignKey: 'paidBy', as: 'paidByUser' });
User.hasMany(AssociateInstallment, { foreignKey: 'paidBy', as: 'paidInstallments' });

ProfitDistribution.belongsTo(Associate, { foreignKey: 'associateId' });
Associate.hasMany(ProfitDistribution, { foreignKey: 'associateId', as: 'profitDistributions' });

ProfitDistribution.belongsTo(Loan, { foreignKey: 'loanId' });
Loan.hasMany(ProfitDistribution, { foreignKey: 'loanId', as: 'profitDistributions' });

ProfitDistribution.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(ProfitDistribution, { foreignKey: 'createdByUserId', as: 'createdProfitDistributions' });

IdempotencyKey.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
User.hasMany(IdempotencyKey, { foreignKey: 'createdByUserId', as: 'createdIdempotencyKeys' });

RolePermission.belongsTo(Permission, { foreignKey: 'permissionId' });
Permission.hasMany(RolePermission, { foreignKey: 'permissionId' });

RolePermission.belongsTo(User, { foreignKey: 'grantedBy', as: 'grantedByUser' });
User.hasMany(RolePermission, { foreignKey: 'grantedBy', as: 'rolePermissions' });

UserPermission.belongsTo(Permission, { foreignKey: 'permissionId' });
Permission.hasMany(UserPermission, { foreignKey: 'permissionId' });

UserPermission.belongsTo(User, { foreignKey: 'grantedBy', as: 'grantedByUser' });
User.hasMany(UserPermission, { foreignKey: 'grantedBy', as: 'userPermissions' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// RefreshToken associations
RefreshToken.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });

module.exports = {
  sequelize,
  Customer,
  Associate,
  Loan,
  Payment,
  User,
  DocumentAttachment,
  LoanAlert,
  PromiseToPay,
  AssociateContribution,
  AssociateInstallment,
  ProfitDistribution,
  IdempotencyKey,
  Notification,
  PushSubscription,
  DagGraphVersion,
  DagSimulationSummary,
  FinancialProduct,
  GraphTopology,
  OutboxEvent,
  ConfigEntry,
  Permission,
  RolePermission,
  UserPermission,
  AuditLog,
  RefreshToken,
};
