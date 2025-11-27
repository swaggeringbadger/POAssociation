# CivicFlow Workflow System Implementation Guide

**Status**: Schema created, storage methods started, API endpoints and UI pending
**Priority**: High - Core functionality for applications workflow

## Architecture Overview

### Workflow Concept
- **3-4 pre-built workflow templates** per community (no infinite configurations)
- Account admins select which template to use for their community
- Each application automatically assigned to the workflow when submitted
- Workflow templates are immutable once created (new versions created instead)

### Core Workflow Templates (Initial Set)

1. **Standard 3-Step Review**
   - Step 1: Homeowner submits (readonly for board/management)
   - Step 2: Management Review (can edit application, send back to homeowner, approve, or reject)
   - Step 3: POA Board Review (approve, reject, or conditionally approve with comments)
   - Final Actions: approved | rejected | conditionally_approved

2. **Management + Board** (simpler path)
   - Step 1: Homeowner submits
   - Step 2: POA Board Review (final decision)
   - Final Actions: approved | rejected | conditionally_approved

3. **Management Only** (for properties with no board)
   - Step 1: Homeowner submits
   - Step 2: Management Review (final decision)
   - Final Actions: approved | rejected | conditionally_approved

4. **Extended Board** (for complex communities)
   - Step 1: Homeowner submits
   - Step 2: Management Review (can send back for revisions)
   - Step 3: Committee Review (architectural committee)
   - Step 4: POA Board Final (board approval)
   - Final Actions: approved | rejected | conditionally_approved

---

## Database Schema (COMPLETED)

### Tables Created
All tables use UUID primary keys matching existing pattern.

```typescript
// workflowTemplates
- id: UUID PK
- tenantId: FK -> tenants.id
- name: string (e.g., "Standard 3-Step Review")
- description: text
- steps: JSONB array structure:
  [
    {
      index: number,
      title: string (e.g., "Homeowner Submission"),
      role: string (e.g., "homeowner", "management_rep", "poa_board_member"),
      allowEdit: boolean (can step actor edit application),
      viewOnly: boolean (if true, can only view, no actions),
      actions: string[] (e.g., ["approve", "reject", "send_back", "conditionally_approve"]),
      nextStepCondition?: string (logic for branching)
    }
  ]
- isActive: boolean (default true)
- createdAt, updatedAt: timestamps

// applicationWorkflows
- id: UUID PK
- applicationId: FK -> applications.id
- workflowTemplateId: FK -> workflowTemplates.id
- currentStepIndex: integer (0-based index into workflow steps)
- status: enum ("in_progress", "completed", "halted")
- completedAt: timestamp nullable
- createdAt, updatedAt: timestamps

// comments
- id: UUID PK
- applicationId: FK -> applications.id
- userId: FK -> users.id
- text: string
- parentCommentId: FK -> comments.id nullable (for threading/replies)
- isResolved: boolean (for tracking resolution status)
- createdAt, updatedAt: timestamps
- Note: Supports nested threaded comments for discussion threads

// workflowStepActions
- id: UUID PK
- applicationWorkflowId: FK -> applicationWorkflows.id
- stepIndex: integer (which step this action was taken on)
- action: string ("approved", "rejected", "conditionally_approved", "sent_back", "progressed")
- userId: FK -> users.id
- notes: text nullable (e.g., rejection reason, conditions)
- createdAt: timestamp
- Note: Audit trail of all workflow transitions

// tenants (MODIFIED)
- Added workflowTemplateId: FK -> workflowTemplates.id nullable (initially null)
```

### Migration Status
- Schema file updated: `shared/schema.ts` - all four tables + schema types added
- Storage methods partially added to `server/storage.ts` (outside IStorage interface - NEEDS FIX)
- Database migration NOT YET RUN: `npm run db:push`

---

## Storage Layer (PARTIALLY COMPLETED)

### Completed Methods (Added but Outside Interface)
Methods were appended to `server/storage.ts` but NOT added to `IStorage` interface:

```typescript
// Need to add these to IStorage interface first:
- getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined>
- listWorkflowTemplatesForTenant(tenantId: string): Promise<WorkflowTemplate[]>
- createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate>
- updateTenantWorkflow(tenantId: string, workflowTemplateId: string): Promise<Tenant>
- addComment(comment: InsertComment): Promise<Comment>
- getApplicationComments(applicationId: string): Promise<(Comment & { user: User })[]>
- createApplicationWorkflow(workflow: InsertApplicationWorkflow): Promise<ApplicationWorkflow>
- getApplicationWorkflow(applicationId: string): Promise<ApplicationWorkflow | undefined>
```

