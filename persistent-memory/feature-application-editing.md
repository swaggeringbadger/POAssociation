# Feature: Application Editing for Owners

**Created:** 2025-11-28
**Status:** Planning
**Priority:** High
**Estimated Complexity:** Medium

---

## 📋 Feature Overview

### Purpose
Allow application owners to edit their submitted applications with appropriate safeguards based on the current application state.

### Business Rules

#### Rule 1: Direct Editing (No Warning Required)
Applications in these states can be edited without workflow disruption:
- **draft** - Application not yet submitted
- **approved** - Application approved, owner making post-approval changes
- **rejected** - Application rejected, owner revising for resubmission
- **withdrawn** - Application withdrawn by owner
- **changes_requested** - Board requested changes, owner expected to edit

**Behavior:** Save changes, maintain current status

#### Rule 2: Editing with Review Reset (Warning Required)
Applications in these states are actively in the review workflow:
- **pending** - Submitted, awaiting initial review
- **under_review** - Board is actively reviewing
- **pending_committee** - Waiting for committee review

**Behavior:**
1. Show warning modal: "This application is currently under review. Editing will reset the status to 'Submitted' and restart the review process. Are you sure you want to proceed?"
2. If confirmed:
   - Reset status to `pending` or `submitted`
   - Clear any existing review notes/decisions
   - Notify board members that application was updated
   - Add audit log entry: "Application edited by owner during review"

#### Rule 3: No Editing Allowed
Applications in these states cannot be edited:
- **archived** - Application is archived, historical record only

**Behavior:** Hide edit button, show message if attempted

---

## 🎯 User Stories

### Story 1: Homeowner Edits Draft Application
**As a** homeowner
**I want to** edit my draft application before submitting
**So that** I can correct mistakes or add missing information

**Acceptance Criteria:**
- ✅ Edit button visible on draft applications
- ✅ Clicking edit opens application in edit mode
- ✅ All fields are editable
- ✅ Status remains "draft" after saving
- ✅ No warning modal shown

### Story 2: Homeowner Edits Application Under Review
**As a** homeowner
**I want to** edit my application that's currently under review
**So that** I can add important information I forgot

**Acceptance Criteria:**
- ✅ Edit button visible on applications under review
- ✅ Clicking edit shows warning modal about review reset
- ✅ Modal clearly explains consequences
- ✅ User can cancel and return to application view
- ✅ If confirmed, application status resets to "pending"
- ✅ Previous review notes are cleared or marked as obsolete
- ✅ Board members receive notification of the update
- ✅ Audit log records the edit action

### Story 3: Homeowner Edits Rejected Application
**As a** homeowner
**I want to** revise my rejected application
**So that** I can address the rejection reasons and resubmit

**Acceptance Criteria:**
- ✅ Edit button visible on rejected applications
- ✅ Clicking edit opens application in edit mode
- ✅ Rejection notes remain visible for reference
- ✅ After saving, status can be updated to "pending" via resubmit action
- ✅ No warning modal shown (rejection already removed from queue)

### Story 4: Board Member Views Edit History
**As a** board member
**I want to** see when an application was edited
**So that** I can review changes and understand the application timeline

**Acceptance Criteria:**
- ✅ Application detail page shows edit history
- ✅ Each edit shows: timestamp, editor name, status before/after
- ✅ Board can see "Application was edited during review" note
- ✅ Previous review notes are preserved but marked as pre-edit

---

## 🏗️ Technical Architecture

### Database Schema Changes

#### Option A: Add Edit Tracking Columns to `applications` Table
```sql
ALTER TABLE applications ADD COLUMN edited_at TIMESTAMP;
ALTER TABLE applications ADD COLUMN edit_count INTEGER DEFAULT 0;
ALTER TABLE applications ADD COLUMN last_edited_by UUID REFERENCES users(id);
```

#### Option B: Create `application_edits` Audit Table (RECOMMENDED)
```sql
CREATE TABLE application_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES users(id),
  edited_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status_before VARCHAR(50) NOT NULL,
  status_after VARCHAR(50) NOT NULL,
  fields_changed JSONB, -- Array of field names that changed
  snapshot_before JSONB, -- Full application data before edit
  ip_address VARCHAR(45),
  user_agent TEXT,
  demo_code_id UUID REFERENCES demo_codes(id) ON DELETE CASCADE
);

CREATE INDEX idx_application_edits_application_id ON application_edits(application_id);
CREATE INDEX idx_application_edits_edited_at ON application_edits(edited_at DESC);
```

**Recommendation:** Use Option B for complete audit trail and compliance

### Application Status State Machine

```typescript
type ApplicationStatus =
  | 'draft'              // Not yet submitted
  | 'pending'            // Submitted, awaiting review
  | 'under_review'       // Board actively reviewing
  | 'pending_committee'  // Waiting for committee
  | 'changes_requested'  // Board requested changes
  | 'approved'           // Approved by board
  | 'rejected'           // Rejected by board
  | 'withdrawn'          // Withdrawn by owner
  | 'archived';          // Historical record

// States that require warning before editing
const REVIEW_STATES: ApplicationStatus[] = [
  'pending',
  'under_review',
  'pending_committee'
];

// States that allow direct editing
const EDITABLE_STATES: ApplicationStatus[] = [
  'draft',
  'approved',
  'rejected',
  'withdrawn',
  'changes_requested'
];

// States that cannot be edited
const LOCKED_STATES: ApplicationStatus[] = [
  'archived'
];
```

### API Endpoint Design

#### New Endpoints

**1. Check Edit Permission**
```
GET /api/applications/:id/edit-permission

Response:
{
  canEdit: boolean,
  requiresWarning: boolean,
  currentStatus: string,
  reason?: string  // If canEdit is false
}
```

**2. Update Application**
```
PUT /api/applications/:id

Request Body:
{
  formData: object,
  additionalInfo: object,
  status?: string,  // Optional status override
  acknowledgeReviewReset?: boolean  // Required if in review state
}

Response:
{
  application: Application,
  editRecord: ApplicationEdit,
  statusChanged: boolean,
  notificationsSent: string[]  // User IDs notified
}
```

