/**
 * Azure Blob Storage Service
 *
 * Handles document upload, download, and management using Azure Blob Storage
 */

import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';

// For development/demo, we'll support both connection string and SAS token
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const sasToken = process.env.AZURE_STORAGE_SAS_TOKEN;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;

export interface UploadResult {
  blobName: string;
  containerName: string;
  url: string;
  contentType: string;
  size: number;
}

export interface DownloadUrlOptions {
  expiresInMinutes?: number; // For SAS URLs
}

class AzureBlobStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      if (connectionString) {
        // Production: Use connection string
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.isConfigured = true;
        console.log('✓ Azure Blob Storage initialized with connection string');
      } else if (sasToken && accountName) {
        // Alternative: Use SAS token
        const blobServiceUrl = `https://${accountName}.blob.core.windows.net?${sasToken}`;
        this.blobServiceClient = new BlobServiceClient(blobServiceUrl);
        this.isConfigured = true;
        console.log('✓ Azure Blob Storage initialized with SAS token');
      } else {
        console.warn('⚠ Azure Blob Storage not configured. Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_SAS_TOKEN');
        this.isConfigured = false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Azure Blob Storage:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if Azure Blob Storage is configured
   */
  public isAvailable(): boolean {
    return this.isConfigured && this.blobServiceClient !== null;
  }

  /**
   * Get or create a container
   */
  private async getContainerClient(containerName: string): Promise<ContainerClient> {
    if (!this.blobServiceClient) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = this.blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist (idempotent)
    try {
      await containerClient.createIfNotExists({
        access: 'blob', // Public read access for blobs (not container listing)
      });
    } catch (error: any) {
      // Ignore if container already exists
      if (error.statusCode !== 409) {
        throw error;
      }
    }

    return containerClient;
  }

  /**
   * Upload a file to Azure Blob Storage
   * @param blobPath Full blob path including filename (e.g., "tenantId/appId/docId.pdf")
   */
  public async uploadFile(
    containerName: string,
    buffer: Buffer,
    originalFileName: string,
    contentType: string,
    blobPath: string // Full path: "tenantId/applicationId/documentId.ext"
  ): Promise<UploadResult> {
    if (!this.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured. Please set environment variables.');
    }

    const containerClient = await this.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    // Upload with content type
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    return {
      blobName: blobPath, // Return the full path
      containerName,
      url: blockBlobClient.url,
      contentType,
      size: buffer.length,
    };
  }

  /**
   * Get download URL for a blob
   */
  public async getDownloadUrl(
    containerName: string,
    blobName: string,
    options: DownloadUrlOptions = {}
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // For public containers, just return the URL
    // For private containers, you'd generate a SAS token here
    return blockBlobClient.url;
  }

  /**
   * Download a file from Azure Blob Storage
   */
  public async downloadFile(
    containerName: string,
    blobName: string
  ): Promise<Buffer> {
    if (!this.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file: no stream body');
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  public async deleteFile(
    containerName: string,
    blobName: string
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();
  }

  /**
   * Check if a blob exists
   */
  public async blobExists(
    containerName: string,
    blobName: string
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const containerClient = await this.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch {
      return false;
    }
  }

  /**
   * List blobs under a specific path prefix (virtual folder)
   * Useful for listing all documents for a tenant or application
   */
  public async listBlobsByPrefix(
    containerName: string,
    prefix: string
  ): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
    if (!this.isAvailable()) {
      throw new Error('Azure Blob Storage is not configured');
    }

    const containerClient = await this.getContainerClient(containerName);
    const blobs: Array<{ name: string; size: number; lastModified: Date }> = [];

    // List blobs with prefix
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength || 0,
        lastModified: blob.properties.lastModified || new Date(),
      });
    }

    return blobs;
  }
}

// Export singleton instance
export const azureBlobStorage = new AzureBlobStorageService();
