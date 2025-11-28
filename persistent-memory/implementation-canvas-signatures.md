# Implementation: Canvas Signatures & Initials

**Created:** 2025-11-28
**Status:** In Progress
**Complexity:** Medium
**Estimated Time:** 4-6 hours

---

## 📋 Overview

Implement canvas-based drawn signatures for:
1. **Signatures** - Required when submitting new applications
2. **Initials** - Required when editing/modifying existing applications

---

## 🎯 Requirements

### Signature Requirements (New Applications)
- User draws signature on canvas at final step of application wizard
- Signature saved as image in Azure Blob Storage
- Full audit trail: timestamp, IP address, user agent, document hash
- Consent checkbox: "I consent to use electronic signatures"
- Legal text: "By signing below, you certify all information is accurate"
- Display signature on application detail page
- Include signature in PDF reports/exports

### Initial Requirements (Application Edits)
- User provides initials when saving application edits
- Smaller canvas (initials are typically smaller than full signatures)
- Linked to specific edit record in application_edits table
- Audit trail same as signatures
- Display all initials with edit history
- Each edit gets its own initial

### Shared Requirements
- Both use same underlying component (different sizes)
- Both stored in same database table with "type" discriminator
- Both support "Clear" button to redraw
- Both require non-empty canvas before submission
- Both saved as PNG images in Azure Blob Storage

---

## 🗄️ Database Schema

### New Table: `signatures`

```sql
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was signed
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  application_edit_id UUID REFERENCES application_edits(id) ON DELETE CASCADE,
    -- NULL for original submission, populated for edits

  -- Who signed
  signed_by UUID NOT NULL REFERENCES users(id),
  signed_by_name VARCHAR(255) NOT NULL, -- Cached for display
  signed_by_email VARCHAR(255) NOT NULL, -- Cached for display

  -- Type of signature
  type VARCHAR(20) NOT NULL CHECK (type IN ('signature', 'initial')),

  -- Signature data
  signature_image_url TEXT NOT NULL, -- Azure Blob Storage URL
  signature_data_url TEXT, -- Base64 data URL (optional, for backup)

  -- Audit trail
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  document_hash VARCHAR(64), -- SHA-256 hash of application data at time of signing

  -- Consent
  consent_text TEXT NOT NULL, -- What they agreed to
  consent_given BOOLEAN NOT NULL DEFAULT true,

  -- Demo support
  demo_code_id UUID REFERENCES demo_codes(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signatures_application_id ON signatures(application_id);
CREATE INDEX idx_signatures_application_edit_id ON signatures(application_edit_id);
CREATE INDEX idx_signatures_signed_by ON signatures(signed_by);
CREATE INDEX idx_signatures_type ON signatures(type);
CREATE INDEX idx_signatures_signed_at ON signatures(signed_at DESC);
```

### Update Existing Table: `applications`

```sql
-- Add reference to primary signature
ALTER TABLE applications ADD COLUMN signature_id UUID REFERENCES signatures(id);
CREATE INDEX idx_applications_signature_id ON applications(signature_id);
```

### Update Existing Table: `application_edits`

```sql
-- Add reference to initial
ALTER TABLE application_edits ADD COLUMN initial_id UUID REFERENCES signatures(id);
CREATE INDEX idx_application_edits_initial_id ON application_edits(initial_id);
```

---

## 📦 Implementation Steps

### Step 1: Update Shared Schema

**File:** `shared/schema.ts`

**Tasks:**
- [ ] Add `signatures` table definition
- [ ] Add foreign key relations
- [ ] Add indexes
- [ ] Export TypeScript types
- [ ] Update `applications` table to add `signatureId` column
- [ ] Update `applicationEdits` table to add `initialId` column

**Code:**

