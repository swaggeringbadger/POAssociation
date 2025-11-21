# Feature: Application Submission & Review Workflow

**Priority:** Critical
**Status:** 50% Complete (submission works, review missing)
**Impact:** Core business functionality incomplete

---

## Current State

### ✅ What Works
- **Backend API:**
  - `POST /api/applications` - Submit new application
  - `GET /api/applications/:id` - Get single application
  - `GET /api/tenants/:tenantId/applications` - List applications
  - `PATCH /api/applications/:id/status` - Update status (approve/reject)
  - Storage layer fully implemented

- **Frontend Components:**
  - `DynamicForm` component renders forms and submits data
  - `ApplicationSubmit` page shows form (uses mock schema)
  - Toast notifications on submission
  - Redirect to dashboard after submit

- **Database Schema:**
  - `applications` table with proper structure
  - Status field: pending, under_review, approved, rejected
  - Review metadata: reviewedAt, reviewedByUserId, reviewNotes

### ❌ What's Missing
- **No applications list page** - route exists but shows placeholder
- **No application detail/review page**
- **No application approval/rejection UI**
- **No status update workflow**
- **No board member review interface**
- **Frontend never fetches applications** (Dashboard uses mock data)
- **No "My Applications" view for homeowners**
- **No filtering/search by status, date, type**
- **No comment/communication thread**
- **No application edit/resubmit after rejection**

---

## User Stories