**3. Get Edit History**
```
GET /api/applications/:id/edit-history

Response:
{
  edits: [
    {
      id: string,
      editedBy: { id: string, name: string },
      editedAt: string,
      statusBefore: string,
      statusAfter: string,
      fieldsChanged: string[],
      snapshotBefore?: object  // Optional, for detailed view
    }
  ],
  totalEdits: number
}
```

---

## 📝 Implementation Steps

### Phase 1: Backend - Database Schema
**Priority:** Critical | **Estimated Time:** 30 minutes

#### Step 1.1: Update Shared Schema
**File:** `shared/schema.ts`

- [ ] Add `application_edits` table definition to schema
- [ ] Define all columns: id, applicationId, editedBy, editedAt, statusBefore, statusAfter, fieldsChanged, snapshotBefore, ipAddress, userAgent, demoCodeId
- [ ] Add foreign key relations: applicationId → applications, editedBy → users, demoCodeId → demo_codes
- [ ] Add indexes for performance: applicationId, editedAt
- [ ] Export TypeScript types: `ApplicationEdit`, `NewApplicationEdit`

**Code Template:**
```typescript
export const applicationEdits = pgTable('application_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  editedBy: uuid('edited_by').notNull().references(() => users.id),
  editedAt: timestamp('edited_at').notNull().defaultNow(),
  statusBefore: varchar('status_before', { length: 50 }).notNull(),
  statusAfter: varchar('status_after', { length: 50 }).notNull(),
  fieldsChanged: jsonb('fields_changed'),
  snapshotBefore: jsonb('snapshot_before'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});

export type ApplicationEdit = typeof applicationEdits.$inferSelect;
export type NewApplicationEdit = typeof applicationEdits.$inferInsert;
```

#### Step 1.2: Push Schema to Database
- [ ] Run `npm run db:push` to apply schema changes
- [ ] Verify table created in Neon dashboard
- [ ] Verify foreign keys and indexes created
- [ ] Test cascade delete: delete a demo code, verify edits deleted

**Verification Command:**
```bash
npm run db:push
# Check output for successful migration
# Should see: "application_edits" table created
```

---

### Phase 2: Backend - Storage Layer
**Priority:** Critical | **Estimated Time:** 1 hour

#### Step 2.1: Define Status Constants
**File:** `server/storage.ts` (top of file, after imports)

- [ ] Create `APPLICATION_STATUSES` enum or const object
- [ ] Create `REVIEW_STATES` array
- [ ] Create `EDITABLE_STATES` array
- [ ] Create `LOCKED_STATES` array
- [ ] Export for use in routes and frontend

**Code Template:**
```typescript
export const APPLICATION_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  PENDING_COMMITTEE: 'pending_committee',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  ARCHIVED: 'archived',
} as const;

export const REVIEW_STATES = [
  APPLICATION_STATUSES.PENDING,
  APPLICATION_STATUSES.UNDER_REVIEW,
  APPLICATION_STATUSES.PENDING_COMMITTEE,
];

export const EDITABLE_STATES = [
  APPLICATION_STATUSES.DRAFT,
  APPLICATION_STATUSES.APPROVED,
  APPLICATION_STATUSES.REJECTED,
  APPLICATION_STATUSES.WITHDRAWN,
  APPLICATION_STATUSES.CHANGES_REQUESTED,
];

export const LOCKED_STATES = [
  APPLICATION_STATUSES.ARCHIVED,
];
```

#### Step 2.2: Add Edit Permission Method
**File:** `server/storage.ts` (add to IStorage interface and DbStorage class)

- [ ] Add method signature to `IStorage` interface
- [ ] Implement `checkEditPermission(applicationId: string, userId: string)` method
- [ ] Fetch application from database
- [ ] Verify user is the application owner (createdBy === userId)
- [ ] Check current status against LOCKED_STATES
- [ ] Determine if warning required (status in REVIEW_STATES)
- [ ] Return object: `{ canEdit: boolean, requiresWarning: boolean, currentStatus: string, reason?: string }`

**Code Template:**
```typescript
async checkEditPermission(applicationId: string, userId: string): Promise<{
  canEdit: boolean;
  requiresWarning: boolean;
  currentStatus: string;
  reason?: string;
}> {
  const app = await this.getApplication(applicationId);
  if (!app) {
    return { canEdit: false, requiresWarning: false, currentStatus: '', reason: 'Application not found' };
  }

  // Check ownership
  if (app.createdBy !== userId) {
    return { canEdit: false, requiresWarning: false, currentStatus: app.status, reason: 'Not application owner' };
  }

  // Check if locked
  if (LOCKED_STATES.includes(app.status as any)) {
    return { canEdit: false, requiresWarning: false, currentStatus: app.status, reason: 'Application is archived' };
  }

  // Check if in review (requires warning)
  const requiresWarning = REVIEW_STATES.includes(app.status as any);

  return { canEdit: true, requiresWarning, currentStatus: app.status };
}
```

#### Step 2.3: Add Update Application Method
**File:** `server/storage.ts` (add to IStorage interface and DbStorage class)

