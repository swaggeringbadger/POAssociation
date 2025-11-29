/**
 * PDF Report Service
 *
 * Generates professional PDF analysis reports using PDFKit.
 * Reports include:
 * - Executive summary
 * - Compliance score and risk level
 * - Bylaw compliance details
 * - Risk assessment
 * - Questions and recommendations
 * - Satellite imagery (optional)
 * - AI mockups (optional)
 */

import PDFDocument from 'pdfkit';
import type { AiAnalysisResult, Coordinates } from '@shared/aiAnalysisTypes';
import type { AiAnalysis } from '@shared/schema';

export interface ReportContext {
  analysis: AiAnalysis;
  result: AiAnalysisResult;
  application: {
    applicationNumber: string;
    projectType: string;
    title: string;
    description: string;
    propertyAddress: string;
    submittedAt: Date;
  };
  tenant: {
    name: string;
    logoUrl?: string;
  };
  satelliteImage?: {
    base64: string;
    coordinates: Coordinates;
  };
  mockupImages?: Array<{
    base64: string;
    description?: string;
  }>;
}

// Color palette
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  success: '#276749',
  warning: '#c05621',
  danger: '#c53030',
  text: '#1a202c',
  textLight: '#4a5568',
  border: '#e2e8f0',
  bgLight: '#f7fafc',
};

// Get color for risk level
function getRiskColor(level: string): string {
  switch (level) {
    case 'low':
      return COLORS.success;
    case 'medium':
      return COLORS.warning;
    case 'high':
    case 'critical':
      return COLORS.danger;
    default:
      return COLORS.textLight;
  }
}

// Get color for compliance score
function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.success;
  if (score >= 60) return COLORS.warning;
  return COLORS.danger;
}

