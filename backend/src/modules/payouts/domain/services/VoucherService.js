const PDFDocument = require('pdfkit');

const PAYMENT_METHOD_LABELS = Object.freeze({
  cash: 'Efectivo',
  transfer: 'Transferencia',
  bank_transfer: 'Transferencia bancaria',
  card: 'Tarjeta',
  other: 'Otro',
});

const PAGE = Object.freeze({
  left: 56,
  right: 539,
  width: 483,
  valueX: 360,
  valueWidth: 179,
});

/**
 * Service for generating payment voucher PDFs.
 */
const VoucherService = {
  /**
   * Format a number as currency (COP).
   * @param {number} amount
   * @returns {string}
   */
  formatCurrency(amount) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2,
    }).format(amount);
  },

  formatPaymentMethod(method) {
    const normalized = String(method || '').trim().toLowerCase();
    return PAYMENT_METHOD_LABELS[normalized] || method || 'Efectivo';
  },

  /**
   * Format a date for display in the voucher.
   * @param {Date|string} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) {
      return 'N/A';
    }
    const dateOnlyMatch = typeof date === 'string' ? date.match(/^(\d{4})-(\d{2})-(\d{2})$/u) : null;
    const d = dateOnlyMatch
      ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12)
      : new Date(date);
    if (Number.isNaN(d.getTime())) {
      return 'N/A';
    }
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },

  /**
   * Render the voucher header section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderHeader(doc, data) {
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('CrediCobranza', PAGE.left, 52, { width: 190 })
      .text('Sistema de Préstamos', PAGE.left, 66, { width: 190 });

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#1f2937')
      .text('COMPROBANTE DE PAGO', 330, 50, { width: 209, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text(`No. ${data.paymentId || 'N/A'}`, 330, 72, { width: 209, align: 'right' });

    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(PAGE.left, 102)
      .lineTo(PAGE.right, 102)
      .stroke();

    return doc;
  },

  renderSectionTitle(doc, title, x, y) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#111827')
      .text(title, x, y, { width: PAGE.width });
  },

  renderKeyValue(doc, label, value, x, y, options = {}) {
    const valueX = options.valueX || PAGE.valueX;
    const valueWidth = options.valueWidth || PAGE.valueWidth;

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#374151')
      .text(label, x, y, { width: valueX - x - 12 });

    doc
      .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(options.fontSize || 10)
      .fillColor(options.color || '#374151')
      .text(value, valueX, y, { width: valueWidth, align: 'right' });
  },

  /**
   * Render the client information section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderClient(doc, data) {
    const startY = 124;

    this.renderSectionTitle(doc, 'DATOS DEL CLIENTE', PAGE.left, startY);
    this.renderKeyValue(doc, 'Nombre', data.customerName || 'N/A', PAGE.left, startY + 22);
    this.renderKeyValue(doc, 'C.C./NIT', data.documentNumber || 'N/A', PAGE.left, startY + 40);
    this.renderKeyValue(doc, 'Teléfono', data.customerPhone || 'N/A', PAGE.left, startY + 58);

    return doc;
  },

  /**
   * Render the credit information section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderCredit(doc, data) {
    const startY = 212;

    this.renderSectionTitle(doc, 'DATOS DEL CRÉDITO', PAGE.left, startY);
    this.renderKeyValue(doc, 'ID préstamo', String(data.creditId || 'N/A'), PAGE.left, startY + 22);
    this.renderKeyValue(doc, 'Monto original', this.formatCurrency(data.originalAmount), PAGE.left, startY + 40);
    this.renderKeyValue(doc, 'Saldo anterior', this.formatCurrency(data.previousBalance), PAGE.left, startY + 58);
    this.renderKeyValue(doc, 'Saldo posterior', this.formatCurrency(data.remainingBalance), PAGE.left, startY + 76);

    return doc;
  },

  /**
   * Render the payment details section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderPayment(doc, data) {
    const startY = 330;

    this.renderSectionTitle(doc, 'DETALLE DEL PAGO', PAGE.left, startY);
    this.renderKeyValue(doc, 'Fecha de pago', this.formatDate(data.paymentDate), PAGE.left, startY + 24);
    this.renderKeyValue(doc, 'Número de cuota', `Cuota ${data.installmentNumber || 'N/A'}`, PAGE.left, startY + 42);
    this.renderKeyValue(doc, 'Subtotal', this.formatCurrency(data.totalPaid), PAGE.left, startY + 64);

    doc
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .moveTo(PAGE.left, startY + 86)
      .lineTo(PAGE.right, startY + 86)
      .stroke();

    this.renderKeyValue(doc, 'TOTAL PAGADO', this.formatCurrency(data.totalPaid), PAGE.left, startY + 100, {
      bold: true,
      fontSize: 12,
      color: '#0052cc',
    });

    return doc;
  },

  /**
   * Render the payment breakdown components.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderBreakdown(doc, data) {
    const startY = 466;

    this.renderSectionTitle(doc, 'COMPONENTES DEL PAGO', PAGE.left, startY);
    this.renderKeyValue(doc, 'Capital', this.formatCurrency(data.capital || 0), PAGE.left, startY + 24);
    this.renderKeyValue(doc, 'Interés', this.formatCurrency(data.interest || 0), PAGE.left, startY + 42);

    if (data.lateFee > 0) {
      this.renderKeyValue(doc, 'Mora', this.formatCurrency(data.lateFee), PAGE.left, startY + 60);
    }

    return doc;
  },

  /**
   * Render the footer with payment method and observations.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderFooter(doc, data) {
    const startY = 568;

    this.renderKeyValue(doc, 'Método de pago', this.formatPaymentMethod(data.paymentMethod), PAGE.left, startY);

    if (data.observations) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#374151')
        .text(`Observaciones: ${data.observations}`, PAGE.left, startY + 24, { width: PAGE.width });
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#999999')
      .text(
        'Este comprobante es un documento oficial de pago. Conserve este comprobante para sus registros.',
        PAGE.left,
        745,
        { align: 'center', width: PAGE.width }
      );

    return doc;
  },

  /**
   * Render the complete voucher layout.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderVoucher(doc, data) {
    this.renderHeader(doc, data);
    this.renderClient(doc, data);
    this.renderCredit(doc, data);
    this.renderPayment(doc, data);
    this.renderBreakdown(doc, data);
    this.renderFooter(doc, data);
    return doc;
  },

  /**
   * Generate a PDF voucher as a Buffer.
   * @param {object} payment - Payment data
   * @param {object} loan - Loan data
   * @param {object} customer - Customer data
   * @returns {Promise<Buffer>}
   */
  async generateVoucherPdf(payment, loan, customer) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          bufferPages: false,
        });

        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Prepare voucher data
        const voucherData = {
          paymentId: payment.id,
          paymentDate: payment.paymentDate,
          customerName: customer?.name || 'N/A',
          documentNumber: customer?.documentNumber || 'N/A',
          customerPhone: customer?.phone || 'N/A',
          creditId: loan?.id,
          originalAmount: loan?.amount,
          previousBalance: payment.remainingBalanceAfterPayment + payment.amount,
          installmentNumber: payment.installmentNumber,
          capital: payment.principalApplied,
          interest: payment.interestApplied,
          lateFee: payment.penaltyApplied,
          totalPaid: payment.amount,
          paymentMethod: payment.paymentMethod || 'cash',
          observations: payment.paymentMetadata?.observation || '',
          remainingBalance: payment.remainingBalanceAfterPayment,
        };

        this.renderVoucher(doc, voucherData);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },
};

module.exports = {
  VoucherService,
};