- [ ] Add method signature to `IStorage` interface
- [ ] Implement `updateApplication(applicationId: string, updates: Partial<Application>)` method
- [ ] Use Drizzle `update()` to modify application
- [ ] Filter allowed fields (don't allow changing id, createdBy, createdAt)
- [ ] Return updated application
- [ ] Handle database errors gracefully

**Code Template:**
```typescript
async updateApplication(
  applicationId: string,
  updates: Partial<schema.Application>
): Promise<schema.Application> {
  // Remove fields that shouldn't be updated
  const { id, createdBy, createdAt, ...allowedUpdates } = updates;

  const [updated] = await db
    .update(schema.applications)
    .set({
      ...allowedUpdates,
      updatedAt: new Date(),
    })
    .where(eq(schema.applications.id, applicationId))
    .returning();

  if (!updated) {
    throw new Error('Application not found');
  }

  return updated;
}
```

#### Step 2.4: Add Create Edit Record Method
**File:** `server/storage.ts` (add to IStorage interface and DbStorage class)

- [ ] Add method signature to `IStorage` interface
- [ ] Implement `createApplicationEdit(data: NewApplicationEdit)` method
- [ ] Insert record into `application_edits` table
- [ ] Return created record
- [ ] Handle database errors

**Code Template:**
```typescript
async createApplicationEdit(
  data: schema.NewApplicationEdit
): Promise<schema.ApplicationEdit> {
  const [edit] = await db
    .insert(schema.applicationEdits)
    .values(data)
    .returning();

  return edit;
}
```

#### Step 2.5: Add Get Edit History Method
**File:** `server/storage.ts` (add to IStorage interface and DbStorage class)

- [ ] Add method signature to `IStorage` interface
- [ ] Implement `getApplicationEditHistory(applicationId: string)` method
- [ ] Query `application_edits` table with applicationId filter
- [ ] Join with `users` table to get editor names
- [ ] Order by editedAt DESC (newest first)
- [ ] Return array of edit records with user info

**Code Template:**
```typescript
async getApplicationEditHistory(applicationId: string): Promise<Array<{
  edit: schema.ApplicationEdit;
  editedBy: { id: string; name: string; email: string };
}>> {
  const edits = await db
    .select({
      edit: schema.applicationEdits,
      editedBy: {
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      },
    })
    .from(schema.applicationEdits)
    .innerJoin(schema.users, eq(schema.applicationEdits.editedBy, schema.users.id))
    .where(eq(schema.applicationEdits.applicationId, applicationId))
    .orderBy(desc(schema.applicationEdits.editedAt));

  return edits;
}
```

---

### Phase 3: Backend - API Endpoints
**Priority:** Critical | **Estimated Time:** 1.5 hours

#### Step 3.1: Add Edit Permission Endpoint
**File:** `server/routes.ts`

- [ ] Add GET route: `/api/applications/:id/edit-permission`
- [ ] Use `isAuthenticated` middleware
- [ ] Get userId from session (req.user or req.session.userId)
- [ ] Call `storage.checkEditPermission(id, userId)`
- [ ] Return permission object as JSON
- [ ] Handle errors with appropriate status codes

**Code Template:**
```typescript
app.get('/api/applications/:id/edit-permission', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const permission = await storage.checkEditPermission(id, userId);
    res.json(permission);
  } catch (error) {
    console.error('Error checking edit permission:', error);
    res.status(500).json({ error: 'Failed to check edit permission' });
  }
});
```

#### Step 3.2: Add Update Application Endpoint
**File:** `server/routes.ts`

- [ ] Add PUT route: `/api/applications/:id`
- [ ] Use `isAuthenticated` middleware
- [ ] Get userId from session
- [ ] Validate request body (formData, additionalInfo, status, acknowledgeReviewReset)
- [ ] Call `storage.checkEditPermission(id, userId)` first
- [ ] If cannot edit, return 403 Forbidden
- [ ] If in review state and acknowledgeReviewReset is false, return 400 Bad Request
- [ ] Fetch original application for comparison
- [ ] Determine status change:
  - If in REVIEW_STATES and acknowledgeReviewReset=true, set status to 'pending'
  - Otherwise, use provided status or keep current
- [ ] Call `storage.updateApplication(id, updates)`
- [ ] Create edit record with `storage.createApplicationEdit()`
- [ ] If status changed from review state, clear review notes (optional)
- [ ] Send notifications to board members if status changed
- [ ] Return updated application and edit record

**Code Template:**
```typescript
app.put('/api/applications/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.session.userId;
    const { formData, additionalInfo, status, acknowledgeReviewReset } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check permission
    const permission = await storage.checkEditPermission(id, userId);
    if (!permission.canEdit) {
      return res.status(403).json({ error: permission.reason || 'Cannot edit this application' });
    }

    // Require acknowledgment if in review
    if (permission.requiresWarning && !acknowledgeReviewReset) {
      return res.status(400).json({
        error: 'This application is under review. Set acknowledgeReviewReset=true to proceed.',
        requiresWarning: true,
      });
    }

    // Get original application
    const originalApp = await storage.getApplication(id);
    if (!originalApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Determine new status
    let newStatus = originalApp.status;
    if (permission.requiresWarning && acknowledgeReviewReset) {
      newStatus = APPLICATION_STATUSES.PENDING;
    } else if (status) {
      newStatus = status;
    }

    // Update application
    const updates: Partial<schema.Application> = {
      formData: formData || originalApp.formData,
      additionalInfo: additionalInfo || originalApp.additionalInfo,
      status: newStatus,
    };

    const updatedApp = await storage.updateApplication(id, updates);

    // Create edit record
    const editRecord = await storage.createApplicationEdit({
      applicationId: id,
      editedBy: userId,
      editedAt: new Date(),
      statusBefore: originalApp.status,
      statusAfter: newStatus,
      fieldsChanged: Object.keys(updates),
      snapshotBefore: originalApp,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      demoCodeId: originalApp.demoCodeId,
    });

    // TODO: Send notifications if status changed
    const notificationsSent: string[] = [];

    res.json({
      application: updatedApp,
      editRecord,
      statusChanged: originalApp.status !== newStatus,
      notificationsSent,
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});
```

#### Step 3.3: Add Edit History Endpoint
**File:** `server/routes.ts`

- [ ] Add GET route: `/api/applications/:id/edit-history`
- [ ] Use `isAuthenticated` middleware
- [ ] Get userId from session
- [ ] Verify user has access to application (owner or board member)
- [ ] Call `storage.getApplicationEditHistory(id)`
- [ ] Return edit history array
- [ ] Handle errors

**Code Template:**
```typescript
app.get('/api/applications/:id/edit-history', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get application to verify access
    const app = await storage.getApplication(id);
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // TODO: Add role-based permission check (owner or board member)
    // For now, allow owner only
    if (app.createdBy !== userId) {
      return res.status(403).json({ error: 'Not authorized to view edit history' });
    }

    const history = await storage.getApplicationEditHistory(id);

    res.json({
      edits: history.map(({ edit, editedBy }) => ({
        id: edit.id,
        editedBy: {
          id: editedBy.id,
          name: editedBy.name,
          email: editedBy.email,
        },
        editedAt: edit.editedAt,
        statusBefore: edit.statusBefore,
        statusAfter: edit.statusAfter,
        fieldsChanged: edit.fieldsChanged,
      })),
      totalEdits: history.length,
    });
  } catch (error) {
    console.error('Error fetching edit history:', error);
    res.status(500).json({ error: 'Failed to fetch edit history' });
  }
});
```

---

### Phase 4: Frontend - API Client
**Priority:** Critical | **Estimated Time:** 30 minutes

#### Step 4.1: Add Edit Permission Method
**File:** `client/src/lib/api.ts`

- [ ] Add `checkEditPermission(applicationId: string)` method
- [ ] Make GET request to `/api/applications/:id/edit-permission`
- [ ] Return permission object
- [ ] Handle errors

**Code Template:**
```typescript
export async function checkEditPermission(applicationId: string): Promise<{
  canEdit: boolean;
  requiresWarning: boolean;
  currentStatus: string;
  reason?: string;
}> {
  const res = await fetch(`/api/applications/${applicationId}/edit-permission`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to check edit permission');
  }

  return res.json();
}
```

#### Step 4.2: Add Update Application Method
**File:** `client/src/lib/api.ts`

- [ ] Add `updateApplication(applicationId: string, data: UpdateApplicationData)` method
- [ ] Make PUT request to `/api/applications/:id`
- [ ] Send formData, additionalInfo, status, acknowledgeReviewReset in body
- [ ] Return updated application and edit record
- [ ] Handle 400 error for missing acknowledgment
- [ ] Handle 403 error for permission denied

**Code Template:**
```typescript
export interface UpdateApplicationData {
  formData?: any;
  additionalInfo?: any;
  status?: string;
  acknowledgeReviewReset?: boolean;
}

export async function updateApplication(
  applicationId: string,
  data: UpdateApplicationData
): Promise<{
  application: Application;
  editRecord: any;
  statusChanged: boolean;
  notificationsSent: string[];
}> {
  const res = await fetch(`/api/applications/${applicationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update application');
  }

  return res.json();
}
```

#### Step 4.3: Add Edit History Method
**File:** `client/src/lib/api.ts`

- [ ] Add `getApplicationEditHistory(applicationId: string)` method
- [ ] Make GET request to `/api/applications/:id/edit-history`
- [ ] Return edit history array
- [ ] Handle errors

**Code Template:**
```typescript
export interface ApplicationEditHistory {
  id: string;
  editedBy: { id: string; name: string; email: string };
  editedAt: string;
  statusBefore: string;
  statusAfter: string;
  fieldsChanged?: string[];
}

