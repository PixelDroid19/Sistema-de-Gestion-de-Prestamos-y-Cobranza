const PDFDocument = require('pdfkit');

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

  /**
   * Format a date for display in the voucher.
   * @param {Date|string} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) {
      return 'N/A';
    }
    const d = new Date(date);
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
    // Company branding area (left side) + Voucher title (right side)
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text('LendFlow', 50, 50, { continued: true })
      .text('Sistema de Préstamos', 50, 62);

    doc
      .fontSize(16)
      .fillColor('#333333')
      .text('COMPROBANTE DE PAGO', 400, 50, { align: 'right' });

    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(`Nº: ${data.paymentId || 'N/A'}`, 400, 70, { align: 'right' });

    // Horizontal separator line
    doc
      .strokeColor('#cccccc')
      .lineWidth(1)
      .moveTo(50, 90)
      .lineTo(560, 90)
      .stroke();

    return doc;
  },

  /**
   * Render the client information section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderClient(doc, data) {
    const startY = 110;

    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('DATOS DEL CLIENTE', 50, startY);

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`Nombre: ${data.customerName || 'N/A'}`, 50, startY + 20)
      .text(`C.C./NIT: ${data.documentNumber || 'N/A'}`, 50, startY + 35)
      .text(`Teléfono: ${data.customerPhone || 'N/A'}`, 50, startY + 50);

    return doc;
  },

  /**
   * Render the credit information section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderCredit(doc, data) {
    const startY = 180;

    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('DATOS DEL CRÉDITO', 50, startY);

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`ID Préstamo: ${data.creditId || 'N/A'}`, 50, startY + 20)
      .text(`Monto Original: ${this.formatCurrency(data.originalAmount)}`, 50, startY + 35)
      .text(`Saldo Anterior: ${this.formatCurrency(data.previousBalance)}`, 50, startY + 50)
      .text(`Saldo Remaining: ${this.formatCurrency(data.remainingBalance)}`, 50, startY + 65);

    return doc;
  },

  /**
   * Render the payment details section.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderPayment(doc, data) {
    const startY = 270;

    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('DETALLE DEL PAGO', 50, startY);

    // Payment breakdown table
    const tableTop = startY + 25;
    const col1 = 50;
    const col2 = 400;

    doc
      .fontSize(10)
      .fillColor('#555555');

    // Row: Fecha de Pago
    doc.text('Fecha de Pago:', col1, tableTop);
    doc.text(this.formatDate(data.paymentDate), col2, tableTop, { align: 'right' });

    // Row: Número de Cuota
    doc.text('Número de Cuota:', col1, tableTop + 18);
    doc.text(`Cuota ${data.installmentNumber || 'N/A'}`, col2, tableTop + 18, { align: 'right' });

    // Subtotal row
    doc.text('Subtotal:', col1, tableTop + 40);
    doc.text(this.formatCurrency(data.totalPaid), col2, tableTop + 40, { align: 'right' });

    // Horizontal separator
    doc
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .moveTo(col1, tableTop + 60)
      .lineTo(560, tableTop + 60)
      .stroke();

    // Total row (emphasized)
    doc
      .fontSize(11)
      .fillColor('#333333')
      .text('TOTAL PAGADO:', col1, tableTop + 72);
    doc
      .fontSize(12)
      .fillColor('#0066cc')
      .text(this.formatCurrency(data.totalPaid), col2, tableTop + 70, { align: 'right', bold: true });

    return doc;
  },

  /**
   * Render the payment breakdown components.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderBreakdown(doc, data) {
    const startY = 380;

    doc
      .fontSize(12)
      .fillColor('#333333')
      .text('COMPONENTES DEL PAGO', 50, startY);

    const tableTop = startY + 25;
    const col1 = 50;
    const col2 = 400;

    doc
      .fontSize(10)
      .fillColor('#555555');

    // Capital
    doc.text('Capital:', col1, tableTop);
    doc.text(this.formatCurrency(data.capital || 0), col2, tableTop, { align: 'right' });

    // Interest
    doc.text('Interés:', col1, tableTop + 18);
    doc.text(this.formatCurrency(data.interest || 0), col2, tableTop + 18, { align: 'right' });

    // Late Fee
    if (data.lateFee > 0) {
      doc.text('Mora:', col1, tableTop + 36);
      doc.text(this.formatCurrency(data.lateFee), col2, tableTop + 36, { align: 'right' });
    }

    return doc;
  },

  /**
   * Render the footer with payment method and observations.
   * @param {PDFDocument} doc
   * @param {object} data
   */
  renderFooter(doc, data) {
    const startY = 470;

    // Payment method
    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`Método de Pago: ${data.paymentMethod || 'Efectivo'}`, 50, startY);

    // Observations
    if (data.observations) {
      doc
        .fontSize(10)
        .fillColor('#555555')
        .text(`Observaciones: ${data.observations}`, 50, startY + 20);
    }

    // Footer note
    doc
      .fontSize(8)
      .fillColor('#999999')
      .text(
        'Este comprobante es un documento oficial de pago. Conserve este comprobante para sus registros.',
        50,
        540,
        { align: 'center', width: 510 }
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
          paymentMethod: payment.paymentMetadata?.method || 'Efectivo',
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