### Additional Storage Methods Needed

```typescript
// For workflow step transitions
- advanceApplicationWorkflow(applicationId: string, action: string, userId: string, notes?: string): Promise<ApplicationWorkflow>
- getWorkflowActionHistory(applicationWorkflowId: string): Promise<WorkflowStepAction[]>

// For comment management
- updateCommentResolved(commentId: string, isResolved: boolean): Promise<Comment>
- getCommentThread(parentCommentId: string): Promise<Comment[]>

// For application submission (modify existing)
- createApplicationWithWorkflow(app: InsertApplication, workflowTemplateId: string): Promise<Application & ApplicationWorkflow>
```

---

## API Endpoints (NOT YET CREATED)

### Admin Workflow Management

```
GET /api/tenants/:tenantId/workflows
  - List all workflow templates for community
  - Response: WorkflowTemplate[]

POST /api/tenants/:tenantId/workflows
  - Create new workflow template
  - Body: { name, description, steps: [...] }
  - Response: WorkflowTemplate

PATCH /api/tenants/:tenantId/workflow
  - Assign workflow template to community
  - Body: { workflowTemplateId }
  - Response: Tenant

GET /api/tenants/:tenantId/workflow
  - Get current active workflow for community
  - Response: WorkflowTemplate
```

### Application Workflow Operations

```
GET /api/applications/:applicationId/workflow
  - Get workflow status and current step
  - Response: {
      workflow: ApplicationWorkflow,
      template: WorkflowTemplate,
      currentStep: WorkflowStep,
      history: WorkflowStepAction[]
    }

POST /api/applications/:applicationId/workflow/action
  - Transition application through workflow
  - Body: { action: "approve|reject|conditionally_approve|send_back", notes?: string }
  - Response: ApplicationWorkflow
  - Validations:
    - Check user has role for current step
    - Check action is valid for current step
    - Update currentStepIndex based on action
    - Create WorkflowStepAction record
```

### Comments Endpoints

```
GET /api/applications/:applicationId/comments
  - Get all threaded comments
  - Response: Comment[] (with user info)
  - Note: Returns top-level only, include parentCommentId for threading

POST /api/applications/:applicationId/comments
  - Add new comment
  - Body: { text: string, parentCommentId?: string }
  - Response: Comment

PATCH /api/comments/:commentId/resolve
  - Mark comment as resolved
  - Body: { isResolved: boolean }
  - Response: Comment
```

---

## Frontend Components (NOT YET CREATED)

### 1. Workflow Configuration Admin Page
**Location**: `client/src/pages/admin/WorkflowConfiguration.tsx`
- Show current workflow for community
- List available workflow templates
- Button to select/change workflow
- Preview of workflow steps
- Restricted to account_admin role

### 2. Application Workflow Status Component
**Location**: `client/src/components/ApplicationWorkflowStatus.tsx`
- Display current workflow step
- Show step title, required role, and available actions
- Visual timeline of all steps
- Highlight current step
- Show history of transitions at bottom

### 3. Workflow Action Buttons Component
**Location**: `client/src/components/WorkflowActionButtons.tsx`
- Show action buttons based on current step and user role
- "Approve" button (green)
- "Reject" button (red)
- "Send Back" button (yellow) - only for management step
- "Conditionally Approve" button (blue)
- Modal for entering notes/comments
- POST to `/api/applications/:id/workflow/action`

### 4. Comment Thread Component
**Location**: `client/src/components/CommentThread.tsx`
- Display threaded comments in tree structure
- Add new top-level comment form at top
- Reply to comment functionality
- Resolve/unresolve buttons (if user is reviewer)
- User avatars and timestamps
- Efficient rendering of nested replies
- GET `/api/applications/:id/comments` on mount
- POST `/api/applications/:id/comments` for new comments

### 5. Update ApplicationDetail.tsx
- Add workflow status section (top of page)
- Add workflow action buttons (if user has permission)
- Add comments thread (bottom of page)
- Show complete workflow history in expandable section

---

## Implementation Checklist

### Phase 1: Core Infrastructure (2-3 turns)
- [ ] Fix IStorage interface - add all workflow/comment methods to interface signature
- [ ] Run `npm run db:push` to create tables
- [ ] Test: Verify all tables created with correct structure