export async function getApplicationEditHistory(applicationId: string): Promise<{
  edits: ApplicationEditHistory[];
  totalEdits: number;
}> {
  const res = await fetch(`/api/applications/${applicationId}/edit-history`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch edit history');
  }

  return res.json();
}
```

---

### Phase 5: Frontend - Edit Warning Modal
**Priority:** Critical | **Estimated Time:** 45 minutes

#### Step 5.1: Create EditWarningDialog Component
**File:** `client/src/components/EditWarningDialog.tsx` (NEW FILE)

- [ ] Create new React component using shadcn/ui Dialog
- [ ] Accept props: open, onOpenChange, onConfirm, onCancel, currentStatus
- [ ] Display warning message about review reset
- [ ] Show current status badge
- [ ] List consequences: status reset, review notes cleared, board notified
- [ ] Add "Cancel" and "Continue Editing" buttons
- [ ] Style with AlertTriangle icon and warning colors

**Code Template:**
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EditWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentStatus: string;
}

export function EditWarningDialog({ open, onOpenChange, onConfirm, currentStatus }: EditWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Application is Under Review</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current status:</span>
              <Badge variant="secondary">{currentStatus}</Badge>
            </div>

            <p className="text-sm">
              This application is currently being reviewed by the board. If you edit it now:
            </p>

            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>The status will reset to <strong>"Pending Review"</strong></li>
              <li>The application will restart the review process</li>
              <li>Previous review notes may be cleared</li>
              <li>Board members will be notified of the update</li>
            </ul>

            <p className="text-sm font-medium">
              Are you sure you want to continue?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-amber-500 hover:bg-amber-600">
            Continue Editing
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### Phase 6: Frontend - Application Detail Page Updates
**Priority:** Critical | **Estimated Time:** 1 hour

#### Step 6.1: Add Edit Button to Application Detail Header
**File:** `client/src/pages/ApplicationDetail.tsx`

- [ ] Find the application detail page component
- [ ] Add "Edit Application" button to header actions area
- [ ] Import `useQuery` to check edit permission
- [ ] Fetch edit permission on component mount
- [ ] Show/hide button based on `canEdit` value
- [ ] Add disabled state while loading permission
- [ ] Add click handler to open edit mode or warning dialog

**Code Location:** Look for the header section with application title and status badge

**Code Template:**
```typescript
// Add to imports
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { checkEditPermission } from "@/lib/api";
import { EditWarningDialog } from "@/components/EditWarningDialog";
import { useState } from "react";

// Inside component:
const [showEditWarning, setShowEditWarning] = useState(false);

const { data: editPermission, isLoading: loadingPermission } = useQuery({
  queryKey: ['edit-permission', applicationId],
  queryFn: () => checkEditPermission(applicationId),
  enabled: !!applicationId,
});

const handleEditClick = () => {
  if (!editPermission) return;

  if (editPermission.requiresWarning) {
    setShowEditWarning(true);
  } else {
    // Navigate to edit mode
    navigate(`/applications/${applicationId}/edit`);
  }
};

const handleConfirmEdit = () => {
  setShowEditWarning(false);
  navigate(`/applications/${applicationId}/edit`);
};