```typescript
export const signatures = pgTable('signatures', {
  id: uuid('id').primaryKey().defaultRandom(),

  // What was signed
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  applicationEditId: uuid('application_edit_id').references(() => applicationEdits.id, { onDelete: 'cascade' }),

  // Who signed
  signedBy: uuid('signed_by').notNull().references(() => users.id),
  signedByName: varchar('signed_by_name', { length: 255 }).notNull(),
  signedByEmail: varchar('signed_by_email', { length: 255 }).notNull(),

  // Type
  type: varchar('type', { length: 20 }).notNull(), // 'signature' | 'initial'

  // Signature data
  signatureImageUrl: text('signature_image_url').notNull(),
  signatureDataUrl: text('signature_data_url'),

  // Audit trail
  signedAt: timestamp('signed_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  documentHash: varchar('document_hash', { length: 64 }),

  // Consent
  consentText: text('consent_text').notNull(),
  consentGiven: boolean('consent_given').notNull().default(true),

  // Demo support
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Signature = typeof signatures.$inferSelect;
export type NewSignature = typeof signatures.$inferInsert;

// Update applications table
export const applications = pgTable('applications', {
  // ... existing fields ...
  signatureId: uuid('signature_id').references(() => signatures.id),
});

// Update applicationEdits table
export const applicationEdits = pgTable('application_edits', {
  // ... existing fields ...
  initialId: uuid('initial_id').references(() => signatures.id),
});
```

**Verification:**
```bash
npm run db:push
# Should see: "signatures" table created
# Should see: "applications" table updated with signature_id
# Should see: "application_edits" table updated with initial_id
```

---

### Step 2: Install Dependencies

**File:** `package.json`

**Tasks:**
- [ ] Install `react-signature-canvas` library
- [ ] Install types for TypeScript support

**Commands:**
```bash
npm install react-signature-canvas
npm install --save-dev @types/react-signature-canvas
```

**Verification:**
```bash
npm list react-signature-canvas
# Should show version ~1.0.6 or higher
```

---

### Step 3: Backend Storage Methods

**File:** `server/storage.ts`

**Tasks:**
- [ ] Add `createSignature()` method to IStorage interface
- [ ] Add `getSignature()` method
- [ ] Add `getApplicationSignature()` method
- [ ] Add `getEditInitials()` method
- [ ] Implement all methods in DbStorage class

**Code:**

```typescript
// Add to IStorage interface
interface IStorage {
  // ... existing methods ...

  // Signature methods
  createSignature(data: schema.NewSignature): Promise<schema.Signature>;
  getSignature(id: string): Promise<schema.Signature | null>;
  getApplicationSignature(applicationId: string): Promise<schema.Signature | null>;
  getEditInitials(applicationEditId: string): Promise<schema.Signature | null>;
  listApplicationSignatures(applicationId: string): Promise<schema.Signature[]>;
}

// Implement in DbStorage class
class DbStorage implements IStorage {
  // ... existing methods ...

  async createSignature(data: schema.NewSignature): Promise<schema.Signature> {
    const [signature] = await db
      .insert(schema.signatures)
      .values(data)
      .returning();

    if (!signature) {
      throw new Error('Failed to create signature');
    }

    return signature;
  }

  async getSignature(id: string): Promise<schema.Signature | null> {
    const [signature] = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.id, id))
      .limit(1);

    return signature || null;
  }

  async getApplicationSignature(applicationId: string): Promise<schema.Signature | null> {
    const [signature] = await db
      .select()
      .from(schema.signatures)
      .where(
        and(
          eq(schema.signatures.applicationId, applicationId),
          eq(schema.signatures.type, 'signature')
        )
      )
      .orderBy(desc(schema.signatures.signedAt))
      .limit(1);

    return signature || null;
  }

  async getEditInitials(applicationEditId: string): Promise<schema.Signature | null> {
    const [initial] = await db
      .select()
      .from(schema.signatures)
      .where(
        and(
          eq(schema.signatures.applicationEditId, applicationEditId),
          eq(schema.signatures.type, 'initial')
        )
      )
      .limit(1);

    return initial || null;
  }

  async listApplicationSignatures(applicationId: string): Promise<schema.Signature[]> {
    return await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.applicationId, applicationId))
      .orderBy(desc(schema.signatures.signedAt));
  }
}
```

---

### Step 4: Backend API Endpoints

**File:** `server/routes.ts`

**Tasks:**
- [ ] Add POST `/api/signatures` endpoint
- [ ] Add GET `/api/signatures/:id` endpoint
- [ ] Add GET `/api/applications/:id/signature` endpoint
- [ ] Add authentication middleware to all endpoints
- [ ] Add permission checks (only owner can create)

