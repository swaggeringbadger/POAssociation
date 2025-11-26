# Azure Blob Storage Document Organization

## Container Structure

All application documents are stored in a single container with a hierarchical folder structure using virtual directories (blob path prefixes).

### Container: `application-documents`

```
application-documents/
├── a1b2c3d4-e5f6-7890-abcd-ef1234567890/        # Tenant GUID
│   ├── b2c3d4e5-f6a7-8901-bcde-f12345678901/    # Application GUID
│   │   ├── c3d4e5f6-a7b8-9012-cdef-123456789012.pdf    # Document GUID
│   │   ├── d4e5f6a7-b890-1234-def0-123456789012.pdf
│   │   └── e5f6a7b8-9012-3456-ef01-234567890123.jpg
│   ├── f6a7b890-1234-5678-0123-456789012345/
│   │   ├── a7b89012-3456-7890-1234-567890123456.pdf
│   │   └── b8901234-5678-9012-3456-789012345678.pdf
│   └── c9012345-6789-0123-4567-890123456789/
│       └── d0123456-7890-1234-5678-901234567890.pdf
│
├── e1234567-8901-2345-6789-012345678901/        # Another tenant GUID
│   ├── f2345678-9012-3456-7890-123456789012/
│   │   ├── a3456789-0123-4567-8901-234567890123.pdf
│   │   └── b4567890-1234-5678-9012-345678901234.pdf
│   └── c5678901-2345-6789-0123-456789012345/
│       └── d6789012-3456-7890-1234-567890123456.pdf
```

## Path Construction

The path for each document is constructed using GUIDs and **precalculated at upload time** to avoid runtime reassembly:

```
{tenant-guid}/{application-guid}/{document-guid}.{extension}
```

All path components use database GUIDs, not human-readable names. The full path is stored in the `blob_path` column of the `documents` table.

### Examples:

1. **Community Application:**
   - Tenant ID: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - Application ID: `b2c3d4e5-f6a7-8901-bcde-f12345678901`
   - Document ID: `c3d4e5f6-a7b8-9012-cdef-123456789012`
   - File: `Color Samples.pdf` (extension: `.pdf`)
   - Path: `a1b2c3d4-e5f6-7890-abcd-ef1234567890/b2c3d4e5-f6a7-8901-bcde-f12345678901/c3d4e5f6-a7b8-9012-cdef-123456789012.pdf`

2. **Management Company Application:**
   - Tenant ID: `e1234567-8901-2345-6789-012345678901`
   - Application ID: `f2345678-9012-3456-7890-123456789012`
   - Document ID: `a3456789-0123-4567-8901-234567890123`
   - File: `Architectural Plans (Updated).pdf` (extension: `.pdf`)
   - Path: `e1234567-8901-2345-6789-012345678901/f2345678-9012-3456-7890-123456789012/a3456789-0123-4567-8901-234567890123.pdf`

## Benefits of This Structure

### 1. **Organized by Community**
- Easy to browse documents for a specific community
- Can set access policies per community (future enhancement)
- Clear separation between different organizations

### 2. **Organized by Application**
- All documents for an application are grouped together
- Easy to find related documents
- Simple to download entire application package
- Easy to delete all documents when application is deleted (cascade)

### 3. **Scalable for Future Use Cases**
- Can add other containers for different document types:
  - `user-profiles` - Profile pictures, ID documents
  - `community-assets` - Logos, policy documents, newsletters
  - `form-templates` - Template files for forms
  - `reports` - Generated reports and exports
  - `system-backups` - Automated backups

### 4. **Azure Portal Friendly**
- Shows as folders in Azure Storage Explorer
- Easy to navigate and browse
- Can view documents by tenant in the portal
- Can set lifecycle management policies per "folder"

### 5. **Permission Management Ready**
- Can create SAS tokens with prefix restrictions
- Can limit access to specific tenant folders
- Can implement role-based access at folder level

## Implementation Details

### Upload Process

```typescript
// routes.ts

// 1. Generate document ID first (for use in blob path)
const documentId = crypto.randomUUID();

// 2. Extract file extension
const fileExtension = file.originalname.split('.').pop() || '';

// 3. Construct GUID-based path - PRECALCULATED at upload time
const blobPath = `${application.tenantId}/${applicationId}/${documentId}.${fileExtension}`;

// 4. Upload to Azure with precalculated path
const uploadResult = await azureBlobStorage.uploadFile(
  'application-documents',
  file.buffer,
  file.originalname,
  file.mimetype,
  blobPath  // Full path already constructed
);

// 5. Store document with precalculated path
const document = await storage.createDocument({
  id: documentId,           // Use the same GUID we generated
  applicationId,
  fileName: file.originalname,
  blobPath: blobPath,       // Store the precalculated path
  containerName: uploadResult.containerName,
  fileSize: uploadResult.size,
  mimeType: uploadResult.contentType,
  uploadedByUserId: userId,
  demoCodeId: application.demoCodeId,
});
```

