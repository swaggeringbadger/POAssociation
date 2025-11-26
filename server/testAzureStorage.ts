/**
 * Test script for Azure Blob Storage GUID-based document upload
 *
 * Tests:
 * 1. Azure Storage availability
 * 2. Document upload with GUID-based path
 * 3. Path precalculation and storage
 * 4. Document download
 * 5. Document deletion
 * 6. Cleanup
 */

import { azureBlobStorage } from './azureBlobStorage.js';
import { storage } from './storage.js';
import crypto from 'crypto';

async function testAzureStorage() {
  console.log('🧪 Testing Azure Blob Storage Implementation\n');

  try {
    // Test 1: Check if Azure Storage is available
    console.log('1️⃣  Checking Azure Blob Storage availability...');
    if (!azureBlobStorage.isAvailable()) {
      throw new Error('❌ Azure Blob Storage is not configured. Please set AZURE_STORAGE_CONNECTION_STRING');
    }
    console.log('   ✅ Azure Blob Storage is available\n');

    // Test 2: Create test data
    console.log('2️⃣  Creating test data...');
    const tenantId = 'test-tenant-' + crypto.randomUUID();
    const applicationId = 'test-app-' + crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const fileExtension = 'txt';
    const fileName = 'test-document.txt';
    const fileContent = 'This is a test document for Azure Blob Storage with GUID-based paths.';
    const buffer = Buffer.from(fileContent, 'utf-8');

    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Application ID: ${applicationId}`);
    console.log(`   Document ID: ${documentId}`);
    console.log('   ✅ Test data created\n');

    // Test 3: Construct GUID-based path (precalculation)
    console.log('3️⃣  Constructing GUID-based path...');
    const blobPath = `${tenantId}/${applicationId}/${documentId}.${fileExtension}`;
    console.log(`   Path: ${blobPath}`);
    console.log('   ✅ Path precalculated\n');

    // Test 4: Upload file to Azure Blob Storage
    console.log('4️⃣  Uploading test document to Azure...');
    const uploadResult = await azureBlobStorage.uploadFile(
      'application-documents',
      buffer,
      fileName,
      'text/plain',
      blobPath
    );
    console.log(`   Container: ${uploadResult.containerName}`);
    console.log(`   Blob Name: ${uploadResult.blobName}`);
    console.log(`   URL: ${uploadResult.url}`);
    console.log(`   Size: ${uploadResult.size} bytes`);
    console.log('   ✅ Upload successful\n');

    // Test 5: Verify blob exists
    console.log('5️⃣  Verifying blob exists in Azure...');
    const exists = await azureBlobStorage.blobExists('application-documents', blobPath);
    if (!exists) {
      throw new Error('❌ Blob does not exist after upload');
    }
    console.log('   ✅ Blob exists in Azure\n');

    // Test 6: Download file from Azure Blob Storage
    console.log('6️⃣  Downloading test document from Azure...');
    const downloadedBuffer = await azureBlobStorage.downloadFile('application-documents', blobPath);
    const downloadedContent = downloadedBuffer.toString('utf-8');
    if (downloadedContent !== fileContent) {
      throw new Error('❌ Downloaded content does not match uploaded content');
    }
    console.log(`   Downloaded ${downloadedBuffer.length} bytes`);
    console.log(`   Content matches: "${downloadedContent}"`);
    console.log('   ✅ Download successful\n');

    // Test 7: Get download URL
    console.log('7️⃣  Getting download URL...');
    const downloadUrl = await azureBlobStorage.getDownloadUrl('application-documents', blobPath);
    console.log(`   URL: ${downloadUrl}`);
    console.log('   ✅ Download URL retrieved\n');

    // Test 8: List blobs by prefix (tenant level)
    console.log('8️⃣  Listing blobs for tenant...');
    const tenantBlobs = await azureBlobStorage.listBlobsByPrefix('application-documents', tenantId);
    console.log(`   Found ${tenantBlobs.length} blob(s) for tenant`);
    tenantBlobs.forEach(blob => {
      console.log(`   - ${blob.name} (${blob.size} bytes)`);
    });
    console.log('   ✅ List blobs successful\n');

    // Test 9: List blobs by prefix (application level)
    console.log('9️⃣  Listing blobs for application...');
    const appBlobs = await azureBlobStorage.listBlobsByPrefix(
      'application-documents',
      `${tenantId}/${applicationId}`
    );
    console.log(`   Found ${appBlobs.length} blob(s) for application`);
    appBlobs.forEach(blob => {
      console.log(`   - ${blob.name} (${blob.size} bytes)`);
    });
    console.log('   ✅ List blobs successful\n');

    // Test 10: Delete file from Azure Blob Storage
    console.log('🔟 Deleting test document from Azure...');
    await azureBlobStorage.deleteFile('application-documents', blobPath);
    console.log('   ✅ Delete successful\n');

    // Test 11: Verify blob no longer exists
    console.log('1️⃣1️⃣  Verifying blob was deleted...');
    const stillExists = await azureBlobStorage.blobExists('application-documents', blobPath);
    if (stillExists) {
      throw new Error('❌ Blob still exists after deletion');
    }
    console.log('   ✅ Blob successfully deleted\n');

    // All tests passed
    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log('   - Azure Storage: Available');
    console.log('   - GUID-based path construction: Working');
    console.log('   - Upload: Working');
    console.log('   - Download: Working');
    console.log('   - List by prefix: Working');
    console.log('   - Delete: Working');
    console.log('   - Cleanup: Complete');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testAzureStorage().then(() => {
  console.log('\n✅ Test script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
