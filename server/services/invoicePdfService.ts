/**
 * Invoice PDF Service
 *
 * Generates professional PDF invoices using PDFKit.
 */

import PDFDocument from 'pdfkit';

// Color palette matching brand
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  text: '#1a202c',
  textLight: '#4a5568',
  border: '#e2e8f0',
  bgLight: '#f7fafc',
  success: '#276749',
  successBg: '#f0fff4',
};

export interface InvoicePdfContext {
  invoice: {
    id: string;
    invoiceNumber: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    status: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    dueDate: string | null;
    paidAt: string | null;
    notes: string | null;
    createdAt: string;
  };
  billingEntity: {
    name: string;
    address?: string;
    email?: string;
  };
  lineItems: Array<{
    communityName?: string;
    lineType: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

class InvoicePdfService {
  /**
   * Generate a PDF invoice
   * Returns a Buffer containing the PDF data
   */
  async generateInvoicePdf(context: InvoicePdfContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Invoice ${context.invoice.invoiceNumber}`,
            Author: 'POAssociation.com',
            Subject: 'Monthly Billing Invoice',
          },
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate invoice content
        this.addHeader(doc, context);
        this.addBillingInfo(doc, context);
        this.addLineItems(doc, context);
        this.addTotals(doc, context);
        this.addFooter(doc, context);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: typeof PDFDocument.prototype, context: InvoicePdfContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Company logo/name
    doc
      .fontSize(24)
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .text('POAssociation.com', 50, 50);

    doc
      .fontSize(10)
      .fillColor(COLORS.textLight)
      .font('Helvetica')
      .text('Property Owners Association Management Platform', 50, 78);

    // Invoice title
    doc
      .fontSize(28)
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, 50, { align: 'right' });

    // Invoice number and date
    doc
      .fontSize(10)
      .fillColor(COLORS.text)
      .font('Helvetica')
      .text(`Invoice #: ${context.invoice.invoiceNumber}`, 50, 85, { align: 'right' });

    const createdDate = new Date(context.invoice.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`Date: ${createdDate}`, 50, 100, { align: 'right' });

    // Status badge
    const status = context.invoice.status.toUpperCase();
    const statusColor = context.invoice.paidAt ? COLORS.success : COLORS.primary;
    doc
      .fontSize(12)
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(status, 50, 120, { align: 'right' });

    // Horizontal line
    doc
      .moveTo(50, 150)
      .lineTo(50 + pageWidth, 150)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    doc.y = 170;
  }

  private addBillingInfo(doc: typeof PDFDocument.prototype, context: InvoicePdfContext): void {
    const startY = doc.y;

    // Bill To section
    doc
      .fontSize(10)
      .fillColor(COLORS.textLight)
      .font('Helvetica-Bold')
      .text('BILL TO:', 50, startY);

    doc
      .fontSize(12)
      .fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .text(context.billingEntity.name, 50, startY + 15);

    if (context.billingEntity.address) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(context.billingEntity.address, 50, startY + 32);
    }

    if (context.billingEntity.email) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(context.billingEntity.email, 50, startY + 47);
    }

    // Billing Period section (right side)
    doc
      .fontSize(10)
      .fillColor(COLORS.textLight)
      .font('Helvetica-Bold')
      .text('BILLING PERIOD:', 350, startY);

    const periodStart = new Date(context.invoice.billingPeriodStart).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const periodEnd = new Date(context.invoice.billingPeriodEnd).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    doc
      .fontSize(11)
      .fillColor(COLORS.text)
      .font('Helvetica')
      .text(`${periodStart} - ${periodEnd}`, 350, startY + 15);

    // Due Date
    if (context.invoice.dueDate) {
      doc
        .fontSize(10)
        .fillColor(COLORS.textLight)
        .font('Helvetica-Bold')
        .text('DUE DATE:', 350, startY + 40);

      const dueDate = new Date(context.invoice.dueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .font('Helvetica')
        .text(dueDate, 350, startY + 55);
    }

    doc.y = startY + 80;
  }

  private addLineItems(doc: typeof PDFDocument.prototype, context: InvoicePdfContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y + 20;

    // Table header background
    doc
      .rect(50, startY, pageWidth, 25)
      .fillColor(COLORS.bgLight)
      .fill();

    // Table headers
    doc
      .fontSize(9)
      .fillColor(COLORS.textLight)
      .font('Helvetica-Bold');

    doc.text('DESCRIPTION', 55, startY + 8);
    doc.text('QTY', 350, startY + 8, { width: 40, align: 'center' });
    doc.text('UNIT PRICE', 400, startY + 8, { width: 70, align: 'right' });
    doc.text('AMOUNT', 480, startY + 8, { width: 70, align: 'right' });

    // Table rows
    let y = startY + 30;
    doc.font('Helvetica').fillColor(COLORS.text);

    for (const item of context.lineItems) {
      // Check if we need a new page
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 50;
      }

      // Community name (if different communities)
      if (item.communityName) {
        doc
          .fontSize(8)
          .fillColor(COLORS.textLight)
          .text(item.communityName, 55, y);
        y += 12;
      }

      // Line item description
      doc
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(item.description, 55, y, { width: 280 });

      // Quantity
      doc.text(item.quantity.toString(), 350, y, { width: 40, align: 'center' });

      // Unit price
      doc.text(this.formatCurrency(item.unitPrice), 400, y, { width: 70, align: 'right' });

      // Total
      doc
        .font('Helvetica-Bold')
        .text(this.formatCurrency(item.totalPrice), 480, y, { width: 70, align: 'right' })
        .font('Helvetica');

      y += 25;

      // Row separator
      doc
        .moveTo(50, y - 5)
        .lineTo(50 + pageWidth, y - 5)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();
    }

    doc.y = y + 10;
  }

