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

Loan.belongsTo(Customer, { foreignKey: 'customerId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Customer.hasMany(Loan, { foreignKey: 'customerId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

Loan.belongsTo(Associate, { foreignKey: 'associateId', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Associate.hasMany(Loan, { foreignKey: 'associateId', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

Loan.belongsTo(FinancialProduct, { foreignKey: 'financialProductId', as: 'financialProduct', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
FinancialProduct.hasMany(Loan, { foreignKey: 'financialProductId', as: 'loans', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

User.belongsTo(Associate, { foreignKey: 'associateId', as: 'associate', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Associate.hasMany(User, { foreignKey: 'associateId', as: 'portalUsers', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

Payment.belongsTo(Loan, { foreignKey: 'loanId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Loan.hasMany(Payment, { foreignKey: 'loanId', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

LoanAlert.belongsTo(Loan, { foreignKey: 'loanId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Loan.hasMany(LoanAlert, { foreignKey: 'loanId', as: 'alerts', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

PromiseToPay.belongsTo(Loan, { foreignKey: 'loanId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Loan.hasMany(PromiseToPay, { foreignKey: 'loanId', as: 'promises', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

PromiseToPay.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(PromiseToPay, { foreignKey: 'createdByUserId', as: 'promisesCreated', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

DocumentAttachment.belongsTo(Loan, { foreignKey: 'loanId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Loan.hasMany(DocumentAttachment, { foreignKey: 'loanId', as: 'attachments', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

DocumentAttachment.belongsTo(Payment, { foreignKey: 'paymentId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Payment.hasMany(DocumentAttachment, { foreignKey: 'paymentId', as: 'attachments', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

DocumentAttachment.belongsTo(Customer, { foreignKey: 'customerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Customer.hasMany(DocumentAttachment, { foreignKey: 'customerId', as: 'documents', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

DocumentAttachment.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'uploadedBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(DocumentAttachment, { foreignKey: 'uploadedByUserId', as: 'uploadedAttachments', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

Notification.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

PushSubscription.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(PushSubscription, { foreignKey: 'userId', as: 'pushSubscriptions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

DagGraphVersion.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(DagGraphVersion, { foreignKey: 'createdByUserId', as: 'dagGraphsCreated', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

DagSimulationSummary.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(DagSimulationSummary, { foreignKey: 'createdByUserId', as: 'dagSummariesCreated', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

DagSimulationSummary.belongsTo(DagGraphVersion, { foreignKey: 'graphVersionId', as: 'graphVersion', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
DagGraphVersion.hasMany(DagSimulationSummary, { foreignKey: 'graphVersionId', as: 'simulationSummaries', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

Loan.belongsTo(DagGraphVersion, { foreignKey: 'dagGraphVersionId', as: 'dagGraph', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
DagGraphVersion.hasMany(Loan, { foreignKey: 'dagGraphVersionId', as: 'loans', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

FinancialProduct.hasMany(GraphTopology, { foreignKey: 'productId', as: 'topologies', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
GraphTopology.belongsTo(FinancialProduct, { foreignKey: 'productId', as: 'product', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

AssociateContribution.belongsTo(Associate, { foreignKey: 'associateId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Associate.hasMany(AssociateContribution, { foreignKey: 'associateId', as: 'contributions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

AssociateContribution.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(AssociateContribution, { foreignKey: 'createdByUserId', as: 'createdContributions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

AssociateInstallment.belongsTo(Associate, { foreignKey: 'associateId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Associate.hasMany(AssociateInstallment, { foreignKey: 'associateId', as: 'installments', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

AssociateInstallment.belongsTo(User, { foreignKey: 'paidBy', as: 'paidByUser', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(AssociateInstallment, { foreignKey: 'paidBy', as: 'paidInstallments', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

ProfitDistribution.belongsTo(Associate, { foreignKey: 'associateId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Associate.hasMany(ProfitDistribution, { foreignKey: 'associateId', as: 'profitDistributions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

ProfitDistribution.belongsTo(Loan, { foreignKey: 'loanId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Loan.hasMany(ProfitDistribution, { foreignKey: 'loanId', as: 'profitDistributions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

ProfitDistribution.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(ProfitDistribution, { foreignKey: 'createdByUserId', as: 'createdProfitDistributions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

IdempotencyKey.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(IdempotencyKey, { foreignKey: 'createdByUserId', as: 'createdIdempotencyKeys', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

RolePermission.belongsTo(Permission, { foreignKey: 'permissionId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Permission.hasMany(RolePermission, { foreignKey: 'permissionId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

RolePermission.belongsTo(User, { foreignKey: 'grantedBy', as: 'grantedByUser', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(RolePermission, { foreignKey: 'grantedBy', as: 'rolePermissions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

UserPermission.belongsTo(Permission, { foreignKey: 'permissionId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Permission.hasMany(UserPermission, { foreignKey: 'permissionId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

UserPermission.belongsTo(User, { foreignKey: 'grantedBy', as: 'grantedByUser', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(UserPermission, { foreignKey: 'grantedBy', as: 'userPermissions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// Audit logs must be preserved even if user is deleted (audit trail integrity)
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

// RefreshToken associations
RefreshToken.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

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