// In JSX, add button near application title:
{editPermission?.canEdit && (
  <Button
    onClick={handleEditClick}
    disabled={loadingPermission}
    variant="outline"
    size="sm"
  >
    <Pencil className="h-4 w-4 mr-2" />
    Edit Application
  </Button>
)}

{/* Add dialog at bottom of component */}
<EditWarningDialog
  open={showEditWarning}
  onOpenChange={setShowEditWarning}
  onConfirm={handleConfirmEdit}
  currentStatus={editPermission?.currentStatus || ''}
/>
```

#### Step 6.2: Add Edit History Section
**File:** `client/src/pages/ApplicationDetail.tsx`

- [ ] Add new section below application details
- [ ] Use `useQuery` to fetch edit history
- [ ] Display in a table or timeline format
- [ ] Show: timestamp, editor name, status change, fields changed count
- [ ] Add expand/collapse for each edit to show details
- [ ] Format dates with relative time (e.g., "2 hours ago")
- [ ] Show empty state if no edits

**Code Template:**
```typescript
// Add to imports
import { getApplicationEditHistory } from "@/lib/api";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Inside component:
const { data: editHistory } = useQuery({
  queryKey: ['edit-history', applicationId],
  queryFn: () => getApplicationEditHistory(applicationId),
  enabled: !!applicationId,
});