**Code:**

```typescript
// Helper function to get client IP
function getClientIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.ip ||
    'unknown'
  );
}

// Helper function to calculate document hash
function calculateDocumentHash(data: any): string {
  const crypto = require('crypto');
  const content = JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// POST /api/signatures - Create new signature
app.post('/api/signatures', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id || req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const {
      applicationId,
      applicationEditId,
      type,
      signatureDataUrl,
      consentText,
      documentData,
    } = req.body;

    // Validate required fields
    if (!applicationId || !type || !signatureDataUrl || !consentText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate type
    if (!['signature', 'initial'].includes(type)) {
      return res.status(400).json({ error: 'Invalid signature type' });
    }

    // Verify user owns the application
    const application = await storage.getApplication(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.createdBy !== userId) {
      return res.status(403).json({ error: 'Not authorized to sign this application' });
    }

    // Get user details
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert data URL to blob and upload to Azure
    const base64Data = signatureDataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const fileName = `${type}-${applicationId}-${Date.now()}.png`;
    const blobPath = `signatures/${application.tenantId}/${fileName}`;

    await azureBlobStorage.uploadFile(blobPath, buffer, 'image/png');
    const signatureImageUrl = await azureBlobStorage.getDownloadUrl(blobPath);

    // Calculate document hash
    const documentHash = calculateDocumentHash(documentData);

    // Create signature record
    const signature = await storage.createSignature({
      applicationId,
      applicationEditId: applicationEditId || null,
      signedBy: userId,
      signedByName: user.name,
      signedByEmail: user.email,
      type,
      signatureImageUrl,
      signatureDataUrl, // Store for backup
      signedAt: new Date(),
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] || null,
      documentHash,
      consentText,
      consentGiven: true,
      demoCodeId: application.demoCodeId,
    });

    // Update application with signature ID (if type is 'signature')
    if (type === 'signature' && !applicationEditId) {
      await storage.updateApplication(applicationId, {
        signatureId: signature.id,
      });
    }

    // Update application_edit with initial ID (if type is 'initial')
    if (type === 'initial' && applicationEditId) {
      // TODO: Add updateApplicationEdit method to storage
      await db
        .update(schema.applicationEdits)
        .set({ initialId: signature.id })
        .where(eq(schema.applicationEdits.id, applicationEditId));
    }

    res.json(signature);
  } catch (error) {
    console.error('Error creating signature:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
});

// GET /api/signatures/:id - Get signature by ID
app.get('/api/signatures/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const signature = await storage.getSignature(id);

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    // Verify user has access (owner or board member)
    const userId = req.user?.id || req.session.userId;
    const application = await storage.getApplication(signature.applicationId);

    if (application.createdBy !== userId) {
      // TODO: Check if user is board member for this tenant
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Error fetching signature:', error);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

// GET /api/applications/:id/signature - Get application's signature
app.get('/api/applications/:id/signature', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const signature = await storage.getApplicationSignature(id);

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Error fetching application signature:', error);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

// GET /api/applications/:id/signatures - Get all signatures for application
app.get('/api/applications/:id/signatures', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const signatures = await storage.listApplicationSignatures(id);
    res.json(signatures);
  } catch (error) {
    console.error('Error fetching signatures:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});
```

---

### Step 5: Frontend API Client

**File:** `client/src/lib/api.ts`

**Tasks:**
- [ ] Add `createSignature()` method
- [ ] Add `getSignature()` method
- [ ] Add `getApplicationSignature()` method
- [ ] Add TypeScript types

**Code:**

```typescript
// Add types
export interface Signature {
  id: string;
  applicationId: string;
  applicationEditId?: string;
  signedBy: string;
  signedByName: string;
  signedByEmail: string;
  type: 'signature' | 'initial';
  signatureImageUrl: string;
  signatureDataUrl?: string;
  signedAt: string;
  ipAddress?: string;
  userAgent?: string;
  documentHash?: string;
  consentText: string;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignatureRequest {
  applicationId: string;
  applicationEditId?: string;
  type: 'signature' | 'initial';
  signatureDataUrl: string;
  consentText: string;
  documentData: any;
}

// API methods
export async function createSignature(data: CreateSignatureRequest): Promise<Signature> {
  const res = await fetch('/api/signatures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create signature');
  }

  return res.json();
}

export async function getSignature(id: string): Promise<Signature> {
  const res = await fetch(`/api/signatures/${id}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch signature');
  }

  return res.json();
}

