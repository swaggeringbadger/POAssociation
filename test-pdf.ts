import { pdfReportService } from './server/services/pdfReportService';
import { storage } from './server/storage';
import * as fs from 'fs';

async function testPdf() {
  // Get analysis from DB
  const analysis = await storage.getAiAnalysis('c0b312f7-69a3-44af-b54a-20639a77a9fd');
  if (!analysis) {
    console.log('Analysis not found');
    return;
  }

  console.log('Analysis status:', analysis.status);
  console.log('Compliance score:', analysis.complianceScore);
  console.log('Has bylawCompliance:', !!analysis.bylawCompliance);
  console.log('Bylaw compliance type:', typeof analysis.bylawCompliance);
  console.log('Bylaw compliance array?:', Array.isArray(analysis.bylawCompliance));
  console.log('Bylaw compliance length:', (analysis.bylawCompliance as any[])?.length);
  console.log('Risk assessment length:', (analysis.riskAssessment as any[])?.length);
  console.log('Questions length:', (analysis.questionsConcerns as any[])?.length);
  console.log('Recommendations length:', (analysis.recommendations as any[])?.length);

  // Get application
  const application = await storage.getApplication(analysis.applicationId);
  if (!application) {
    console.log('Application not found');
    return;
  }

  // Get tenant
  const tenant = await storage.getTenant(analysis.tenantId);
  if (!tenant) {
    console.log('Tenant not found');
    return;
  }

  console.log('\nBuilding report context...');

  const reportContext = {
    analysis,
    result: {
      complianceScore: analysis.complianceScore!,
      riskLevel: analysis.riskLevel as 'low' | 'medium' | 'high' | 'critical',
      overallSummary: analysis.overallSummary!,
      bylawCompliance: analysis.bylawCompliance as any[] || [],
      riskAssessment: analysis.riskAssessment as any[] || [],
      questionsConcerns: analysis.questionsConcerns as any[] || [],
      recommendations: analysis.recommendations as any[] || [],
    },
    application: {
      applicationNumber: application.applicationNumber || '',
      projectType: application.projectType || '',
      title: application.title || '',
      description: application.description || '',
      propertyAddress: application.propertyAddress || '',
      submittedAt: application.submittedAt || new Date(),
    },
    tenant: {
      name: tenant.name,
    },
  };

  console.log('Report context result:');
  console.log('  complianceScore:', reportContext.result.complianceScore);
  console.log('  riskLevel:', reportContext.result.riskLevel);
  console.log('  overallSummary:', reportContext.result.overallSummary?.slice(0, 100) + '...');
  console.log('  bylawCompliance count:', reportContext.result.bylawCompliance.length);
  console.log('  riskAssessment count:', reportContext.result.riskAssessment.length);
  console.log('  questionsConcerns count:', reportContext.result.questionsConcerns.length);
  console.log('  recommendations count:', reportContext.result.recommendations.length);

  // Check first bylaw
  if (reportContext.result.bylawCompliance.length > 0) {
    console.log('\n  First bylaw:');
    console.log('    sectionReference:', reportContext.result.bylawCompliance[0].sectionReference);
    console.log('    compliant:', reportContext.result.bylawCompliance[0].compliant);
    console.log('    explanation:', reportContext.result.bylawCompliance[0].explanation?.slice(0, 100) + '...');
  }

  console.log('\nGenerating PDF...');
  try {
    const pdfBuffer = await pdfReportService.generateReport(reportContext as any);
    console.log('PDF generated successfully!');
    console.log('PDF size:', pdfBuffer.length, 'bytes');

    // Save to temp file for inspection
    fs.writeFileSync('/tmp/test-analysis-report.pdf', pdfBuffer);
    console.log('PDF saved to /tmp/test-analysis-report.pdf');
  } catch (error) {
    console.error('PDF generation error:', error);
  }

  process.exit(0);
}

testPdf().catch(console.error);