// In JSX, add section:
{editHistory && editHistory.totalEdits > 0 && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
      <History className="h-5 w-5" />
      Edit History ({editHistory.totalEdits})
    </h3>

    <div className="space-y-3">
      {editHistory.edits.map((edit) => (
        <div key={edit.id} className="border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{edit.editedBy.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{edit.statusBefore}</Badge>
              <span>→</span>
              <Badge>{edit.statusAfter}</Badge>
            </div>
          </div>
          {edit.fieldsChanged && edit.fieldsChanged.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Updated {edit.fieldsChanged.length} field(s)
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Phase 7: Frontend - Edit Mode/Form
**Priority:** Critical | **Estimated Time:** 2 hours

#### Step 7.1: Create Application Edit Route
**File:** `client/src/App.tsx`

- [ ] Add new route: `/applications/:id/edit`
- [ ] Wrap in DashboardLayout
- [ ] Create new page component or reuse existing form

**Code Template:**
```typescript
<Route path="/applications/:id/edit" component={ApplicationEdit} />
```

#### Step 7.2: Create ApplicationEdit Component
**File:** `client/src/pages/ApplicationEdit.tsx` (NEW FILE or modify existing)

**Option A: Create New Edit-Specific Component**
- [ ] Create new file `client/src/pages/ApplicationEdit.tsx`
- [ ] Accept applicationId from route params
- [ ] Fetch existing application data
- [ ] Check edit permission on mount
- [ ] If requiresWarning and not acknowledged, redirect back with message
- [ ] Render form with pre-filled data
- [ ] Use ApplicationWizard or DynamicForm component
- [ ] On submit, call `updateApplication` API
- [ ] Pass `acknowledgeReviewReset` flag based on permission check
- [ ] Show success message and redirect to detail page
- [ ] Handle errors with toast notifications

**Option B: Extend Existing ApplicationWizard**
- [ ] Modify `client/src/components/ApplicationWizard.tsx`
- [ ] Add prop: `editMode: boolean` and `applicationId?: string`
- [ ] Add prop: `initialData?: Application`
- [ ] If editMode=true, fetch application data on mount
- [ ] Pre-populate form fields with initialData
- [ ] Change submit handler to call updateApplication instead of createApplication
- [ ] Update button text: "Submit Application" → "Save Changes"
- [ ] Add "Cancel" button that navigates back

**Recommendation:** Use Option B for code reuse

**Code Template (Option A - New Component):**
```typescript
import { useParams, useLocation, useNavigate } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getApplication, checkEditPermission, updateApplication } from "@/lib/api";
import { ApplicationWizard } from "@/components/ApplicationWizard";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export default function ApplicationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setLocation] = useLocation();

  // Fetch application data
  const { data: application, isLoading: loadingApp } = useQuery({
    queryKey: ['application', id],
    queryFn: () => getApplication(id!),
    enabled: !!id,
  });

  // Check edit permission
  const { data: permission, isLoading: loadingPermission } = useQuery({
    queryKey: ['edit-permission', id],
    queryFn: () => checkEditPermission(id!),
    enabled: !!id,
  });

  // Redirect if cannot edit
  useEffect(() => {
    if (permission && !permission.canEdit) {
      toast({
        title: "Cannot Edit",
        description: permission.reason || "You don't have permission to edit this application.",
        variant: "destructive",
      });
      navigate(`/applications/${id}`);
    }
  }, [permission, navigate, id]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => updateApplication(id!, {
      formData: data.formData,
      additionalInfo: data.additionalInfo,
      acknowledgeReviewReset: permission?.requiresWarning || false,
    }),
    onSuccess: () => {
      toast({
        title: "Application Updated",
        description: "Your application has been successfully updated.",
      });
      navigate(`/applications/${id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (loadingApp || loadingPermission) {
    return <div>Loading...</div>;
  }

  if (!application) {
    return <div>Application not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Application</h1>

      <ApplicationWizard
        editMode={true}
        initialData={application}
        onSubmit={(data) => updateMutation.mutate(data)}
        onCancel={() => navigate(`/applications/${id}`)}
      />
    </div>
  );
}
```

#### Step 7.3: Update ApplicationWizard for Edit Mode
**File:** `client/src/components/ApplicationWizard.tsx`

- [ ] Add props: `editMode?: boolean`, `initialData?: Application`, `onCancel?: () => void`
- [ ] Pre-populate form fields if initialData provided
- [ ] Change submit button text based on editMode
- [ ] Add Cancel button if onCancel provided
- [ ] Update form submission logic to handle both create and update
- [ ] Maintain step progress during edit

**Changes to make:**
```typescript
interface ApplicationWizardProps {
  applicationType?: string;
  editMode?: boolean;
  initialData?: Application;
  onSubmit?: (data: any) => void;
  onCancel?: () => void;
}

export function ApplicationWizard({
  applicationType,
  editMode = false,
  initialData,
  onSubmit,
  onCancel
}: ApplicationWizardProps) {
  // Initialize form with initialData if provided
  const defaultValues = editMode && initialData ? {
    ...initialData.formData,
    ...initialData.additionalInfo,
  } : {};

  // ... rest of component

  // Update submit button text
  <Button type="submit">
    {editMode ? "Save Changes" : "Submit Application"}
  </Button>

  // Add cancel button if provided
  {onCancel && (
    <Button type="button" variant="outline" onClick={onCancel}>
      Cancel
    </Button>
  )}
}
```

---

### Phase 8: Testing
**Priority:** Critical | **Estimated Time:** 2 hours

#### Test Case 1: Edit Draft Application
**Prerequisites:**
- [ ] Log in as homeowner (James Martinez)
- [ ] Create a draft application (don't submit)

**Steps:**
1. [ ] Navigate to application detail page
2. [ ] Verify "Edit Application" button is visible
3. [ ] Click "Edit Application" button
4. [ ] Verify no warning dialog appears
5. [ ] Verify form loads with existing data pre-filled
6. [ ] Modify 2-3 fields
7. [ ] Click "Save Changes"
8. [ ] Verify success message appears
9. [ ] Verify redirected to application detail page
10. [ ] Verify changes are reflected in application detail
11. [ ] Verify status is still "draft"
12. [ ] Navigate to edit history section
13. [ ] Verify edit record appears with correct timestamp and user

**Expected Results:**
- ✅ No warning shown
- ✅ Changes saved successfully
- ✅ Status remains "draft"
- ✅ Edit history recorded

#### Test Case 2: Edit Application Under Review (with Warning)
**Prerequisites:**
- [ ] Log in as homeowner (James Martinez)
- [ ] Create and submit an application (status = "pending")

**Steps:**
1. [ ] Navigate to submitted application detail page
2. [ ] Verify "Edit Application" button is visible
3. [ ] Click "Edit Application" button
4. [ ] Verify warning dialog appears
5. [ ] Verify dialog shows current status ("pending")
6. [ ] Verify dialog lists consequences (status reset, review restart, etc.)
7. [ ] Click "Cancel" on dialog
8. [ ] Verify dialog closes and stays on detail page
9. [ ] Click "Edit Application" button again
10. [ ] Verify warning dialog appears again
11. [ ] Click "Continue Editing" on dialog
12. [ ] Verify navigated to edit form
13. [ ] Modify 2-3 fields
14. [ ] Click "Save Changes"
15. [ ] Verify success message appears
16. [ ] Verify redirected to application detail page
17. [ ] Verify status changed to "pending" (or stayed "pending")
18. [ ] Verify edit history shows status change
19. [ ] Log in as board member (Sarah Chen)
20. [ ] Verify board member sees updated application
21. [ ] Verify board member can see edit history
22. [ ] (Future: Verify board member received notification)

**Expected Results:**
- ✅ Warning dialog shown with correct information
- ✅ Cancel works and returns to detail page
- ✅ Continue works and allows editing
- ✅ Status resets to "pending" after edit
- ✅ Edit history recorded with status change
- ✅ Board member can see changes

#### Test Case 3: Edit Rejected Application
**Prerequisites:**
- [ ] Log in as board member (Sarah Chen)
- [ ] Find a pending application
- [ ] Reject the application with notes

**Steps:**
1. [ ] Log out and log in as application owner (James)
2. [ ] Navigate to rejected application
3. [ ] Verify "Edit Application" button is visible
4. [ ] Verify rejection notes are visible for reference
5. [ ] Click "Edit Application" button
6. [ ] Verify no warning dialog appears (already out of review)
7. [ ] Modify fields to address rejection reasons
8. [ ] Click "Save Changes"
9. [ ] Verify success message appears
10. [ ] Verify status is still "rejected" (not auto-resubmitted)
11. [ ] Verify can manually resubmit via separate action (if implemented)
12. [ ] Verify edit history recorded

**Expected Results:**
- ✅ No warning shown (already rejected)
- ✅ Changes saved successfully
- ✅ Status remains "rejected"
- ✅ Rejection notes preserved
- ✅ Edit history recorded

#### Test Case 4: Edit Approved Application
**Prerequisites:**
- [ ] Log in as board member (Sarah Chen)
- [ ] Find a pending application
- [ ] Approve the application

**Steps:**
1. [ ] Log out and log in as application owner (James)
2. [ ] Navigate to approved application
3. [ ] Verify "Edit Application" button is visible
4. [ ] Click "Edit Application" button
5. [ ] Verify no warning dialog appears
6. [ ] Make minor changes (post-approval adjustments)
7. [ ] Click "Save Changes"
8. [ ] Verify success message appears
9. [ ] Verify status is still "approved"
10. [ ] Verify edit history recorded

**Expected Results:**
- ✅ No warning shown
- ✅ Changes saved successfully
- ✅ Status remains "approved"
- ✅ Edit history recorded

#### Test Case 5: Cannot Edit Another User's Application
**Prerequisites:**
- [ ] Log in as homeowner James Martinez
- [ ] Note one of James's application IDs
- [ ] Log out and log in as different homeowner (create test user if needed)

**Steps:**
1. [ ] Manually navigate to James's application detail page (use URL)
2. [ ] Verify "Edit Application" button is NOT visible
3. [ ] Attempt to access edit page directly via URL: `/applications/{james-app-id}/edit`
4. [ ] Verify either:
   - Redirected back to detail page with error message, OR
   - Shown "Permission Denied" page
5. [ ] Verify cannot see edit history

**Expected Results:**
- ✅ Edit button not shown to non-owner
- ✅ Cannot access edit page via URL
- ✅ Permission error shown

#### Test Case 6: Cannot Edit Archived Application
**Prerequisites:**
- [ ] Database access to manually set application status to "archived"
- [ ] OR implement archive feature first

**Steps:**
1. [ ] Log in as application owner
2. [ ] Navigate to archived application
3. [ ] Verify "Edit Application" button is NOT visible
4. [ ] Attempt to access edit page directly via URL
5. [ ] Verify permission denied
6. [ ] Verify edit history is still viewable (read-only)

**Expected Results:**
- ✅ Edit button not shown for archived applications
- ✅ Cannot access edit page
- ✅ Edit history remains accessible

#### Test Case 7: Edit History Visibility
**Prerequisites:**
- [ ] Log in as homeowner
- [ ] Create application and edit it 3 times

**Steps:**
1. [ ] Navigate to application detail page
2. [ ] Scroll to "Edit History" section
3. [ ] Verify section shows "Edit History (3)"
4. [ ] Verify all 3 edits are listed in reverse chronological order
5. [ ] Verify each edit shows:
   - Editor name
   - Timestamp (relative format like "2 hours ago")
   - Status before and after
   - Number of fields changed
6. [ ] Verify first edit (oldest) is at bottom
7. [ ] Verify most recent edit is at top
8. [ ] Log in as board member
9. [ ] Navigate to same application
10. [ ] Verify can see edit history
11. [ ] Verify edit history helps understand application timeline

**Expected Results:**
- ✅ Edit history displays correctly
- ✅ Chronological order is correct
- ✅ All metadata shown
- ✅ Board members can view history

#### Test Case 8: Edit During Review - Board Member Notification
**Prerequisites:**
- [ ] Implement notification system (email or in-app)
- [ ] Log in as homeowner
- [ ] Submit application

**Steps:**
1. [ ] Log in as board member (Sarah)
2. [ ] Start reviewing the application (change status to "under_review")
3. [ ] Log out and log in as homeowner
4. [ ] Edit the application (acknowledge warning)
5. [ ] Save changes
6. [ ] Log back in as board member
7. [ ] Verify received notification about application update
8. [ ] Notification should include:
   - Application number/title
   - Owner name
   - Message: "Application was edited during review"
   - Link to application
9. [ ] Click link and verify taken to updated application
10. [ ] Verify can see latest changes
11. [ ] Verify edit history shows the edit

**Expected Results:**
- ✅ Board member notified of edit
- ✅ Notification contains relevant info
- ✅ Link works correctly
- ✅ Status reset to "pending"

---

### Phase 9: Documentation
**Priority:** Medium | **Estimated Time:** 30 minutes

#### Step 9.1: Update Session Handoff
**File:** `persistent-memory/session-handoff.md`

- [ ] Add new section: "Application Editing Feature"
- [ ] Document feature completion date
- [ ] List all files created/modified
- [ ] Document database schema changes
- [ ] Note any edge cases discovered during implementation
- [ ] Add to "Recently Completed" section

#### Step 9.2: Update Global Memory (if applicable)
**File:** `persistent-memory/global-memory.md`

- [ ] Document edit permission pattern if reusable
- [ ] Document audit trail pattern (application_edits table)
- [ ] Document state machine pattern for application statuses
- [ ] Add to "Common Patterns" section

#### Step 9.3: Create User Guide (Optional)
**File:** `persistent-memory/user-guide-application-editing.md`

- [ ] Write user-facing guide for homeowners
- [ ] Explain when editing is allowed
- [ ] Explain warning for in-review applications
- [ ] Include screenshots (if available)
- [ ] Explain edit history feature

---

## 🧪 Edge Cases & Considerations

### Edge Case 1: Concurrent Edits
**Scenario:** Two users (or same user in two tabs) try to edit same application
**Consideration:**
- Current implementation: Last write wins
- Better solution: Add optimistic locking with version number
- Add `version` column to applications table
- Check version on update, fail if mismatch
- Show error: "Application was modified by someone else. Please refresh."

**Future Enhancement:**
```typescript
// Add to applications table
version: integer('version').notNull().default(1)

// Update endpoint checks version
if (originalApp.version !== req.body.version) {
  return res.status(409).json({ error: 'Application was modified' });
}

// Increment version on update
updates.version = originalApp.version + 1;
```

### Edge Case 2: Large Edit History
**Scenario:** Application edited 100+ times, edit history becomes unwieldy
**Consideration:**
- Add pagination to edit history endpoint
- Limit UI to show last 10 edits, with "Load More" button
- Consider archiving old edits after certain time period

**Future Enhancement:**
```typescript
// Update endpoint to support pagination
app.get('/api/applications/:id/edit-history', async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;
  // ... add limit/offset to query
});
```

### Edge Case 3: Partial Field Updates
**Scenario:** User only edits one field, but entire formData object replaced
**Consideration:**
- Current implementation: Replace entire formData object
- Better solution: Deep merge formData objects
- Track individual field changes for audit
- Show field-level diff in edit history

**Future Enhancement:**
```typescript
// Calculate field diff
const fieldsChanged = Object.keys(updates.formData).filter(
  key => JSON.stringify(originalApp.formData[key]) !== JSON.stringify(updates.formData[key])
);

// Store in edit record
editRecord.fieldsChanged = fieldsChanged;
```

### Edge Case 4: Edit After Board Started Reviewing
**Scenario:** Board member opens application to review, owner edits it, board submits review
**Consideration:**
- Board's review is now based on old data
- Current implementation: Board review may be out of sync
- Better solution: Invalidate board review if application edited
- Show warning to board member: "Application was updated since you started reviewing"

**Future Enhancement:**
- Add `reviewStartedAt` timestamp when board opens application
- Compare with `lastEditedAt` before allowing review submission
- Show diff between version board reviewed and current version

### Edge Case 5: Document Upload During Edit
**Scenario:** User edits application and uploads new documents
**Consideration:**
- Documents are separate from formData
- Need to handle document changes in edit workflow
- Track document additions/deletions in edit history

**Future Enhancement:**
```typescript
// Add to edit record
documentsAdded: string[];  // Array of new document IDs
documentsRemoved: string[]; // Array of deleted document IDs
```

### Edge Case 6: Edit Permission Changes Mid-Session
**Scenario:** User opens edit page, application gets approved by board while editing
**Consideration:**
- Edit permission checked on page load, not on submit
- Status could change while user is editing
- Better solution: Re-check permission before saving
- Show appropriate message if permission changed

**Future Enhancement:**
```typescript
// In update endpoint, re-check permission before saving
const currentPermission = await storage.checkEditPermission(id, userId);
if (!currentPermission.canEdit) {
  return res.status(403).json({
    error: 'Permission changed while editing',
    newStatus: currentPermission.currentStatus
  });
}
```

---

## 🚀 Future Enhancements

### Enhancement 1: Version Comparison View
**Description:** Show side-by-side diff of application versions
**Benefit:** Helps board members see exactly what changed
**Implementation:**
- Store full snapshot in `snapshotBefore` field
- Create diff component using library like `react-diff-viewer`
- Add "View Changes" button in edit history
- Highlight added/removed/modified fields

### Enhancement 2: Edit Reason Field
**Description:** Require owner to provide reason for editing during review
**Benefit:** Helps board understand context of changes
**Implementation:**
- Add `editReason` field to edit record
- Show textarea in warning dialog: "Why are you editing?"
- Display edit reason in edit history
- Include in notification to board members

### Enhancement 3: Edit Approval Workflow
**Description:** Require board approval for edits made during review
**Benefit:** Prevents abuse of edit feature to bypass review
**Implementation:**
- Add status: `pending_edit_approval`
- After owner edits, status set to pending_edit_approval
- Board member must explicitly approve edit before resuming review
- Board can reject edit and ask for different changes

### Enhancement 4: Field-Level Edit Lock
**Description:** Allow board to lock specific fields from editing
**Benefit:** Prevents owner from changing critical reviewed fields
**Implementation:**
- Add `lockedFields` array to application
- Board can lock fields after partial approval
- Edit form disables locked fields
- Show lock icon and tooltip: "This field was locked by reviewer"

### Enhancement 5: Auto-Save Draft Feature
**Description:** Auto-save form changes while editing
**Benefit:** Prevents data loss if browser crashes
**Implementation:**
- Store draft changes in localStorage
- Auto-save every 30 seconds
- Show "Draft saved at HH:MM" indicator
- Prompt to restore draft if user returns

### Enhancement 6: Mobile Edit Support
**Description:** Optimize edit experience for mobile devices
**Benefit:** Owners can make quick edits from phone
**Implementation:**
- Ensure form is responsive
- Use mobile-friendly date/time pickers
- Add "Save & Continue Later" button for multi-step edits
- Show simplified view on small screens

---

## ✅ Definition of Done

This feature is considered complete when:

- [ ] All database schema changes deployed to production
- [ ] All storage layer methods implemented and tested
- [ ] All API endpoints implemented and tested
- [ ] All frontend components implemented and styled
- [ ] Edit button visible on application detail page with correct permission logic
- [ ] Warning dialog appears for in-review applications
- [ ] Edit form loads with pre-populated data
- [ ] Updates save successfully with status management
- [ ] Edit history displays correctly with all metadata
- [ ] All 8 test cases pass successfully
- [ ] Edge cases documented with mitigation strategies
- [ ] Code reviewed by another developer (if applicable)
- [ ] Documentation updated (session handoff, user guide)
- [ ] Feature deployed to demo environment and verified
- [ ] Demo users can test the feature end-to-end
- [ ] Board members can see edit history and notifications (if implemented)
- [ ] Performance tested (edit history query with 100+ edits)
- [ ] Security tested (cannot edit other users' applications)
- [ ] Accessibility tested (keyboard navigation, screen reader)

---

## 📊 Success Metrics

Track these metrics after deployment to measure feature success:

1. **Edit Adoption Rate**
   - % of applications that get edited at least once
   - Target: >30% within first month

2. **Edit Timing**
   - % of edits made during draft vs during review
   - Target: >80% edits during draft phase

3. **Review Reset Rate**
   - % of edits that trigger review reset
   - Lower is better (indicates users editing at right time)

4. **Edit Frequency**
   - Average number of edits per application
   - Target: 1-2 edits per application

5. **User Satisfaction**
   - Survey homeowners: "How useful is the edit feature?"
   - Target: >4.0/5.0 satisfaction score

6. **Error Rate**
   - % of edit attempts that fail
   - Target: <5% error rate

7. **Board Efficiency**
   - Average time to review applications (before vs after feature)
   - Goal: No significant increase in review time

---

## 🔗 Related Features

### Dependent Features (Blocks This Feature)
- None (all dependencies exist)

### Related Features (Could Enhance)
- **Application Withdrawal** - Allow owners to withdraw applications
- **Version Rollback** - Allow owner to rollback to previous version
- **Comment System** - Allow board to comment on application during review
- **Email Notifications** - Notify board when application edited
- **Activity Feed** - Show application edit events in tenant activity feed

### Future Features (Unlocked by This Feature)
- **Collaborative Editing** - Allow multiple users to edit same application
- **Change Requests** - Board can request specific field changes
- **Edit Templates** - Save common edit patterns for reuse
- **Bulk Edit** - Edit multiple applications at once (for admin)

---

## 📚 References

### Design Patterns Used
- **Audit Trail Pattern** - Track all changes with full history
- **State Machine Pattern** - Manage application status transitions
- **Permission-Based UI** - Show/hide features based on user permissions
- **Optimistic Updates** - Update UI before server confirms (if implemented)

### Similar Features in Other Apps
- **Google Docs** - Version history with restore capability
- **GitHub PRs** - Edit PR description even after reviewers assigned
- **Jira** - Edit tickets with audit log
- **Trello** - Edit cards with activity history

### Technical Resources
- Drizzle ORM Documentation: https://orm.drizzle.team/docs/overview
- React Query Mutations: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- shadcn/ui Alert Dialog: https://ui.shadcn.com/docs/components/alert-dialog

---

**Last Updated:** 2025-11-28
**Author:** Claude Code
**Reviewers:** [To be assigned]