  private addTotals(doc: typeof PDFDocument.prototype, context: InvoicePdfContext): void {
    const rightEdge = doc.page.width - doc.page.margins.right;
    let y = doc.y + 20;

    // Subtotal
    doc
      .fontSize(10)
      .fillColor(COLORS.textLight)
      .font('Helvetica')
      .text('Subtotal:', rightEdge - 170, y);
    doc
      .fillColor(COLORS.text)
      .text(this.formatCurrency(context.invoice.subtotal), rightEdge - 70, y, { width: 70, align: 'right' });

    y += 18;

    // Tax (if any)
    if (context.invoice.taxAmount > 0) {
      doc
        .fillColor(COLORS.textLight)
        .text('Tax:', rightEdge - 170, y);
      doc
        .fillColor(COLORS.text)
        .text(this.formatCurrency(context.invoice.taxAmount), rightEdge - 70, y, { width: 70, align: 'right' });
      y += 18;
    }

    // Discount (if any)
    if (context.invoice.discountAmount > 0) {
      doc
        .fillColor(COLORS.textLight)
        .text('Discount:', rightEdge - 170, y);
      doc
        .fillColor(COLORS.success)
        .text(`-${this.formatCurrency(context.invoice.discountAmount)}`, rightEdge - 70, y, { width: 70, align: 'right' });
      y += 18;
    }

    // Total line
    doc
      .moveTo(rightEdge - 180, y)
      .lineTo(rightEdge, y)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    y += 10;

    // Total amount
    doc
      .fontSize(14)
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .text('Total Due:', rightEdge - 170, y);
    doc.text(this.formatCurrency(context.invoice.totalAmount), rightEdge - 80, y, { width: 80, align: 'right' });

    // Paid indicator
    if (context.invoice.paidAt) {
      y += 30;
      const paidDate = new Date(context.invoice.paidAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      doc
        .rect(rightEdge - 180, y, 180, 30)
        .fillColor(COLORS.successBg)
        .fill();

      doc
        .fontSize(12)
        .fillColor(COLORS.success)
        .font('Helvetica-Bold')
        .text('PAID', rightEdge - 170, y + 8);

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(paidDate, rightEdge - 80, y + 10, { width: 70, align: 'right' });
    }

    doc.y = y + 50;
  }

  private addFooter(doc: typeof PDFDocument.prototype, context: InvoicePdfContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomY = doc.page.height - 100;

    // Notes section
    if (context.invoice.notes) {
      doc
        .fontSize(9)
        .fillColor(COLORS.textLight)
        .font('Helvetica-Bold')
        .text('Notes:', 50, doc.y);

      doc
        .font('Helvetica')
        .fillColor(COLORS.text)
        .text(context.invoice.notes, 50, doc.y + 5, { width: pageWidth });
    }

    // Footer line
    doc
      .moveTo(50, bottomY)
      .lineTo(50 + pageWidth, bottomY)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    // Footer text
    doc
      .fontSize(8)
      .fillColor(COLORS.textLight)
      .font('Helvetica')
      .text(
        'Thank you for your business! Questions? Contact billing@poassociation.com',
        50,
        bottomY + 10,
        { align: 'center', width: pageWidth }
      );

    doc.text(
      'POAssociation.com - Property Owners Association Management Platform',
      50,
      bottomY + 25,
      { align: 'center', width: pageWidth }
    );
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
}

// Export singleton instance
export const invoicePdfService = new InvoicePdfService();
export default invoicePdfService;