### Phase 2: API Endpoints (2-3 turns)
- [ ] POST /api/tenants/:tenantId/workflows (create template)
- [ ] GET /api/tenants/:tenantId/workflows (list templates)
- [ ] PATCH /api/tenants/:tenantId/workflow (assign workflow)
- [ ] GET /api/applications/:id/workflow (get status)
- [ ] POST /api/applications/:id/workflow/action (transition step)
- [ ] GET/POST /api/applications/:id/comments (comment operations)
- [ ] PATCH /api/comments/:id/resolve (resolve comment)

### Phase 3: Admin UI (2 turns)
- [ ] Create WorkflowConfiguration admin page
- [ ] Add route to /admin/workflows in App.tsx
- [ ] Test: Admin can select workflow for community

### Phase 4: Application Detail Enhancement (2-3 turns)
- [ ] Create ApplicationWorkflowStatus component
- [ ] Create WorkflowActionButtons component
- [ ] Create CommentThread component
- [ ] Update ApplicationDetail.tsx to use new components
- [ ] Test: All workflow transitions work correctly
- [ ] Test: Comments thread works with nested replies

### Phase 5: Workflow Logic & Validation (1-2 turns)
- [ ] Add validation: User role matches current step role
- [ ] Add validation: Action is valid for current step
- [ ] Handle step transitions and branching logic
- [ ] Auto-create ApplicationWorkflow on submission
- [ ] Test: Full workflow from submission to final decision

---

## Key Design Decisions

### Why Predefined Templates?
- Reduces complexity from infinite configurations
- Ensures consistency across applications
- Easier to manage and debug
- Communities can still customize via template selection

### Comment Threading Strategy
- Store parentCommentId for hierarchical relationships
- Load all comments flat, client renders tree
- isResolved flag tracks if issue was addressed
- Efficient for typical discussion patterns (5-20 comments per app)

### Workflow Storage in JSON
- Steps stored as JSON array in workflowTemplates table
- Allows flexibility without schema changes
- Each step has: index, title, role, allowEdit, actions, nextStepCondition
- Client validates step index against array length

### WorkflowStepActions Audit Trail
- Every action creates immutable record
- Tracks who did what and when
- Supports full workflow history replay
- Can generate reports on decision makers

---

## Testing Strategy

### Unit Tests Needed
- Workflow template validation (valid steps, actions)
- Step transition logic (can user perform action)
- Comment threading (parent-child relationships)
- Role-based access control

### Integration Tests
- Full workflow from submission to approval
- Sending app back to homeowner for edits
- Comment creation and resolution
- Multiple reviewers on same application

### Manual Testing Workflow
1. Create test community with workflow template
2. Submit application as homeowner
3. Approve in management review
4. Add comment in board review
5. Resolve comment
6. Conditionally approve with notes
7. Verify history shows all transitions

---

## Gotchas & Edge Cases

1. **Application Resubmission After Send Back**
   - When "sent_back", reset currentStepIndex to step with homeowner role?
   - Or create new application?
   - Current design: Create new version (needs clarification)

2. **Multiple Reviewers at Same Step**
   - If board has 5 members, do all need to approve?
   - Current design: First action taken progresses step (may need voting logic)
   - Add `approvalThreshold` to step definition if needed

3. **Comment Notifications**
   - When new comment added, who gets notified?
   - Not yet implemented - future feature
   - Could use WebSocket or email

4. **Workflow Template Changes**
   - If template changed, do active applications use old or new version?
   - Current design: Snapshot workflowTemplateId at application creation (safe)

5. **Deleting Template**
   - What if template deleted while applications use it?
   - Add soft delete or version tracking
   - Prevent deletion if active applications reference it

---

## Database Migration Command
```bash
npm run db:push
# If errors occur:
npm run db:push --force
```

---

## Related Files Modified
- `shared/schema.ts` - Added 4 new tables + types
- `server/storage.ts` - Added methods (needs interface update)
- Server routes still need implementation
- Frontend components still need creation

---

## Next Session Entry Point

Start with Phase 1:
1. Read the IStorage interface in server/storage.ts around line 10-70
2. Add all workflow/comment method signatures to the interface
3. Run `npm run db:push` 
4. Then proceed to Phase 2 (API endpoints)

This will unblock all subsequent work.