### As a Homeowner
1. **Submit Application**
   - ✅ See available forms
   - ⚠️ Submit application (works but uses mock schema, doesn't fetch real forms)
   - ❌ Track submission status
   - ❌ View all my applications
   - ❌ Edit draft applications
   - ❌ Resubmit after rejection
   - ❌ Receive email notifications

2. **View Application Status**
   - ❌ See list of my applications with current status
   - ❌ Click into application to see details
   - ❌ See review comments from board
   - ❌ See approval/rejection reason
   - ❌ Download approved application as PDF

### As a Board Member
1. **Review Applications**
   - ❌ See list of pending applications
   - ❌ Filter by status (pending, under review, etc.)
   - ❌ Click into application to review details
   - ❌ See all submitted data formatted nicely
   - ❌ See relevant bylaws inline (data exists but no review UI)
   - ❌ Add review notes/comments
   - ❌ Request changes/additional information

2. **Approve/Reject Applications**
   - ❌ Mark application as "Under Review" to claim it
   - ❌ Approve application with optional notes
   - ❌ Reject application with required reason
   - ❌ See audit trail of who reviewed when
   - ❌ Batch process multiple applications

### As a Management Manager
1. **Monitor Applications**
   - ❌ See applications across all managed communities
   - ❌ Track review velocity (avg time to approval)
   - ❌ Identify bottlenecks
   - ❌ Generate compliance reports

---

## Detailed Gaps

### Gap 1: Applications List Page
**Route:** `/applications` (exists but placeholder)
**Priority:** Critical
**File to create:** `client/src/pages/ApplicationsList.tsx`

**Requirements:**
- Fetch applications from `/api/tenants/:tenantId/applications`
- Display in table/card layout with:
  - Applicant name
  - Property address
  - Form type
  - Submission date
  - Current status with badge styling
  - Quick actions (View, Review)
- Filter by status dropdown
- Sort by date (newest/oldest)
- Pagination if > 20 applications
- Role-based view:
  - Homeowners: Only their applications
  - Board members: All pending/under review
  - Admins: All applications

**API Integration:**
```typescript
const { data: applications } = useQuery({
  queryKey: ['applications', currentTenant.id],
  queryFn: () => api.getApplicationsForTenant(currentTenant.id),
});
```

### Gap 2: Application Detail Page
**Route:** `/applications/:id` (doesn't exist)
**Priority:** Critical
**File to create:** `client/src/pages/ApplicationDetail.tsx`

**Requirements:**
- Fetch single application from `/api/applications/:id`
- Display all form data in readable format
- Show submission metadata (who, when)
- Show current status with timeline
- Show review notes if reviewed
- Role-based actions:
  - Homeowner: View only (or edit if still draft)
  - Board member: View + Review actions
  - Admin: View + Override status

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Application #12345                    [Status Badge]│
│ Submitted Nov 18, 2025 by Jane Doe                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Property: 123 Oak Street                          │
│  Form: Structural Changes Application              │
│                                                     │
│  [Applicant Details Section]                       │
│  [Project Details Section]                         │
│  [Documents Section - show file names/thumbnails]  │
│                                                     │
│  ───────────────────────────────────────────────   │
│                                                     │
│  Review Notes:                                     │
│  "Approved with condition: Must use earth-tone..." │
│  - Sarah Chen, Nov 20, 2025                        │
│                                                     │
│  [Board Member Actions]                            │
│  [Request Changes] [Approve] [Reject]              │
└─────────────────────────────────────────────────────┘
```

### Gap 3: Application Review Interface
**Component:** Review actions within ApplicationDetail page
**Priority:** Critical

**Requirements:**
- Show different UI based on status:
  - Pending: [Start Review] button
  - Under Review: Show who claimed it, [Add Notes] [Approve] [Reject]
  - Approved/Rejected: Read-only, show final decision
- Review notes textarea with character count
- Approval flow:
  - Click [Approve]
  - Optional: Add approval notes
  - Confirm approval
  - Status updates to "approved"
  - Homeowner sees notification
- Rejection flow:
  - Click [Reject]
  - Required: Add rejection reason
  - Confirm rejection
  - Status updates to "rejected"
  - Homeowner sees notification with reason

**API Integration:**
```typescript
const approveMutation = useMutation({
  mutationFn: (data: { applicationId: string, notes: string }) =>
    api.updateApplicationStatus(
      data.applicationId,
      'approved',
      currentUser.id,
      data.notes
    ),
  onSuccess: () => {
    toast.success('Application approved!');
    queryClient.invalidateQueries(['applications']);
  },
});
```

### Gap 4: Dashboard Recent Applications
**Location:** `Dashboard.tsx` lines 30-48
**Priority:** Medium
**Issue:** Uses hardcoded mock data

**Fix:**
```typescript
// Replace mock data with real API call
const { data: recentApplications } = useQuery({
  queryKey: ['applications', 'recent', currentTenant.id],
  queryFn: async () => {
    const apps = await api.getApplicationsForTenant(currentTenant.id);
    return apps
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 5); // Show 5 most recent
  },
});
```

### Gap 5: Form Selection Before Submission
**Location:** `ApplicationSubmit.tsx`
**Priority:** High
**Issue:** Always shows hardcoded `ARCH_REQUEST_FORM_SCHEMA`

**Requirements:**
- Fetch available forms for current tenant
- Show list of forms with descriptions
- User selects which form to fill out
- Then show DynamicForm with selected schema

**Flow:**
```
ApplicationSubmit Page
    ↓
Fetch forms: GET /api/tenants/:tenantId/forms
    ↓
Show form selection UI
    ↓
User clicks "Fill out Structural Changes form"
    ↓
Show DynamicForm with that schema
    ↓
User submits
    ↓
POST /api/applications with formTemplateId
```

### Gap 6: "My Applications" View
**Route:** New route needed
**Priority:** Medium
**Purpose:** Homeowner-specific view of their submissions

**Requirements:**
- If user role is homeowner, show prominent "My Applications" nav item
- Fetch only applications where `submittedByUserId` matches current user
- Show simplified list with status tracking
- Click into any application to see details
- Highlight applications needing action (rejected with resubmit option)

### Gap 7: Application Edit/Resubmit
**Priority:** Medium
**Status:** Backend supports, frontend doesn't

**Requirements:**
- Applications in "draft" status can be edited
- Applications "rejected" can be resubmitted with changes
- Need application editing flow:
  - Load existing formData into DynamicForm
  - Allow modifications
  - Update application (need new PATCH endpoint)
  - Resubmit with new status

**Backend needed:**
```typescript
app.patch('/api/applications/:id', isAuthenticated, async (req, res) => {
  // Update application formData and optionally status
});
```

### Gap 8: Application Status Timeline
**Priority:** Low
**Enhancement:** Visual timeline of status changes

**UI:**
```
Submitted ●─────────────● Under Review ●─────────────○ Approved
Nov 18           Nov 19              Nov 20
by Jane Doe      by S. Chen          (pending)
```

**Requirements:**
- Track status changes in audit log
- Display as visual timeline
- Show who changed status and when
- Show notes at each stage

---

## Data Model Enhancements Needed

### Current `applications` Schema
```typescript
{
  id: uuid,
  tenantId: uuid,
  formTemplateId: uuid,
  submittedByUserId: uuid,
  formData: jsonb,
  status: text, // pending | under_review | approved | rejected
  submittedAt: timestamp,
  reviewedAt: timestamp | null,
  reviewedByUserId: uuid | null,
  reviewNotes: text | null,
}
```

### Proposed Enhancements

#### Option 1: Add Draft Status
```typescript
status: 'draft' | 'pending' | 'under_review' | 'approved' | 'rejected'
```
- Allows saving incomplete applications
- Homeowner can return to finish later

#### Option 2: Add Status History Table
```typescript
applicationStatusHistory {
  id: uuid,
  applicationId: uuid,
  status: text,
  changedByUserId: uuid,
  notes: text,
  changedAt: timestamp,
}
```
- Full audit trail
- Enables timeline view
- Tracks who did what when

#### Option 3: Add Application Comments Table
```typescript
applicationComments {
  id: uuid,
  applicationId: uuid,
  userId: uuid,
  comment: text,
  isInternal: boolean, // Board-only vs. visible to homeowner
  createdAt: timestamp,
}
```
- Threaded conversation
- Board can discuss internally
- Board can request clarifications from homeowner

---

## UI Components Needed

### 1. ApplicationCard Component
**Reusable card for list views**

Props:
- `application`: Application object
- `onClick`: Handler for clicking into detail
- `showActions`: Boolean for quick actions
- `compact`: Boolean for compact vs. full view

### 2. StatusBadge Component
**Colored badge for application status**

Variants:
- Draft: gray
- Pending: yellow
- Under Review: blue
- Approved: green
- Rejected: red

### 3. ApplicationStatusTimeline Component
**Visual timeline of status changes**

Props:
- `statusHistory`: Array of status change events
- `currentStatus`: Current status to highlight

### 4. ReviewNotesSection Component
**Display review notes with metadata**

Features:
- Show reviewer name and avatar
- Show review timestamp
- Show notes in formatted text
- Distinguish approval vs. rejection notes

### 5. QuickReviewActions Component
**Action buttons for board members**

Features:
- [Start Review] - claims application
- [Request Changes] - sets to "under_review", adds notes
- [Approve] - approves with optional notes
- [Reject] - rejects with required reason
- Confirmation modals for irreversible actions

---

## Implementation Priority

### Phase 1: Essential (Days 1-2)
1. ✅ Fix ApplicationSubmit to fetch forms from API
2. ✅ Build ApplicationsList page with basic table
3. ✅ Build ApplicationDetail page (read-only view)
4. ✅ Wire Dashboard "Recent Applications" to real API

**Goal:** Users can submit and view applications

### Phase 2: Review Workflow (Days 3-4)
5. ✅ Add review actions to ApplicationDetail
6. ✅ Implement approve/reject mutations
7. ✅ Add role-based action visibility
8. ✅ Add review notes UI

**Goal:** Board members can review and approve

### Phase 3: UX Polish (Days 5-6)
9. ✅ Add StatusBadge component
10. ✅ Add filtering and sorting to list
11. ✅ Add "My Applications" view for homeowners
12. ✅ Better form selection UI

**Goal:** Polished user experience

### Phase 4: Enhancements (Days 7+)
13. ✅ Add application editing (drafts)
14. ✅ Add status timeline
15. ✅ Add comment threads
16. ✅ Add email notifications

**Goal:** Full-featured application management

---

## Testing Checklist

### Unit Tests
- [ ] Application list fetching
- [ ] Application status update mutations
- [ ] Form data validation
- [ ] Role-based permission checks

### Integration Tests
- [ ] Submit application end-to-end
- [ ] Approve application workflow
- [ ] Reject application workflow
- [ ] Homeowner sees only their applications
- [ ] Board member sees all applications

### E2E Tests (Playwright)
- [ ] Complete submission flow
- [ ] Complete review flow
- [ ] Status updates reflect immediately
- [ ] Notifications appear correctly

---

## API Client Updates Needed

**Current:** API client has methods but they're not used

**Add:**
```typescript
// In api.ts
async updateApplicationStatus(
  id: string,
  status: 'pending' | 'under_review' | 'approved' | 'rejected',
  reviewedByUserId: string,
  reviewNotes?: string
): Promise<Application> {
  const response = await fetch(`${this.baseUrl}/applications/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewedByUserId, reviewNotes }),
  });
  if (!response.ok) throw new Error('Failed to update application status');
  return response.json();
}

async getApplicationsForUser(userId: string): Promise<Application[]> {
  // Need new backend endpoint for this
  const response = await fetch(`${this.baseUrl}/users/${userId}/applications`);
  if (!response.ok) throw new Error('Failed to fetch user applications');
  return response.json();
}
```

**Backend endpoints to add:**
```typescript
// In routes.ts
app.get('/api/users/:userId/applications', isAuthenticated, async (req, res) => {
  const applications = await storage.listApplicationsForUser(req.params.userId);
  res.json(applications);
});
```

---

## Related Documents

- `feature-gaps-triage.md` - Overall platform status
- `feature-form-management.md` - Form template creation
- `feature-sandbox-demo.md` - Demo account with sample applications
- `global-memory.md` - Code patterns and conventions

---

## Success Metrics

### Usage Metrics
- Applications submitted per day
- Average time from submission to review
- Average time from review to approval
- % applications approved vs. rejected
- % applications requiring changes

### User Satisfaction
- Homeowner satisfaction with submission process
- Board member satisfaction with review interface
- Time saved vs. manual/email process

### System Health
- API response times for application endpoints
- Success rate of submissions
- Error rates on review actions

---

## Notes

- This is the **core workflow** of the platform - highest priority
- Backend is solid, just need frontend UI
- Low-hanging fruit: wire existing components to existing APIs
- Biggest gap: Review/approval interface
