/**
 * PDF Report Service
 *
 * Generates professional PDF analysis reports using PDFKit.
 *
 * Supports two report types:
 * 1. Standard Report (generateReport) - Basic analysis with compliance score, risks, recommendations
 * 2. Breakdown Report (generateBreakdownReport) - Comprehensive analysis with:
 *    - Multiple scores (completeness, correctness, community compliance, regulatory compliance)
 *    - Issues categorized by severity (critical, moderate, low)
 *    - Questions for homeowner (clarifications, elaborations, document requests)
 *    - Detailed compliance analysis
 */

import PDFDocument from 'pdfkit';
import type { AiAnalysisResult, Coordinates, BreakdownReportResult } from '@shared/aiAnalysisTypes';
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
  propertyBoundaryImage?: {
    base64: string;
    coordinates: Coordinates;
  };
  neighborhoodContextImage?: {
    base64: string;
    coordinates: Coordinates;
  };
  mockupImages?: Array<{
    base64: string;
    description?: string;
  }>;
}

export interface BreakdownReportContext {
  analysis: AiAnalysis;
  result: BreakdownReportResult;
  application: {
    applicationNumber: string;
    projectType: string;
    title: string;
    description: string;
    propertyAddress: string;
    submittedAt: Date;
    lotType?: string;
    applicantName?: string;
  };
  tenant: {
    name: string;
    logoUrl?: string;
    countyJurisdiction?: string;
  };
  satelliteImage?: {
    base64: string;
    coordinates: Coordinates;
  };
  propertyBoundaryImage?: {
    base64: string;
    coordinates: Coordinates;
  };
  neighborhoodContextImage?: {
    base64: string;
    coordinates: Coordinates;
  };
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
  bgSuccess: '#f0fff4',
  bgWarning: '#fffaf0',
  bgDanger: '#fff5f5',
};