### Path Precalculation

**Key Design Decision:** Paths are generated once at upload time and stored in the database. This avoids:
- Runtime path reassembly from multiple database lookups
- Performance overhead of joining tenant/application/document tables
- Potential inconsistencies if GUIDs change

```typescript
// Path is precalculated once:
const blobPath = `${tenantId}/${applicationId}/${documentId}.${ext}`;

// And used directly for all operations:
await azureBlobStorage.downloadFile(containerName, document.blobPath);
await azureBlobStorage.deleteFile(containerName, document.blobPath);
```

### Database Storage

The full blob path is stored in the `blob_path` column:
```typescript
{
  id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
  blobPath: "a1b2c3d4-e5f6-7890-abcd-ef1234567890/b2c3d4e5-f6a7-8901-bcde-f12345678901/c3d4e5f6-a7b8-9012-cdef-123456789012.pdf",
  containerName: "application-documents",
  fileName: "Color Samples.pdf"  // Original filename preserved for display
}
```

## Querying Documents

### List All Documents for an Application
```typescript
// From database (recommended - fast, with metadata)
const docs = await storage.listDocumentsByApplication(applicationId);
// Returns: [{ id, blobPath, fileName, fileSize, mimeType, uploadedAt, ... }]

// From Azure directly (slower, but shows all blobs even if not in DB)
const blobs = await azureBlobStorage.listBlobsByPrefix(
  'application-documents',
  `${tenantId}/${applicationId}`  // Use GUIDs for prefix
);
```

### List All Documents for a Tenant
```typescript
const blobs = await azureBlobStorage.listBlobsByPrefix(
  'application-documents',
  tenantId  // Use tenant GUID as prefix
);
```

### Download/Delete Operations
```typescript
// Get document from database
const document = await storage.getDocument(documentId);

// Download using stored path (no reassembly needed)
const url = await azureBlobStorage.getDownloadUrl(
  document.containerName,
  document.blobPath  // Use precalculated path directly
);

// Delete using stored path
await azureBlobStorage.deleteFile(
  document.containerName,
  document.blobPath  // Use precalculated path directly
);
```

## Lifecycle Management

Azure Blob Storage lifecycle policies can be configured to:

1. **Archive old applications** - Move documents older than X months to Cool/Archive tier
2. **Auto-delete drafts** - Delete documents for applications in "draft" status after 30 days
3. **Compliance retention** - Keep documents for approved applications for required period
4. **Cost optimization** - Move infrequently accessed documents to cheaper storage tiers

Example policy (configured in Azure Portal or via ARM templates):
```json
{
  "rules": [
    {
      "name": "archive-old-applications",
      "enabled": true,
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["application-documents/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 90 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 365 }
          }
        }
      }
    }
  ]
}
```

## Future Enhancements

### 1. **Versioning**
Enable blob versioning to keep history of document updates:
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890/b2c3d4e5-f6a7-8901-bcde-f12345678901/
  └── c3d4e5f6-a7b8-9012-cdef-123456789012.pdf
      ├── version-1 (original)
      ├── version-2 (revised)
      └── version-3 (final)
```

### 2. **Soft Delete**
Enable soft delete to recover accidentally deleted documents (30-day retention).

### 3. **Access Tiers**
Automatically move old documents to Cool or Archive tier:
- Hot: Active applications (frequent access)
- Cool: Completed applications < 1 year (occasional access)
- Archive: Completed applications > 1 year (rare access, lowest cost)

### 4. **CDN Integration**
Add Azure CDN for frequently accessed documents (logos, shared templates).

### 5. **Search Integration**
Add Azure Cognitive Search to enable full-text search across all documents.

## Configuration

### Environment Variables

```bash
# Option 1: Connection String (Recommended for production)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=poaassociation;AccountKey=...;EndpointSuffix=core.windows.net

# Option 2: SAS Token (For restricted access scenarios)
AZURE_STORAGE_ACCOUNT_NAME=poaassociation
AZURE_STORAGE_SAS_TOKEN=?sv=2021-06-08&ss=b&srt=sco&sp=rwdlac&se=...
```

### Container Access Level
- **Recommended:** Private (blob) - Blobs accessible via URL with authentication
- **Alternative:** Public (blob) - Blobs publicly accessible (not recommended for sensitive documents)

## Monitoring

Track storage metrics:
- Total storage used per tenant (prefix)
- Upload/download bandwidth per tenant
- Failed uploads/downloads
- Storage costs per tenant

Query example (Azure Monitor):
```kusto
StorageBlobLogs
| where AccountName == "poaassociation"
| where Uri startswith "https://poaassociation.blob.core.windows.net/application-documents/"
| extend Tenant = split(Uri, '/')[4]
| summarize Uploads=count(), TotalBytes=sum(ResponseBodySize) by Tenant
```