export async function getApplicationSignature(applicationId: string): Promise<Signature | null> {
  const res = await fetch(`/api/applications/${applicationId}/signature`, {
    credentials: 'include',
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch signature');
  }

  return res.json();
}

export async function listApplicationSignatures(applicationId: string): Promise<Signature[]> {
  const res = await fetch(`/api/applications/${applicationId}/signatures`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch signatures');
  }

  return res.json();
}
```

---

### Step 6: SignatureCanvas Component

**File:** `client/src/components/SignatureCanvas.tsx` (NEW)

**Tasks:**
- [ ] Create reusable signature canvas component
- [ ] Support both signature and initial modes
- [ ] Add Clear button
- [ ] Validate non-empty before allowing save
- [ ] Add consent checkbox
- [ ] Make responsive and touch-friendly

**Code:**

```typescript
import React, { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface SignatureCanvasProps {
  type: 'signature' | 'initial';
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  legalText: string;
  disabled?: boolean;
}

export function SignatureCanvas({
  type,
  onSave,
  onCancel,
  legalText,
  disabled = false,
}: SignatureCanvasProps) {
  const sigPad = useRef<SignaturePad>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [error, setError] = useState<string>('');

  const canvasWidth = type === 'signature' ? 500 : 300;
  const canvasHeight = type === 'signature' ? 150 : 100;

  const handleClear = () => {
    sigPad.current?.clear();
    setIsEmpty(true);
    setError('');
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      setIsEmpty(false);
      setError('');
    }
  };

  const handleSave = () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      setError(`Please draw your ${type} before continuing`);
      return;
    }

    if (!consentGiven) {
      setError('Please provide consent to use electronic signatures');
      return;
    }

    const dataUrl = sigPad.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Legal text */}
        <div className="text-sm text-muted-foreground">
          {legalText}
        </div>

        {/* Canvas */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {type === 'signature' ? 'Your Signature' : 'Your Initials'}
          </label>
          <div
            className="border-2 border-gray-300 rounded-lg bg-white"
            style={{
              width: '100%',
              maxWidth: `${canvasWidth}px`,
              touchAction: 'none' // Prevent scrolling on touch devices
            }}
          >
            <SignaturePad
              ref={sigPad}
              canvasProps={{
                width: canvasWidth,
                height: canvasHeight,
                className: 'signature-canvas w-full',
                style: { maxWidth: '100%', height: 'auto' }
              }}
              onEnd={handleEnd}
              backgroundColor="rgb(255, 255, 255)"
              penColor="rgb(0, 0, 0)"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sign above using your mouse or touch screen
          </p>
        </div>

        {/* Consent checkbox */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
            disabled={disabled}
          />
          <label
            htmlFor="consent"
            className="text-sm leading-tight cursor-pointer"
          >
            I consent to use electronic {type}s and agree this has the same
            legal effect as a handwritten {type}.
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={disabled || isEmpty}
          >
            Clear
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={disabled}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={disabled || isEmpty || !consentGiven}
            className="ml-auto"
          >
            Save {type === 'signature' ? 'Signature' : 'Initials'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

---

### Step 7: Integrate Signature into ApplicationWizard

**File:** `client/src/components/ApplicationWizard.tsx`

**Tasks:**
- [ ] Add new step 5: "Signature"
- [ ] Show SignatureCanvas component
- [ ] Create signature when user saves
- [ ] Link signature to application
- [ ] Update step count (now 5 steps instead of 4)

**Code:**

```typescript
import { SignatureCanvas } from '@/components/SignatureCanvas';
import { createSignature } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';

// Inside ApplicationWizard component

const [currentStep, setCurrentStep] = useState(1);
const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
const totalSteps = 5; // Updated from 4 to 5

// Mutation for creating signature
const createSignatureMutation = useMutation({
  mutationFn: (dataUrl: string) => createSignature({
    applicationId: application.id, // Assumes application was created in step 4
    type: 'signature',
    signatureDataUrl: dataUrl,
    consentText: 'By signing above, I certify that all information provided in this application is true and accurate to the best of my knowledge.',
    documentData: {
      formData: application.formData,
      additionalInfo: application.additionalInfo,
      submittedAt: new Date().toISOString(),
    },
  }),
  onSuccess: () => {
    toast({
      title: 'Application Submitted',
      description: 'Your application has been submitted successfully.',
    });
    navigate(`/applications/${application.id}`);
  },
  onError: (error: Error) => {
    toast({
      title: 'Signature Failed',
      description: error.message,
      variant: 'destructive',
    });
  },
});

const handleSignatureSave = (dataUrl: string) => {
  setSignatureDataUrl(dataUrl);
  createSignatureMutation.mutate(dataUrl);
};

// In the render method, add Step 5
return (
  <div className="max-w-4xl mx-auto p-6">
    {/* Step indicator */}
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={`flex items-center ${step < 5 ? 'flex-1' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep >= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step}
            </div>
            {step < 5 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  currentStep > step ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="text-sm text-muted-foreground text-center">
        Step {currentStep} of {totalSteps}
      </div>
    </div>

    {/* Step content */}
    {currentStep === 1 && <ProjectTypeStep />}
    {currentStep === 2 && <BasicInfoStep />}
    {currentStep === 3 && <DocumentUploadStep />}
    {currentStep === 4 && <ReviewStep />}
    {currentStep === 5 && (
      <div>
        <h2 className="text-2xl font-bold mb-4">Sign Application</h2>
        <SignatureCanvas
          type="signature"
          legalText="By signing below, you certify that all information provided in this application is true and accurate to the best of your knowledge. You understand that false information may result in denial of your application or other consequences."
          onSave={handleSignatureSave}
          disabled={createSignatureMutation.isPending}
        />
        {createSignatureMutation.isPending && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Submitting application...
          </div>
        )}
      </div>
    )}

    {/* Navigation buttons */}
    <div className="flex justify-between mt-6">
      {currentStep > 1 && currentStep < 5 && (
        <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
          Previous
        </Button>
      )}
      {currentStep < 4 && (
        <Button onClick={() => setCurrentStep(currentStep + 1)} className="ml-auto">
          Next
        </Button>
      )}
      {currentStep === 4 && (
        <Button onClick={() => setCurrentStep(5)} className="ml-auto">
          Continue to Signature
        </Button>
      )}
    </div>
  </div>
);
```

---

### Step 8: Add Initials to Application Edit

**File:** `client/src/pages/ApplicationEdit.tsx`

**Tasks:**
- [ ] Add SignatureCanvas for initials before saving edits
- [ ] Create initial signature record
- [ ] Link initial to application_edit record
- [ ] Show modal with initials canvas instead of inline

**Code:**

```typescript
import { SignatureCanvas } from '@/components/SignatureCanvas';
import { createSignature } from '@/lib/api';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Inside ApplicationEdit component
const [showInitialsDialog, setShowInitialsDialog] = useState(false);
const [pendingEdit, setPendingEdit] = useState<any>(null);

const handleSaveClick = (editData: any) => {
  // Instead of saving directly, show initials dialog
  setPendingEdit(editData);
  setShowInitialsDialog(true);
};

const handleInitialsSave = async (dataUrl: string) => {
  try {
    // First, update the application
    const result = await updateApplication(applicationId, {
      ...pendingEdit,
      acknowledgeReviewReset: permission?.requiresWarning || false,
    });

    // Then create the initials signature
    await createSignature({
      applicationId: applicationId,
      applicationEditId: result.editRecord.id, // Link to the edit record
      type: 'initial',
      signatureDataUrl: dataUrl,
      consentText: 'By initialing above, I acknowledge that I have made changes to this application and certify that the updated information is accurate.',
      documentData: {
        editedFields: Object.keys(pendingEdit),
        newValues: pendingEdit,
        editedAt: new Date().toISOString(),
      },
    });

    setShowInitialsDialog(false);
    setPendingEdit(null);

    toast({
      title: 'Application Updated',
      description: 'Your changes have been saved.',
    });

    navigate(`/applications/${applicationId}`);
  } catch (error) {
    toast({
      title: 'Update Failed',
      description: error.message,
      variant: 'destructive',
    });
  }
};

return (
  <div>
    {/* Application edit form */}
    <ApplicationWizard
      editMode={true}
      initialData={application}
      onSubmit={handleSaveClick} // Changed to show dialog instead of direct save
      onCancel={() => navigate(`/applications/${applicationId}`)}
    />

    {/* Initials Dialog */}
    <Dialog open={showInitialsDialog} onOpenChange={setShowInitialsDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Initial Your Changes</DialogTitle>
          <DialogDescription>
            Please provide your initials to acknowledge the changes you've made to this application.
          </DialogDescription>
        </DialogHeader>

        <SignatureCanvas
          type="initial"
          legalText="By initialing below, you acknowledge that you have reviewed and made changes to this application. You certify that all updated information is accurate."
          onSave={handleInitialsSave}
          onCancel={() => setShowInitialsDialog(false)}
        />
      </DialogContent>
    </Dialog>
  </div>
);
```

---

### Step 9: Display Signatures on Application Detail

**File:** `client/src/pages/ApplicationDetail.tsx`

**Tasks:**
- [ ] Fetch application signature
- [ ] Display signature image in detail view
- [ ] Show signature metadata (who, when)
- [ ] Display all initials with edit history
- [ ] Add expandable section for full audit trail

**Code:**

```typescript
import { useQuery } from '@tanstack/react-query';
import { getApplicationSignature, listApplicationSignatures } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Inside ApplicationDetail component
const { data: signature } = useQuery({
  queryKey: ['application-signature', applicationId],
  queryFn: () => getApplicationSignature(applicationId),
  enabled: !!applicationId,
});

const { data: allSignatures } = useQuery({
  queryKey: ['application-signatures', applicationId],
  queryFn: () => listApplicationSignatures(applicationId),
  enabled: !!applicationId,
});

// In the render section, add signature display
return (
  <div className="space-y-6">
    {/* Existing application detail sections */}

    {/* Signature Section */}
    {signature && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Signature
            <Badge variant="outline">Electronically Signed</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 bg-white inline-block">
            <img
              src={signature.signatureImageUrl}
              alt="Signature"
              className="max-w-md"
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>Signed by:</strong> {signature.signedByName}
            </p>
            <p>
              <strong>Date:</strong> {format(new Date(signature.signedAt), 'PPpp')}
            </p>
            <p>
              <strong>IP Address:</strong> {signature.ipAddress || 'Not recorded'}
            </p>
            {signature.documentHash && (
              <p>
                <strong>Document Hash:</strong>{' '}
                <code className="text-xs">{signature.documentHash.substring(0, 16)}...</code>
              </p>
            )}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              View Consent Text
            </summary>
            <p className="mt-2 text-muted-foreground">
              {signature.consentText}
            </p>
          </details>
        </CardContent>
      </Card>
    )}

    {/* Edit History with Initials */}
    {allSignatures && allSignatures.filter(s => s.type === 'initial').length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Edit History & Initials</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allSignatures
              .filter(s => s.type === 'initial')
              .map((initial) => (
                <div key={initial.id} className="border-l-2 border-primary pl-4">
                  <div className="flex items-start gap-4">
                    <div className="border rounded p-2 bg-white">
                      <img
                        src={initial.signatureImageUrl}
                        alt="Initials"
                        className="w-24 h-auto"
                      />
                    </div>
                    <div className="flex-1 text-sm space-y-1">
                      <p className="font-medium">{initial.signedByName}</p>
                      <p className="text-muted-foreground">
                        Edited {format(new Date(initial.signedAt), 'PPp')}
                      </p>
                      {initial.applicationEditId && (
                        <p className="text-xs text-muted-foreground">
                          Edit ID: {initial.applicationEditId.substring(0, 8)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    )}
  </div>
);
```

---

### Step 10: Testing Checklist

**Test Case 1: New Application Signature**
- [ ] Start new application wizard
- [ ] Complete steps 1-4
- [ ] Navigate to step 5 (Signature)
- [ ] Try to save without drawing signature → Error shown
- [ ] Draw signature
- [ ] Try to save without consent checkbox → Error shown
- [ ] Check consent checkbox
- [ ] Click "Save Signature"
- [ ] Verify signature creates successfully
- [ ] Verify redirected to application detail
- [ ] Verify signature displayed on detail page
- [ ] Verify signature image stored in Azure Blob
- [ ] Verify signature record in database with audit trail

**Test Case 2: Clear and Redraw Signature**
- [ ] Start signature step
- [ ] Draw signature
- [ ] Click "Clear" button
- [ ] Verify canvas cleared
- [ ] Draw different signature
- [ ] Save successfully

**Test Case 3: Application Edit Initials**
- [ ] Navigate to existing application
- [ ] Click "Edit Application"
- [ ] Make changes to 2-3 fields
- [ ] Click "Save Changes"
- [ ] Verify initials dialog appears
- [ ] Draw initials
- [ ] Provide consent
- [ ] Save initials
- [ ] Verify application updated
- [ ] Verify initials linked to edit record
- [ ] Navigate back to application detail
- [ ] Verify initials shown in edit history

**Test Case 4: Mobile/Touch Signature**
- [ ] Open on mobile device or use browser touch emulation
- [ ] Start signature step
- [ ] Draw signature with finger/stylus
- [ ] Verify smooth drawing (no scrolling interference)
- [ ] Save signature
- [ ] Verify signature quality is good

**Test Case 5: Audit Trail Verification**
- [ ] Create signature
- [ ] Query database for signature record
- [ ] Verify IP address recorded
- [ ] Verify user agent recorded
- [ ] Verify timestamp accurate
- [ ] Verify document hash calculated
- [ ] Verify consent text stored

**Test Case 6: Permission Checks**
- [ ] Log in as User A
- [ ] Create application
- [ ] Log out, log in as User B
- [ ] Attempt to access User A's application edit page
- [ ] Verify cannot sign/initial someone else's application

**Test Case 7: Signature Display**
- [ ] View application with signature
- [ ] Verify signature image displays correctly
- [ ] Verify metadata shown (name, date, IP)
- [ ] Verify consent text expandable/collapsible
- [ ] Download application as PDF (future)
- [ ] Verify signature embedded in PDF

---

## 🎨 UI/UX Considerations

### Signature Canvas Styling
```css
/* Add to global styles if needed */
.signature-canvas {
  touch-action: none;
  cursor: crosshair;
}

.signature-canvas:active {
  cursor: grabbing;
}
```

### Responsive Behavior
- Desktop: Full-width canvas (500px for signature, 300px for initials)
- Tablet: Scale down proportionally
- Mobile: Full-width canvas, encourage landscape orientation

### Accessibility
- Canvas has proper labels
- Keyboard navigation support
- Screen reader announcements for actions
- High contrast mode support

---

## 📄 Legal Compliance Checklist

- [ ] Consent checkbox required before signing
- [ ] Legal text clearly states electronic signature has same effect as handwritten
- [ ] IP address logged for verification
- [ ] Timestamp recorded in ISO format
- [ ] Document hash calculated to prove integrity
- [ ] User agent recorded for device info
- [ ] Signature images stored securely in Azure Blob
- [ ] Database audit trail complete
- [ ] Terms of service updated to include e-signature clause
- [ ] Privacy policy mentions signature data collection

---

## 🚀 Future Enhancements

### Phase 2 (Optional)
- [ ] Signature reuse: Allow users to save signature and reuse
- [ ] Signature templates: Pre-drawn signatures for board members
- [ ] Bulk signing: Board approves multiple applications with one signature
- [ ] In-person signing: Tablet mode for board meetings
- [ ] Signature verification: Compare new signature to saved signature
- [ ] Signature analytics: Track signing rates and times

### Phase 3 (Advanced)
- [ ] Biometric verification: Match signature pattern to saved biometrics
- [ ] Multi-party signing: Homeowner + spouse both sign
- [ ] Witness signatures: Third-party witness for high-value contracts
- [ ] Notary integration: Connect with digital notary services

---

**Last Updated:** 2025-11-28
**Implementation Time:** 4-6 hours
**Status:** Ready to implement
