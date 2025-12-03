import { azureBlobStorage } from './server/azureBlobStorage';
import * as fs from 'fs';

async function testDownload() {
  const analysisId = 'c0b312f7-69a3-44af-b54a-20639a77a9fd';

  console.log('Azure available:', azureBlobStorage.isAvailable());

  // Get analysis tenant/application info from DB
  const { storage } = await import('./server/storage');
  const analysis = await storage.getAiAnalysis(analysisId);

  if (!analysis) {
    console.log('Analysis not found');
    return;
  }

  const blobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-report.pdf`;
  console.log('Blob path:', blobPath);

  try {
    const buffer = await azureBlobStorage.downloadFile('ai-analysis-reports', blobPath);
    console.log('Downloaded PDF size:', buffer.length, 'bytes');

    fs.writeFileSync('/tmp/downloaded-analysis-report.pdf', buffer);
    console.log('Saved to /tmp/downloaded-analysis-report.pdf');
  } catch (error) {
    console.error('Download error:', error);
  }

  process.exit(0);
}

testDownload().catch(console.error);
