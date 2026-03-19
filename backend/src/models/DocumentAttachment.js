const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const DocumentAttachment = sequelize.define('DocumentAttachment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  loanId: { type: DataTypes.INTEGER, allowNull: true },
  paymentId: { type: DataTypes.INTEGER, allowNull: true },
  customerId: { type: DataTypes.INTEGER, allowNull: true },
  uploadedByUserId: { type: DataTypes.INTEGER, allowNull: false },
  storageDisk: { type: DataTypes.STRING, allowNull: false, defaultValue: 'local' },
  storagePath: { type: DataTypes.STRING, allowNull: false },
  storedName: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING, allowNull: false },
  mimeType: { type: DataTypes.STRING, allowNull: true },
  sizeBytes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  customerVisible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  category: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
  validate: {
    hasSingleOwnerReference() {
      const hasLoan = Boolean(this.loanId);
      const hasPayment = Boolean(this.paymentId);
      const hasCustomer = Boolean(this.customerId);
      const ownerCount = [hasLoan, hasPayment, hasCustomer].filter(Boolean).length;

      if (ownerCount === 0) {
        throw new Error('Document attachment must belong to a loan, payment, or customer');
      }

      if (ownerCount > 1) {
        throw new Error('Document attachment cannot belong to multiple owners at once');
      }
    },
  },
});

module.exports = DocumentAttachment;