// Get color for risk/severity level
function getSeverityColor(level: string): string {
  switch (level?.toLowerCase()) {
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

// Get background color for score
function getScoreBgColor(score: number): string {
  if (score >= 80) return COLORS.bgSuccess;
  if (score >= 60) return COLORS.bgWarning;
  return COLORS.bgDanger;
}

// Get assessment color
function getAssessmentColor(assessment: string): string {
  switch (assessment) {
    case 'comprehensive':
      return COLORS.success;
    case 'mostly_complete':
      return COLORS.secondary;
    case 'needs_attention':
      return COLORS.warning;
    case 'incomplete':
      return COLORS.danger;
    default:
      return COLORS.textLight;
  }
}

export class PdfReportService {
  /**
   * Generate a standard PDF report
   * Returns the PDF as a Buffer
   */
  async generateReport(context: ReportContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Create document with standard letter size
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
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

      // Add images if available (with guards to prevent blank pages)
      if (context.satelliteImage?.base64) {
        this.addSatelliteImage(doc, context);
      }
      if (context.mockupImages && context.mockupImages.length > 0 && context.mockupImages.some(m => m.base64)) {
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
  private addHeader(doc: typeof PDFDocument.prototype, context: ReportContext | BreakdownReportContext): void {
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
   * Add executive summary section (standard report)
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

    doc.fillColor(getSeverityColor(result.riskLevel))
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
   * Add bylaw compliance details (standard report)
   */
  private addComplianceDetails(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (!result.bylawCompliance || result.bylawCompliance.length === 0) {
      return; // Skip section if no compliance data
    }

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
   * Add risk assessment section (standard report)
   */
  private addRiskAssessment(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (!result.riskAssessment || result.riskAssessment.length === 0) {
      return; // Skip section if no risk data
    }

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
      doc.fillColor(getSeverityColor(risk.severity))
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
   * Add questions and recommendations (standard report)
   */
  private addQuestionsAndRecommendations(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Questions section
    if (result.questionsConcerns && result.questionsConcerns.length > 0) {
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
    if (result.recommendations && result.recommendations.length > 0) {
      if (doc.y > 500) {
        doc.addPage();
        doc.y = 50;
      }

      this.addSectionTitle(doc, 'Recommendations');

      for (const rec of result.recommendations) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 50;
        }

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
   * Add satellite image to report (with guard for empty data)
   */
  private addSatelliteImage(doc: typeof PDFDocument.prototype, context: ReportContext | BreakdownReportContext): void {
    if (!context.satelliteImage?.base64) return;

    doc.addPage();
    doc.y = 50;

    this.addSectionTitle(doc, 'Property Location');

    try {
      const imageBuffer = Buffer.from(context.satelliteImage.base64, 'base64');

      // Verify buffer has content
      if (imageBuffer.length === 0) {
        throw new Error('Empty image buffer');
      }

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
   * Add AI mockup images to report (with guard for empty data)
   */
  private addMockupImages(doc: typeof PDFDocument.prototype, context: ReportContext): void {
    const validMockups = context.mockupImages?.filter(m => m.base64 && m.base64.length > 0) || [];

    if (validMockups.length === 0) return;

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

    for (const mockup of validMockups) {
      if (doc.y > 500) {
        doc.addPage();
        doc.y = 50;
      }

      try {
        const imageBuffer = Buffer.from(mockup.base64, 'base64');

        // Verify buffer has content
        if (imageBuffer.length === 0) {
          continue;
        }

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
  private addFooter(doc: typeof PDFDocument.prototype, context: ReportContext | BreakdownReportContext): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.start + range.count;
    const footerY = doc.page.height - 40;

    // Add footer to each page
    for (let i = range.start; i < totalPages; i++) {
      doc.switchToPage(i);

      // Footer line
      doc.strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke();

      // Page number - use height constraint to prevent PDFKit from creating new pages
      doc.fillColor(COLORS.textLight)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Page ${i + 1} of ${totalPages}`,
          50,
          footerY,
          { width: 100, height: 12, lineBreak: false }
        );

      // Disclaimer
      doc.text(
        'AI-generated analysis for reference only. Human review required.',
        150,
        footerY,
        { width: 300, height: 12, align: 'center', lineBreak: false }
      );

      // Generation date
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        doc.page.width - 150,
        footerY,
        { width: 100, height: 12, align: 'right', lineBreak: false }
      );
    }

    // Flush all buffered pages
    doc.flushPages();
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

  // ============================================
  // BREAKDOWN REPORT METHODS
  // ============================================

  /**
   * Generate a comprehensive breakdown report PDF
   * This provides detailed analysis with multiple scores, categorized issues,
   * and questions for homeowner
   */
  async generateBreakdownReport(context: BreakdownReportContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `Application Breakdown Report - ${context.application.applicationNumber}`,
          Author: context.tenant.name,
          Subject: `Detailed Analysis of ${context.application.title}`,
          Creator: 'Markland POA Portal - AI Analysis System',
        },
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Build the breakdown report
      this.addBreakdownHeader(doc, context);
      this.addBreakdownScoreSummary(doc, context);
      this.addBreakdownExecutiveSummary(doc, context);
      this.addCompletenessSection(doc, context);
      this.addCorrectnessSection(doc, context);
      this.addCommunityComplianceSection(doc, context);
      this.addRegulatoryComplianceSection(doc, context);
      this.addIssuesSection(doc, context);
      this.addQuestionsForHomeownerSection(doc, context);
      this.addBreakdownRecommendations(doc, context);

      // Add property images if available
      if (context.satelliteImage?.base64 || context.propertyBoundaryImage?.base64) {
        this.addPropertyImagesSection(doc, context);
      }

      this.addFooter(doc, context);

      doc.end();
    });
  }

  /**
   * Add breakdown report header
   */
  private addBreakdownHeader(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Title bar
    doc.fillColor(COLORS.primary)
      .rect(50, 50, pageWidth, 70)
      .fill();

    // Report title
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Application Breakdown Report', 60, 62);

    doc.font('Helvetica')
      .fontSize(10)
      .text(`${context.tenant.name}`, 60, 88);

    if (context.tenant.countyJurisdiction) {
      doc.text(` • ${context.tenant.countyJurisdiction}`, { continued: false });
    }

    // Application info box
    doc.fillColor(COLORS.bgLight)
      .rect(50, 130, pageWidth, 80)
      .fill();

    doc.fillColor(COLORS.text)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Application Details', 60, 140);

    const col1X = 60;
    const col2X = 280;
    let detailsY = 158;

    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.textLight);

    doc.text(`Application #: ${context.application.applicationNumber}`, col1X, detailsY);
    doc.text(`Property: ${context.application.propertyAddress}`, col2X, detailsY);

    detailsY += 12;
    doc.text(`Project Type: ${context.application.projectType}`, col1X, detailsY);
    doc.text(`Submitted: ${context.application.submittedAt.toLocaleDateString()}`, col2X, detailsY);

    detailsY += 12;
    if (context.application.applicantName) {
      doc.text(`Applicant: ${context.application.applicantName}`, col1X, detailsY);
    }
    if (context.application.lotType) {
      doc.text(`Lot Type: ${context.application.lotType}`, col2X, detailsY);
    }

    doc.y = 220;
  }

  /**
   * Add score summary boxes
   */
  private addBreakdownScoreSummary(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { result } = context;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const boxWidth = (pageWidth - 30) / 4;
    const boxY = doc.y;
    const boxHeight = 60;

    const scores = [
      { label: 'Completeness', score: result.reportSummary.completenessScore },
      { label: 'Correctness', score: result.reportSummary.correctnessScore },
      { label: 'Community', score: result.reportSummary.communityComplianceScore },
      { label: 'Regulatory', score: result.reportSummary.regulatoryComplianceScore },
    ];

    scores.forEach((s, index) => {
      const boxX = 50 + (boxWidth + 10) * index;

      doc.fillColor(getScoreBgColor(s.score))
        .roundedRect(boxX, boxY, boxWidth, boxHeight, 5)
        .fill();

      doc.fillColor(COLORS.textLight)
        .font('Helvetica')
        .fontSize(8)
        .text(s.label, boxX + 5, boxY + 8, { width: boxWidth - 10, align: 'center' });

      doc.fillColor(getScoreColor(s.score))
        .font('Helvetica-Bold')
        .fontSize(22)
        .text(`${s.score}%`, boxX + 5, boxY + 25, { width: boxWidth - 10, align: 'center' });
    });

    // Overall score and assessment
    doc.y = boxY + boxHeight + 15;

    const overallBoxWidth = (pageWidth - 10) / 2;

    // Overall score box
    doc.fillColor(getScoreBgColor(result.reportSummary.overallScore))
      .roundedRect(50, doc.y, overallBoxWidth, 45, 5)
      .fill();

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(9)
      .text('Overall Score', 55, doc.y + 5);

    doc.fillColor(getScoreColor(result.reportSummary.overallScore))
      .font('Helvetica-Bold')
      .fontSize(24)
      .text(`${result.reportSummary.overallScore}%`, 55, doc.y + 18);

    // Assessment box
    const assessmentX = 50 + overallBoxWidth + 10;
    doc.fillColor(COLORS.bgLight)
      .roundedRect(assessmentX, doc.y, overallBoxWidth, 45, 5)
      .fill();

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(9)
      .text('Assessment', assessmentX + 5, doc.y + 5);

    doc.fillColor(getAssessmentColor(result.reportSummary.overallAssessment))
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(result.reportSummary.overallAssessment.replace(/_/g, ' ').toUpperCase(), assessmentX + 5, doc.y + 22);

    doc.y += 60;
  }

  /**
   * Add executive summary for breakdown report
   */
  private addBreakdownExecutiveSummary(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    this.addSectionTitle(doc, 'Executive Summary');

    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(10)
      .text(context.result.reportSummary.executiveSummary, 50, doc.y, { width: pageWidth });

    doc.moveDown(2);
  }

  /**
   * Add completeness analysis section
   */
  private addCompletenessSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { completenessAnalysis } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (doc.y > 550) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Completeness Analysis');

    // Documentation status badge
    const statusColor = completenessAnalysis.documentationStatus === 'complete' ? COLORS.success :
      completenessAnalysis.documentationStatus === 'partial' ? COLORS.warning : COLORS.danger;

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(9)
      .text('Documentation Status: ', 50, doc.y, { continued: true });

    doc.fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(completenessAnalysis.documentationStatus.toUpperCase());

    doc.moveDown();

    // Required items provided
    if (completenessAnalysis.requiredItemsProvided.length > 0) {
      doc.fillColor(COLORS.success)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('✓ Required Items Provided:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8);

      for (const item of completenessAnalysis.requiredItemsProvided) {
        doc.text(`  • ${item}`, 60, doc.y, { width: pageWidth - 10 });
      }
      doc.moveDown(0.5);
    }

    // Required items missing
    if (completenessAnalysis.requiredItemsMissing.length > 0) {
      doc.fillColor(COLORS.danger)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('✗ Required Items Missing:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8);

      for (const item of completenessAnalysis.requiredItemsMissing) {
        doc.text(`  • ${item}`, 60, doc.y, { width: pageWidth - 10 });
      }
      doc.moveDown(0.5);
    }

    // Notes
    if (completenessAnalysis.notes) {
      doc.fillColor(COLORS.textLight)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(completenessAnalysis.notes, 50, doc.y, { width: pageWidth });
    }

    doc.moveDown(2);
  }

  /**
   * Add correctness analysis section
   */
  private addCorrectnessSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { correctnessAnalysis } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (doc.y > 500) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Correctness Analysis');

    // Verified information
    if (correctnessAnalysis.verifiedInformation.length > 0) {
      doc.fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Verified Information:', 50, doc.y);

      doc.moveDown(0.5);

      for (const info of correctnessAnalysis.verifiedInformation) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        const statusColor = info.status === 'verified' ? COLORS.success :
          info.status === 'plausible' ? COLORS.secondary :
          info.status === 'questionable' ? COLORS.warning : COLORS.danger;

        doc.fillColor(statusColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`[${info.status.toUpperCase()}]`, 55, doc.y, { continued: true });

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .text(` ${info.item}`);

        if (info.notes) {
          doc.fillColor(COLORS.textLight)
            .fontSize(7)
            .text(`   ${info.notes}`, 65, doc.y, { width: pageWidth - 15 });
        }
      }
      doc.moveDown();
    }

    // Inconsistencies
    if (correctnessAnalysis.inconsistencies.length > 0) {
      doc.fillColor(COLORS.warning)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Inconsistencies Found:', 50, doc.y);

      doc.moveDown(0.5);

      for (const inc of correctnessAnalysis.inconsistencies) {
        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(8)
          .text(`• ${inc.description}`, 55, doc.y, { width: pageWidth - 5 });

        doc.fillColor(COLORS.textLight)
          .fontSize(7)
          .text(`  Fields: ${inc.fields.join(', ')}`, 60, doc.y);
        doc.text(`  Impact: ${inc.impact}`, 60, doc.y, { width: pageWidth - 10 });
      }
    }

    doc.moveDown(2);
  }

  /**
   * Add community compliance section
   */
  private addCommunityComplianceSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { communityComplianceAnalysis } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (doc.y > 450) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Community Compliance');

    // Guidelines reviewed
    if (communityComplianceAnalysis.guidelinesReviewed.length > 0) {
      doc.fillColor(COLORS.textLight)
        .font('Helvetica')
        .fontSize(8)
        .text(`Guidelines Reviewed: ${communityComplianceAnalysis.guidelinesReviewed.join(', ')}`, 50, doc.y, { width: pageWidth });
      doc.moveDown();
    }

    // Compliant areas
    if (communityComplianceAnalysis.compliantAreas.length > 0) {
      doc.fillColor(COLORS.success)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('✓ Compliant Areas:', 50, doc.y);

      doc.moveDown(0.5);

      for (const area of communityComplianceAnalysis.compliantAreas.slice(0, 5)) { // Limit to 5
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        doc.fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`${area.guideline}`, 55, doc.y);

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(7)
          .text(area.explanation, 55, doc.y, { width: pageWidth - 5 });

        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Non-compliant areas
    if (communityComplianceAnalysis.nonCompliantAreas.length > 0) {
      doc.fillColor(COLORS.danger)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('✗ Non-Compliant Areas:', 50, doc.y);

      doc.moveDown(0.5);

      for (const area of communityComplianceAnalysis.nonCompliantAreas) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 50;
        }

        doc.fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`${area.guideline} (${area.reference})`, 55, doc.y);

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(7)
          .text(area.explanation, 55, doc.y, { width: pageWidth - 5 });

        doc.fillColor(COLORS.warning)
          .text(`Remediation: ${area.remediation}`, 55, doc.y, { width: pageWidth - 5 });

        doc.moveDown(0.5);
      }
    }

    doc.moveDown(2);
  }

  /**
   * Add regulatory compliance section
   */
  private addRegulatoryComplianceSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { regulatoryComplianceAnalysis } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (doc.y > 450) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Regulatory Compliance');

    // Permits required
    if (regulatoryComplianceAnalysis.permitsRequired.length > 0) {
      doc.fillColor(COLORS.warning)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Permits Required:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8);

      for (const permit of regulatoryComplianceAnalysis.permitsRequired) {
        doc.text(`• ${permit}`, 55, doc.y);
      }
      doc.moveDown();
    }

    // Inspections required
    if (regulatoryComplianceAnalysis.inspectionsRequired.length > 0) {
      doc.fillColor(COLORS.secondary)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Inspections Required:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(8);

      for (const inspection of regulatoryComplianceAnalysis.inspectionsRequired) {
        doc.text(`• ${inspection}`, 55, doc.y);
      }
      doc.moveDown();
    }

    // Potential issues
    if (regulatoryComplianceAnalysis.potentialIssues.length > 0) {
      doc.fillColor(COLORS.danger)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('Potential Regulatory Issues:', 50, doc.y);

      doc.moveDown(0.5);

      for (const issue of regulatoryComplianceAnalysis.potentialIssues) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        doc.fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(issue.regulation, 55, doc.y);

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(7)
          .text(`Concern: ${issue.concern}`, 55, doc.y, { width: pageWidth - 5 });
        doc.text(`Recommendation: ${issue.recommendation}`, 55, doc.y, { width: pageWidth - 5 });

        doc.moveDown(0.5);
      }
    }

    // Notes
    if (regulatoryComplianceAnalysis.notes) {
      doc.fillColor(COLORS.textLight)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(regulatoryComplianceAnalysis.notes, 50, doc.y, { width: pageWidth });
    }

    doc.moveDown(2);
  }

  /**
   * Add issues section (critical, moderate, low)
   */
  private addIssuesSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { issues } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const hasIssues = issues.critical.length > 0 || issues.moderate.length > 0 || issues.low.length > 0;
    if (!hasIssues) return;

    doc.addPage();
    doc.y = 50;

    this.addSectionTitle(doc, 'Issues Summary');

    // Issue counts summary
    const criticalCount = issues.critical.length;
    const moderateCount = issues.moderate.length;
    const lowCount = issues.low.length;

    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(10)
      .text(`Total Issues: `, 50, doc.y, { continued: true });

    if (criticalCount > 0) {
      doc.fillColor(COLORS.danger)
        .text(`${criticalCount} Critical`, { continued: true });
      doc.fillColor(COLORS.text)
        .text(', ', { continued: true });
    }
    if (moderateCount > 0) {
      doc.fillColor(COLORS.warning)
        .text(`${moderateCount} Moderate`, { continued: true });
      doc.fillColor(COLORS.text)
        .text(', ', { continued: true });
    }
    if (lowCount > 0) {
      doc.fillColor(COLORS.success)
        .text(`${lowCount} Low`);
    }

    doc.moveDown(1.5);

    // Critical issues
    if (issues.critical.length > 0) {
      doc.fillColor(COLORS.danger)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Critical Issues (Block Approval)', 50, doc.y);

      doc.moveDown(0.5);

      for (const issue of issues.critical) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 50;
        }

        this.addIssueBox(doc, issue, COLORS.danger, pageWidth);
      }
      doc.moveDown();
    }

    // Moderate issues
    if (issues.moderate.length > 0) {
      if (doc.y > 550) {
        doc.addPage();
        doc.y = 50;
      }

      doc.fillColor(COLORS.warning)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Moderate Issues (Should Address)', 50, doc.y);

      doc.moveDown(0.5);

      for (const issue of issues.moderate) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 50;
        }

        this.addIssueBox(doc, issue, COLORS.warning, pageWidth);
      }
      doc.moveDown();
    }

    // Low issues
    if (issues.low.length > 0) {
      if (doc.y > 550) {
        doc.addPage();
        doc.y = 50;
      }

      doc.fillColor(COLORS.success)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Low Issues (Suggestions)', 50, doc.y);

      doc.moveDown(0.5);

      for (const issue of issues.low) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        doc.fillColor(COLORS.primary)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`${issue.id}: ${issue.title}`, 55, doc.y);

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(8)
          .text(issue.description, 55, doc.y, { width: pageWidth - 5 });

        doc.fillColor(COLORS.textLight)
          .text(`Suggestion: ${issue.suggestion}`, 55, doc.y, { width: pageWidth - 5 });

        doc.moveDown(0.5);
      }
    }
  }

  /**
   * Add a single issue box
   */
  private addIssueBox(
    doc: typeof PDFDocument.prototype,
    issue: { id: string; title: string; description: string; impact: string; resolution: string; blocksApproval?: boolean },
    color: string,
    pageWidth: number
  ): void {
    const boxY = doc.y;

    // Issue ID and title
    doc.fillColor(color)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`${issue.id}: ${issue.title}`, 55, boxY, { width: pageWidth - 10 });

    // Description
    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(8)
      .text(issue.description, 55, doc.y, { width: pageWidth - 10 });

    // Impact and resolution
    doc.fillColor(COLORS.textLight)
      .fontSize(7)
      .text(`Impact: ${issue.impact}`, 55, doc.y, { width: pageWidth - 10 });
    doc.text(`Resolution: ${issue.resolution}`, 55, doc.y, { width: pageWidth - 10 });

    doc.moveDown();
  }

  /**
   * Add questions for homeowner section
   */
  private addQuestionsForHomeownerSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { questionsForHomeowner } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const hasQuestions = questionsForHomeowner.clarifications.length > 0 ||
      questionsForHomeowner.elaborations.length > 0 ||
      questionsForHomeowner.documentRequests.length > 0;

    if (!hasQuestions) return;

    if (doc.y > 450) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Questions for Homeowner');

    // Clarifications
    if (questionsForHomeowner.clarifications.length > 0) {
      doc.fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Clarifications Needed:', 50, doc.y);

      doc.moveDown(0.5);

      for (const q of questionsForHomeowner.clarifications) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        const priorityColor = q.priority === 'high' ? COLORS.danger :
          q.priority === 'medium' ? COLORS.warning : COLORS.textLight;

        doc.fillColor(priorityColor)
          .font('Helvetica')
          .fontSize(8)
          .text(`[${q.priority.toUpperCase()}]`, 55, doc.y, { continued: true });

        doc.fillColor(COLORS.text)
          .text(` ${q.question}`, { width: pageWidth - 40 });

        doc.fillColor(COLORS.textLight)
          .fontSize(7)
          .text(`Reason: ${q.reason} • Related to: ${q.relatedTo}`, 65, doc.y, { width: pageWidth - 15 });

        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Elaborations
    if (questionsForHomeowner.elaborations.length > 0) {
      doc.fillColor(COLORS.secondary)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Additional Details Requested:', 50, doc.y);

      doc.moveDown(0.5);

      for (const e of questionsForHomeowner.elaborations) {
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        doc.fillColor(COLORS.text)
          .font('Helvetica')
          .fontSize(8)
          .text(`• ${e.request}`, 55, doc.y, { width: pageWidth - 5 });

        doc.fillColor(COLORS.textLight)
          .fontSize(7)
          .text(`Reason: ${e.reason}`, 65, doc.y, { width: pageWidth - 15 });

        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    // Document requests
    if (questionsForHomeowner.documentRequests.length > 0) {
      doc.fillColor(COLORS.warning)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Documents Requested:', 50, doc.y);

      doc.moveDown(0.5);

      for (const d of questionsForHomeowner.documentRequests) {
        doc.fillColor(d.required ? COLORS.danger : COLORS.text)
          .font('Helvetica')
          .fontSize(8)
          .text(`${d.required ? '* ' : ''}${d.document}`, 55, doc.y, { continued: true });

        doc.fillColor(COLORS.textLight)
          .text(d.required ? ' (Required)' : ' (Optional)');

        doc.fillColor(COLORS.textLight)
          .fontSize(7)
          .text(`Reason: ${d.reason}`, 65, doc.y, { width: pageWidth - 15 });

        doc.moveDown(0.3);
      }
    }

    doc.moveDown(2);
  }

  /**
   * Add recommendations section
   */
  private addBreakdownRecommendations(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const { recommendations } = context.result;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (doc.y > 450) {
      doc.addPage();
      doc.y = 50;
    }

    this.addSectionTitle(doc, 'Final Recommendation');

    // Primary recommendation box
    const recColor = recommendations.primaryRecommendation === 'approve' ? COLORS.success :
      recommendations.primaryRecommendation === 'approve_with_conditions' ? COLORS.warning :
      recommendations.primaryRecommendation === 'request_more_info' ? COLORS.secondary : COLORS.danger;

    const boxY = doc.y;

    doc.fillColor(recColor)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(recommendations.primaryRecommendation.replace(/_/g, ' ').toUpperCase(), 50, boxY);

    doc.fillColor(COLORS.textLight)
      .font('Helvetica')
      .fontSize(9)
      .text(`Confidence: ${recommendations.confidenceLevel.toUpperCase()}`, 50, doc.y);

    doc.moveDown();

    // Reasoning
    doc.fillColor(COLORS.text)
      .font('Helvetica')
      .fontSize(10)
      .text(recommendations.reasoning, 50, doc.y, { width: pageWidth });

    doc.moveDown();

    // Conditions
    if (recommendations.conditions.length > 0) {
      doc.fillColor(COLORS.warning)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Conditions:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(9);

      for (const condition of recommendations.conditions) {
        doc.text(`• ${condition}`, 55, doc.y, { width: pageWidth - 5 });
      }
      doc.moveDown();
    }

    // Next steps
    if (recommendations.nextSteps.length > 0) {
      doc.fillColor(COLORS.secondary)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Next Steps:', 50, doc.y);

      doc.fillColor(COLORS.text)
        .font('Helvetica')
        .fontSize(9);

      recommendations.nextSteps.forEach((step, i) => {
        doc.text(`${i + 1}. ${step}`, 55, doc.y, { width: pageWidth - 5 });
      });
      doc.moveDown();
    }

    // Estimated resolution time
    if (recommendations.estimatedResolutionTime) {
      doc.fillColor(COLORS.textLight)
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text(`Estimated time to resolve: ${recommendations.estimatedResolutionTime}`, 50, doc.y);
    }
  }

  /**
   * Add property images section (breakdown report)
   */
  private addPropertyImagesSection(doc: typeof PDFDocument.prototype, context: BreakdownReportContext): void {
    const hasImages = context.satelliteImage?.base64 ||
      context.propertyBoundaryImage?.base64 ||
      context.neighborhoodContextImage?.base64;

    if (!hasImages) return;

    doc.addPage();
    doc.y = 50;

    this.addSectionTitle(doc, 'Property Images');

    // Property boundary image (primary)
    if (context.propertyBoundaryImage?.base64) {
      try {
        const imageBuffer = Buffer.from(context.propertyBoundaryImage.base64, 'base64');
        if (imageBuffer.length > 0) {
          doc.fillColor(COLORS.primary)
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('Property View with Boundary', 50, doc.y);

          doc.moveDown(0.5);

          const imageWidth = 350;
          doc.image(imageBuffer, (doc.page.width - imageWidth) / 2, doc.y, { width: imageWidth });
          doc.y += 260;

          doc.fillColor(COLORS.textLight)
            .font('Helvetica')
            .fontSize(8)
            .text(
              `Coordinates: ${context.propertyBoundaryImage.coordinates.lat.toFixed(6)}, ${context.propertyBoundaryImage.coordinates.lng.toFixed(6)}`,
              { align: 'center' }
            );

          doc.moveDown(2);
        }
      } catch (error) {
        console.error('[PdfReport] Error adding property boundary image:', error);
      }
    }

    // Neighborhood context image
    if (context.neighborhoodContextImage?.base64) {
      try {
        if (doc.y > 400) {
          doc.addPage();
          doc.y = 50;
        }

        const imageBuffer = Buffer.from(context.neighborhoodContextImage.base64, 'base64');
        if (imageBuffer.length > 0) {
          doc.fillColor(COLORS.primary)
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('Neighborhood Context', 50, doc.y);

          doc.moveDown(0.5);

          const imageWidth = 350;
          doc.image(imageBuffer, (doc.page.width - imageWidth) / 2, doc.y, { width: imageWidth });
          doc.y += 260;

          doc.moveDown();
        }
      } catch (error) {
        console.error('[PdfReport] Error adding neighborhood image:', error);
      }
    }

    // Fallback to basic satellite if no enhanced images
    if (!context.propertyBoundaryImage?.base64 && context.satelliteImage?.base64) {
      try {
        const imageBuffer = Buffer.from(context.satelliteImage.base64, 'base64');
        if (imageBuffer.length > 0) {
          doc.fillColor(COLORS.primary)
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('Satellite View', 50, doc.y);

          doc.moveDown(0.5);

          const imageWidth = 350;
          doc.image(imageBuffer, (doc.page.width - imageWidth) / 2, doc.y, { width: imageWidth });
          doc.y += 260;

          doc.fillColor(COLORS.textLight)
            .font('Helvetica')
            .fontSize(8)
            .text(
              `Coordinates: ${context.satelliteImage.coordinates.lat.toFixed(6)}, ${context.satelliteImage.coordinates.lng.toFixed(6)}`,
              { align: 'center' }
            );
        }
      } catch (error) {
        console.error('[PdfReport] Error adding satellite image:', error);
      }
    }
  }
}

// Export singleton instance
export const pdfReportService = new PdfReportService();