export class PdfReportService {
  /**
   * Generate a full PDF report
   * Returns the PDF as a Buffer
   */
  async generateReport(context: ReportContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Create document with standard letter size
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `AI Analysis Report - ${context.application.applicationNumber}`,
          Author: context.tenant.name,
          Subject: `Analysis of ${context.application.title}`,
          Creator: 'Markland POA Portal - AI Analysis System',
        },
      });

      // Collect PDF data
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Build the report
      this.addHeader(doc, context);
      this.addExecutiveSummary(doc, context);
      this.addComplianceDetails(doc, context);
      this.addRiskAssessment(doc, context);
      this.addQuestionsAndRecommendations(doc, context);

      // Add images if available
      if (context.satelliteImage) {
        this.addSatelliteImage(doc, context);
      }
      if (context.mockupImages && context.mockupImages.length > 0) {
        this.addMockupImages(doc, context);
      }

      this.addFooter(doc, context);

      // Finalize the PDF
      doc.end();
    });
  }

  /**
   * Add report header with branding
   */
  private addHeader(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Title bar
    doc.fillColor(COLORS.primary)
      .rect(50, 50, pageWidth, 60)
      .fill();

    // Report title
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('AI Application Analysis Report', 60, 68);

    doc.font('Helvetica')
      .fontSize(10)
      .text(context.tenant.name, 60, 90);

    // Application info box
    doc.fillColor(COLORS.bgLight)
      .rect(50, 120, pageWidth, 70)
      .fill();

    doc.fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Application Details', 60, 130);

    const detailsY = 148;
    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.textLight);

    doc.text(`Application #: ${context.application.applicationNumber}`, 60, detailsY);
    doc.text(`Project Type: ${context.application.projectType}`, 60, detailsY + 12);
    doc.text(`Property: ${context.application.propertyAddress}`, 250, detailsY);
    doc.text(`Submitted: ${context.application.submittedAt.toLocaleDateString()}`, 250, detailsY + 12);

    doc.moveDown(5);
  }

  /**
   * Add executive summary section
   */
  private addExecutiveSummary(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.y = 210;

    // Section title
    this.addSectionTitle(doc, 'Executive Summary');

    // Score and risk boxes
    const boxWidth = (pageWidth - 20) / 2;
    const boxY = doc.y;

    // Compliance score box
    doc.fillColor(COLORS.bgLight)
      .roundedRect(50, boxY, boxWidth, 60, 5)
      .fill();

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(10)
      .text('Compliance Score', 60, boxY + 10);

    doc.fillColor(getScoreColor(result.complianceScore))
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(`${result.complianceScore}%`, 60, boxY + 25);

    // Risk level box
    doc.fillColor(COLORS.bgLight)
      .roundedRect(50 + boxWidth + 20, boxY, boxWidth, 60, 5)
      .fill();

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(10)
      .text('Risk Level', 60 + boxWidth + 20, boxY + 10);

    doc.fillColor(getRiskColor(result.riskLevel))
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(result.riskLevel.toUpperCase(), 60 + boxWidth + 20, boxY + 28);

    // Overall summary
    doc.y = boxY + 80;
    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(11)
      .text(result.overallSummary, 50, doc.y, { width: pageWidth });

    doc.moveDown(2);
  }

  /**
   * Add bylaw compliance details
   */
  private addComplianceDetails(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    this.addSectionTitle(doc, 'Bylaw Compliance');

    for (const item of result.bylawCompliance) {
      // Check for page break
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }

      // Compliance indicator
      const indicatorColor = item.compliant ? COLORS.success : COLORS.danger;
      doc.fillColor(indicatorColor)
        .circle(60, doc.y + 5, 4)
        .fill();

      // Bylaw reference
      doc.fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(item.sectionReference, 72, doc.y, { continued: true });

      doc.fillColor(item.compliant ? COLORS.success : COLORS.danger)
        .font('Helvetica')
        .text(item.compliant ? ' - Compliant' : ' - Non-Compliant');

      // Explanation
      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(9)
        .text(item.explanation, 72, doc.y, { width: pageWidth - 22 });

      // Concerns if any
      if (item.concerns && item.concerns.length > 0) {
        doc.fillColor(COLORS.warning)
          .fontSize(8)
          .text('Concerns:', 72, doc.y + 5);

        for (const concern of item.concerns) {
          doc.text(`• ${concern}`, 82, doc.y, { width: pageWidth - 32 });
        }
      }

      doc.moveDown();
    }

    doc.moveDown();
  }

  /**
   * Add risk assessment section
   */
  private addRiskAssessment(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Check for page break
    if (doc.y > 550) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Risk Assessment');

    for (const risk of result.riskAssessment) {
      // Check for page break
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }

      // Risk severity indicator
      doc.fillColor(getRiskColor(risk.severity))
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`[${risk.severity.toUpperCase()}]`, 50, doc.y, { continued: true });

      // Category
      doc.fillColor(COLORS.primary)
        .text(` ${risk.category.replace(/_/g, ' ').toUpperCase()}`);

      // Description
      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(9)
        .text(risk.description, 60, doc.y, { width: pageWidth - 10 });

      // Mitigation
      doc.fillColor(COLORS.textLight)
        .fontSize(8)
        .text(`Mitigation: ${risk.mitigation}`, 60, doc.y, { width: pageWidth - 10 });

      doc.moveDown();
    }

    doc.moveDown();
  }

  /**
   * Add questions and recommendations
   */
  private addQuestionsAndRecommendations(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Questions section
    if (result.questionsConcerns.length > 0) {
      if (doc.y > 550) {
        doc.addPage();
        doc.y = 50;
      }

      this.addSectionTitle(doc, 'Questions for Review');

      for (const q of result.questionsConcerns) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        const priorityColor = q.priority === 'high' ? COLORS.danger :
          q.priority === 'medium' ? COLORS.warning : COLORS.textLight;

        doc.fillColor(priorityColor)
          .font('Helvetica')
          .fontSize(8)
          .text(`[${q.priority}]`, 50, doc.y, { continued: true });

        doc.fillColor(COLORS.text)
          .fontSize(9)
          .text(` ${q.question}`, { width: pageWidth - 30 });

        doc.moveDown(0.5);
      }
    }

    // Recommendations section
    if (result.recommendations.length > 0) {
      if (doc.y > 500) {
        doc.addPage();
        doc.y = 50;
      }

      this.addSectionTitle(doc, 'Recommendations');

      for (const rec of result.recommendations) {
        // Recommendation type badge
        const typeColor = rec.type === 'approve' ? COLORS.success :
          rec.type === 'deny' ? COLORS.danger : COLORS.warning;

        doc.fillColor(typeColor)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(rec.type.replace(/_/g, ' ').toUpperCase(), 50, doc.y);

        // Explanation
        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(10)
          .text(rec.explanation, 50, doc.y, { width: pageWidth });

        // Conditions
        if (rec.conditions && rec.conditions.length > 0) {
          doc.fillColor(COLORS.textLight)
            .fontSize(9)
            .text('Conditions:', 50, doc.y + 5);

          for (const condition of rec.conditions) {
            doc.text(`• ${condition}`, 60, doc.y, { width: pageWidth - 10 });
          }
        }

        doc.moveDown();
      }
    }
  }

  /**
   * Add satellite image to report
   */
  private addSatelliteImage(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    if (!context.satelliteImage) return;

    doc.addPage();
    doc.y = 50;

    this.addSectionTitle(doc, 'Property Location');

    try {
      const imageBuffer = Buffer.from(context.satelliteImage.base64, 'base64');
      const imageWidth = 400;

      doc.image(imageBuffer, (doc.page.width - imageWidth) / 2, doc.y, {
        width: imageWidth,
      });

      doc.y += 300;

      doc.fillColor(COLORS.textLight)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Coordinates: ${context.satelliteImage.coordinates.lat.toFixed(6)}, ${context.satelliteImage.coordinates.lng.toFixed(6)}`,
          { align: 'center' }
        );
    } catch (error) {
      console.error('[PdfReport] Error adding satellite image:', error);
      doc.fillColor(COLORS.textLight)
        .fontSize(10)
        .text('(Satellite image could not be loaded)', { align: 'center' });
    }
  }

  /**
   * Add AI mockup images to report
   */
  private addMockupImages(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    if (!context.mockupImages || context.mockupImages.length === 0) return;

    doc.addPage();
    doc.y = 50;

    this.addSectionTitle(doc, 'AI-Generated Mockups');

    doc.fillColor(COLORS.textLight)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text('These mockups are AI-generated visualizations and may not represent the exact final appearance.', {
        align: 'center',
      });

    doc.moveDown();

    for (const mockup of context.mockupImages) {
      if (doc.y > 500) {
        doc.addPage();
        doc.y = 50;
      }

      try {
        const imageBuffer = Buffer.from(mockup.base64, 'base64');
        const imageWidth = 350;

        doc.image(imageBuffer, (doc.page.width - imageWidth) / 2, doc.y, {
          width: imageWidth,
        });

        doc.y += 250;

        if (mockup.description) {
          doc.fillColor(COLORS.textLight)
            .font('Helvetica')
            .fontSize(8)
            .text(mockup.description, { align: 'center' });
        }

        doc.moveDown(2);
      } catch (error) {
        console.error('[PdfReport] Error adding mockup image:', error);
      }
    }
  }

  /**
   * Add footer with disclaimers
   */
  private addFooter(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const pageCount = doc.bufferedPageRange().count;

    // Add footer to each page
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Footer line
      doc.strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke();

      // Page number
      doc.fillColor(COLORS.textLight)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 40,
          { width: 100 }
        );

      // Disclaimer
      doc.text(
        'AI-generated analysis for reference only. Human review required.',
        150,
        doc.page.height - 40,
        { width: 300, align: 'center' }
      );

      // Generation date
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        doc.page.width - 150,
        doc.page.height - 40,
        { width: 100, align: 'right' }
      );
    }
  }

  /**
   * Add a section title
   */
  private addSectionTitle(doc: typeof PDFDocument.prototype, title: string): void {
    doc.fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(title, 50, doc.y);

    doc.strokeColor(COLORS.secondary)
      .lineWidth(2)
      .moveTo(50, doc.y + 3)
      .lineTo(150, doc.y + 3)
      .stroke();

    doc.moveDown();
  }
}

// Export singleton instance
export const pdfReportService = new PdfReportService();
