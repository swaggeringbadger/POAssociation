# QR Code Mobile Document Upload Feature

## Overview

A revolutionary document upload experience that allows users to scan a QR code on their desktop and instantly upload documents from their phone with a secure, time-limited link.

## Features

✅ **Secure Upload Tokens** - Cryptographically secure 64-character tokens that cannot be guessed
✅ **Time-Limited Access** - 10-minute expiration window for security
✅ **Real-Time Updates** - Desktop shows upload progress via polling
✅ **Mobile-Optimized** - Beautiful, responsive upload page for mobile devices
✅ **Single-Use Links** - Tokens automatically invalidated after use
✅ **Per-Document QR Codes** - Each document requirement gets its own unique QR code

## Architecture

### Database Schema

**New Table: `document_upload_tokens`**
- `id` (UUID) - Primary key
- `token` (text) - 64-char hex cryptographic token
- `applicationId` (UUID) - Associated application
- `documentRequirementName` (text) - Which document this is for
- `expiresAt` (timestamp) - 10 minutes from creation
- `isUsed` (boolean) - Single-use flag
- `uploadedDocumentId` (UUID) - Link to uploaded document
- `createdByUserId` (UUID) - Who created the token
- `createdAt` / `usedAt` timestamps

### Backend API Endpoints

#### 1. Generate Upload Token
```
POST /api/applications/:applicationId/upload-token
Body: { documentRequirementName: string }
Response: { token, uploadUrl, expiresAt, expiresInMs }
```

#### 2. Validate Token
```
GET /api/upload/:token
Response: { documentRequirement, applicationTitle, applicationNumber, expiresAt, isValid }
```

#### 3. Upload via Token
```
POST /api/upload/:token
Body: FormData with file
Response: { success, document }
```

#### 4. Check Upload Status (for polling)
```
GET /api/upload/:token/status
Response: { isUsed, isExpired, uploadedDocumentId, usedAt }
```

### Frontend Components

#### 1. QRCodeUploadDialog.tsx
Desktop component that:
- Generates secure upload token
- Displays QR code (using `qrcode` library)
- Shows countdown timer
- Polls for upload completion every 2 seconds
- Displays success message when document uploaded

#### 2. MobileDocumentUpload.tsx
Mobile-optimized page (`/upload/:token`) that:
- Validates token on load
- Shows application context
- Provides simple file picker
- Handles upload with progress
- Shows success confirmation

#### 3. DocumentUpload.tsx Updates
Enhanced with:
- "Upload from Phone" button for each document
- QR code dialog integration
- Real-time document list refresh on upload

## User Flow

### Desktop Experience

1. User clicks "Upload from Phone" button next to a document requirement
2. QR code dialog opens with secure upload link
3. Timer counts down from 10:00
4. "Waiting for upload from phone..." spinner shows
5. When phone completes upload, desktop shows success message
6. Dialog closes and document appears in list

### Mobile Experience

1. User scans QR code with phone camera
2. Opens link in browser (no auth required)
3. Sees application context and document requirement
4. Taps to select file from phone
5. Uploads with progress bar
6. Sees success confirmation
7. Can close page

## Security Features

1. **Crypto-Random Tokens**: Uses Node.js `crypto.randomBytes(32).toString('hex')`
2. **Time-Limited**: 10-minute expiration enforced server-side
3. **Single-Use**: Token marked as used after successful upload
4. **Automatic Cleanup**: Expired tokens can be purged via `storage.cleanupExpiredTokens()`
5. **No Authentication Required**: But token links to authenticated user's application

## File Structure

```
server/
├── schema.ts                    # Added documentUploadTokens table
├── storage.ts                   # Added token CRUD methods
├── routes.ts                    # Added 4 new endpoints
└── prompts/                     # (bonus: prompt externalization)
    ├── system-prompt.md
    └── user-prompt.md

client/src/
├── components/
│   ├── QRCodeUploadDialog.tsx   # Desktop QR code display
│   └── DocumentUpload.tsx       # Enhanced with phone upload button
├── pages/
│   └── MobileDocumentUpload.tsx # Mobile upload page
├── lib/
│   └── api.ts                   # Added 4 new API methods
└── App.tsx                      # Added /upload/:token route

package.json                      # Added qrcode + @types/qrcode
```

## Testing

### To Test the Feature:

1. **Start the app**: `npm run dev`

2. **Create an application**:
   - Go to /apply
   - Fill out project details
   - Navigate to Documents step

3. **Test QR Code Flow**:
   - Click "Upload from Phone" button
   - QR code appears with 10-minute timer
   - Scan with phone camera
   - Upload a test document from phone
   - Desktop automatically shows uploaded document

### Mobile Testing URLs

Get a token from the desktop flow, then test mobile page directly:
```
http://localhost:5000/upload/{token}
```

## Code Highlights

### Secure Token Generation
```typescript
const token = crypto.randomBytes(32).toString('hex');
const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
```

### Real-Time Polling
```typescript
pollingInterval.current = setInterval(async () => {
  const status = await api.checkUploadTokenStatus(token);
  if (status.isUsed) {
    setIsUploaded(true);
    stopPolling();
    onUploadComplete();
  }
}, 2000);
```

### QR Code Generation
```typescript
const qrDataUrl = await QRCode.toDataURL(uploadUrl, {
  width: 300,
  margin: 2,
  color: { dark: '#000000', light: '#FFFFFF' }
});
```

## Future Enhancements

- [ ] WebSocket support for instant updates (replace polling)
- [ ] Bulk upload support (multiple docs at once)
- [ ] Upload progress on desktop (not just mobile)
- [ ] Email/SMS link option (alternative to QR code)
- [ ] Token reuse prevention (mark as used immediately on first access)
- [ ] Analytics (track QR code usage rates)
- [ ] Automatic token cleanup cron job

## Benefits

1. **No App Required**: Works with native phone camera
2. **Secure**: Unguessable tokens with time limits
3. **Fast**: Direct upload from phone to server
4. **User-Friendly**: Natural workflow for phone-stored documents
5. **Desktop Context**: User stays on desktop, phone is just for upload

## Technical Notes

- Tokens stored in PostgreSQL with indexed lookups
- QR codes generated client-side (no server cost)
- Mobile page works without authentication
- Upload credited to desktop user (token creator)
- Polling interval: 2 seconds (configurable)
- Max file size: 50MB (configurable)

## Accessibility

- QR code has proper alt text
- Mobile page works with screen readers
- Large touch targets on mobile
- Clear error messages
- Countdown timer for urgency

## Browser Compatibility

- QR code scanning: iOS 11+, Android 8+
- QR code generation: All modern browsers
- File upload: All mobile browsers
- Tested on: iPhone Safari, Chrome Android

---

**Status**: ✅ Complete and Production Ready

**Build**: ✅ Passing (`npm run build`)

**Database**: ✅ Schema migrated (`npm run db:push`)
