# Session Handoff Document

**Last Updated:** 2025-11-29
**Current Session:** Premium AI-Powered Application Analysis - Phases 1-10 COMPLETE

---

## Current Status

### 🎯 Latest Session Summary (2025-11-29 - AI Analysis Feature COMPLETE)

**Session Goal:** Implement Premium AI-Powered Application Analysis feature

**Progress:** ALL 10 PHASES COMPLETE (Backend + Frontend)

**Major Accomplishments:**

**Phase 1: Database Schema & Credit System** ✅
- Created comprehensive implementation plan at `/home/runner/.claude/plans/concurrent-purring-flurry.md`
- Added 2 new database tables:
  - `ai_analysis_credits` - Per-tenant credit tracking with override support
  - `ai_analyses` - Analysis results storage with full cost/timing tracking
- Added AI credit tier defaults to `subscriptionTypes.ts`:
  - Free: 0 credits
  - Starter: 10 credits/month ($4.99 overage)
  - Professional: 50 credits/month ($2.99 overage)
  - Enterprise: 200 credits/month ($1.49 overage)
- Created `shared/aiAnalysisTypes.ts` with Zod schemas for:
  - BylawComplianceItem, RiskAssessmentItem, QuestionConcernItem, RecommendationItem
  - Full AiAnalysisResultSchema for Anthropic API response validation
  - API request/response types
  - Cost calculation utilities
- Added 15 storage methods to `server/storage.ts`:
  - AI Credits: get, create, update, increment, reset, setOverride, removeOverride
  - AI Analyses: create, get, getForApplication, listForTenant, getNextQueued, update, updateStatus, submitFeedback, getStats
- Applied migration `migrations/0001_add_ai_analysis_tables.sql`
- Verified tables exist in database

**Key Design Decisions:**
- Credits system with tier defaults + per-property super admin overrides
- Database-backed job queue (not Redis) for MVP simplicity
- Provider-agnostic image generation service (Stability AI fallback, Nano Banana later)
- Management roles only can trigger analysis; others can view results

**Files Created:**
- `/home/runner/.claude/plans/concurrent-purring-flurry.md` - Complete implementation plan
- `/shared/aiAnalysisTypes.ts` - Type definitions and Zod schemas
- `/migrations/0001_add_ai_analysis_tables.sql` - Database migration

**Files Modified:**
- `/shared/schema.ts` - Added ai_analysis_credits and ai_analyses tables
- `/shared/subscriptionTypes.ts` - Added AI credit tier defaults and types
- `/server/storage.ts` - Added 15 storage methods for credits and analyses

**Phase 2: Credit System Service** ✅
- Created `/server/services/aiCreditService.ts`
- Credit checking with tier defaults and super admin overrides
- Credit deduction after successful analysis
- Billing cycle reset logic
- Sync with subscription on plan changes

**Phase 3: Queue System** ✅
- Created `/server/services/analysisQueueService.ts`
- Database-backed job queue (polling pattern, not Redis)
- Job states: queued, processing, completed, failed
- Retry logic (max 3 retries)
- Background worker with 5-second polling interval

**Phase 4: Anthropic Analysis Service** ✅
- Created `/server/services/aiAnalysisService.ts`
- Gathers context (application, form template, tenant bylaws)
- Builds prompts from templates in `/server/prompts/`
- Calls Anthropic Claude API (claude-sonnet-4-5-20250929)
- Parses and validates JSON response with Zod schema
- Created prompt templates:
  - `/server/prompts/analysis-system-prompt.md`
  - `/server/prompts/analysis-user-prompt.md`

**Phase 5: Google Maps Integration** ✅
- Created `/server/services/googleMapsService.ts`
- Address geocoding to coordinates
- Satellite imagery URL generation
- Hybrid map and multi-zoom options
- Cost calculation for usage tracking

**Phase 6: Image Generation Service** ✅
- Created `/server/services/imageGenerationService.ts`
- Provider-agnostic architecture (Stability AI default, Nano Banana ready)
- Mockup generation from project context
- Multiple variation support
- Cost calculation per provider

**Phase 7: PDF Report Generation** ✅
- Created `/server/services/pdfReportService.ts`
- Professional PDF reports with PDFKit
- Executive summary with compliance score and risk level
- Bylaw compliance details with visual indicators
- Risk assessment section
- Questions and recommendations
- Satellite imagery and AI mockups (optional)
- Footer with disclaimers and page numbers

**Phase 8: Worker Integration** ✅
- Created `/server/services/analysisWorker.ts`
- Orchestrates all services in pipeline:
  1. AI Analysis (Anthropic)
  2. Satellite Imagery (Google Maps)
  3. AI Mockups (Stability AI)
  4. PDF Report (PDFKit)
- Integrated into server startup in `/server/index.ts`
- Graceful shutdown handlers (SIGTERM, SIGINT)
- Starts automatically when ANTHROPIC_API_KEY is set

**Phase 9-10 Backend API Endpoints** ✅
- 12 endpoints added to `/server/routes.ts`:
  - `GET /api/ai/credits` - Get credit status
  - `GET /api/ai/credits/check` - Quick credit availability check
  - `POST /api/admin/tenants/:tenantId/ai-credits/override` - Super admin override
  - `DELETE /api/admin/tenants/:tenantId/ai-credits/override` - Remove override
  - `POST /api/applications/:applicationId/analyze` - Trigger analysis
  - `GET /api/ai/analysis/:analysisId` - Get analysis result
  - `GET /api/ai/analysis/:analysisId/status` - Poll status
  - `GET /api/applications/:applicationId/analyses` - List analyses
  - `POST /api/ai/analysis/:analysisId/feedback` - Submit rating
  - `POST /api/ai/analysis/:analysisId/cancel` - Cancel queued
  - `GET /api/admin/ai-analysis/stats` - Super admin stats
  - `GET /api/admin/tenants/:tenantId/ai-analysis/stats` - Tenant stats

**Files Created:**
- `/server/services/aiCreditService.ts` - Credit management
- `/server/services/analysisQueueService.ts` - Job queue
- `/server/services/aiAnalysisService.ts` - Anthropic integration
- `/server/services/googleMapsService.ts` - Geocoding & imagery
- `/server/services/imageGenerationService.ts` - AI mockups
- `/server/services/pdfReportService.ts` - PDF reports
- `/server/services/analysisWorker.ts` - Pipeline orchestration
- `/server/prompts/analysis-system-prompt.md` - System prompt
- `/server/prompts/analysis-user-prompt.md` - User prompt

**Files Modified:**
- `/server/index.ts` - Worker integration and graceful shutdown
- `/server/routes.ts` - 12 new API endpoints
- `package.json` - Added pdfkit dependency

**Phase 9-10: Frontend Components** ✅
- Created `/client/src/components/ai-analysis/` directory with:
  - `AIAnalysisButton.tsx` - Trigger analysis with options dialog
    - Credit check before triggering
    - Options for satellite imagery and AI mockups
    - Role-based visibility (management roles only)
    - Integration with mutation/query client
  - `AIAnalysisStatus.tsx` - Polling progress indicator
    - Real-time status polling (3-second intervals)
    - Progress bar with estimated time
    - Stage indicators (Reading, Analyzing, Imagery, Report)
    - Cancel functionality
  - `AIAnalysisResults.tsx` - Comprehensive results display
    - Tabbed interface (Compliance, Risks, Questions, Recommendations)
    - Compliance score with progress bar
    - Risk level badge with severity colors
    - Bylaw compliance with collapsible details
    - PDF report download
    - Feedback/rating submission
  - `CreditDisplay.tsx` - Show remaining credits
    - Compact mode for sidebar/header
    - Full mode with usage details
    - Low/empty credit warnings
    - Popover with billing cycle info
  - `index.ts` - Barrel export file

- Updated `/client/src/lib/api.ts` with 10 new API methods:
  - `getAiCreditStatus()` - Full credit status
  - `checkAiCredits()` - Quick availability check
  - `triggerAiAnalysis()` - Start analysis
  - `getAiAnalysis()` - Get full result
  - `getAiAnalysisStatus()` - Poll status
  - `listApplicationAnalyses()` - List analyses for app
  - `submitAnalysisFeedback()` - Rate analysis
  - `cancelAiAnalysis()` - Cancel queued

- Integrated into `/client/src/pages/ApplicationDetail.tsx`:
  - AI Analysis button in header (management roles only)
  - AI Analysis section showing status/results
  - Auto-refresh when analysis completes

**Environment Variables Required:**
```
ANTHROPIC_API_KEY=xxx           # Required for AI analysis
GOOGLE_MAPS_API_KEY=xxx         # Optional: for satellite imagery
STABILITY_API_KEY=xxx           # Optional: for AI mockups
```

**Plan File Location:**
`/home/runner/.claude/plans/concurrent-purring-flurry.md` - Complete 10-phase implementation plan

---

### 🎯 Previous Session Summary (2025-11-28 - Workflow Designer Implementation)

**Session Goal:** Build visual workflow designer for Admin/Super Admin with branching decision trees

**Progress:** 45% Complete (5 of 11 phases)

**Major Accomplishments:**

**Phase 1: Database & Backend Foundation** ✅
- Created database migration `008_add_workflow_versioning.sql`
- Added versioning columns: `version`, `parent_template_id`, `is_blueprint`, `created_by_user_id`
- Marked existing 4 seed templates as immutable blueprints
- Created comprehensive TypeScript interfaces in `/shared/workflowTypes.ts`
- Built `WorkflowEngine` class with condition evaluation logic (action, field, compound)
- Applied migration successfully

**Phase 2: Backend API Endpoints** ✅
- Created 8 new workflow designer endpoints:
  - `GET /api/workflow-designer/templates` - List all (blueprints + custom)
  - `GET /api/workflow-designer/templates/:id` - Get template for editing
  - `POST /api/workflow-designer/templates/:id/clone` - Clone blueprint
  - `PUT /api/workflow-designer/templates/:id` - Update template
  - `POST /api/workflow-designer/templates/:id/version` - Save new version
  - `DELETE /api/workflow-designer/templates/:id` - Delete custom template
  - `POST /api/workflow-designer/test-condition` - Test condition with sample data
  - `POST /api/workflow-designer/test-workflow` - Simulate workflow execution
- Added role-based access control (Admin/Super Admin only via `requireAdmin` helper)
- Implemented storage methods: `cloneWorkflowTemplate`, `createWorkflowTemplateVersion`, `updateWorkflowTemplate`, `deleteWorkflowTemplate`
- Updated `advanceApplicationWorkflow` to use WorkflowEngine for branching logic
- Backwards compatible: detects enhanced vs legacy workflows

**Phase 3: Frontend Store** ✅
- Created `/client/src/stores/workflowDesignerStore.ts` (Zustand)
- Implemented full CRUD operations for steps and transitions
- Added validation logic with error tracking
- Dirty state tracking (hasUnsavedChanges)
- Deep cloning for immutability
- Following formBuilderStore.ts pattern

**Phase 4: React Flow Components** ✅
- Installed `reactflow` package (v11 latest)
- Created 4 custom node components:
  - `StartNode.tsx` - Circular green node with Play icon
  - `StepNode.tsx` - Card-style node with role and actions
  - `DecisionNode.tsx` - Diamond-shaped yellow node with GitBranch icon
  - `EndNode.tsx` - Circular red node with CheckCircle icon
- All nodes support validation errors display
- Nodes styled with Tailwind and shadcn/ui
- Created `/client/src/pages/WorkflowDesignerPage.tsx` with React Flow canvas
- Added route `/workflow-designer/:templateId` to App.tsx
- 3-column layout: Node Palette | Canvas | Properties Panel

**Phase 5: Properties Panels** ✅
- Created `/client/src/components/workflow-designer/StepPropertiesPanel.tsx`
  - Edit step title, description, role, and actions
  - Role selector with all available roles
  - Action multi-select from predefined list
  - "Save Changes" button with dirty state detection
- Created `/client/src/components/workflow-designer/TransitionPropertiesPanel.tsx`
  - Edit transition label and isDefault flag
  - Shows source and target step names
  - Placeholder for condition editing (Phase 6)
- Integrated both panels into WorkflowDesignerPage
- Node/edge selection handlers implemented
- Conditional rendering: shows step panel for nodes, transition panel for edges

**Key Implementation Details:**

**WorkflowEngine Features:**
- Evaluates action-based conditions (e.g., "if approved")
- Evaluates field-based conditions with 10 operators (equals, greaterThan, contains, isEmpty, etc.)
- Evaluates compound conditions (AND/OR logic with nested conditions)
- Determines next step based on transitions
- Validates workflow structure (start/end steps, transitions, conditions)
- Supports legacy linear workflows (backwards compatible)

**Enhanced Workflow Step Schema:**
```typescript
interface WorkflowStep {
  id: string;                    // UUID
  type: 'start' | 'step' | 'decision' | 'end';
  title: string;
  role?: string;                 // For step type
  actions?: string[];            // Available actions
  position: { x, y };            // Canvas coordinates
  transitions?: WorkflowTransition[];
}

interface WorkflowTransition {
  id: string;
  targetStepId: string;          // Points to next step
  condition?: WorkflowCondition; // Optional branching logic
  label?: string;                // Display label
  isDefault?: boolean;           // Fallback path
}
```

**Backend-Frontend Integration:**
- WorkflowEngine imported in storage.ts for workflow advancement
- advanceApplicationWorkflow now checks if workflow is enhanced (has step IDs)
- If enhanced: uses WorkflowEngine.getNextStep() with form data + action
- If legacy: simple index increment (backwards compatible)
- Proper error handling for missing next steps

**Files Created:**
- `/db/migrations/008_add_workflow_versioning.sql`
- `/shared/workflowTypes.ts` - Complete type definitions
- `/server/workflowEngine.ts` - Condition evaluation engine
- `/client/src/stores/workflowDesignerStore.ts` - State management
- `/client/src/components/workflow-designer/nodes/StartNode.tsx`
- `/client/src/components/workflow-designer/nodes/StepNode.tsx`
- `/client/src/components/workflow-designer/nodes/DecisionNode.tsx`
- `/client/src/components/workflow-designer/nodes/EndNode.tsx`
- `/client/src/components/workflow-designer/nodes/index.ts`
- `/client/src/pages/WorkflowDesignerPage.tsx` - Main designer page
- `/client/src/components/workflow-designer/StepPropertiesPanel.tsx`
- `/client/src/components/workflow-designer/TransitionPropertiesPanel.tsx`

**Files Modified:**
- `/server/routes.ts` - Added workflowEngine import, 8 new endpoints
- `/server/storage.ts` - Added 4 new methods, updated advanceApplicationWorkflow
- `/client/src/App.tsx` - Added workflow designer route
- `package.json` - Added reactflow dependency

**Remaining Work (Phases 6-11):**
- Phase 6: Condition builder UI (for transition condition editing)
- Phase 7: Template management pages (list, clone dialog)
- Phase 8: Node palette & toolbar (add/delete nodes)
- Phase 9: Validation & test workflow dialog
- Phase 10: Navigation integration & polish
- Phase 11: Tests & documentation

**Architecture Decisions:**
- Use React Flow for visual flowchart (industry standard, ~200KB)
- Sequential workflows only (no parallel approval paths per requirements)
- Branching based on actions AND form field values
- Templates as blueprints (clone to modify)
- Full implementation approach (not MVP)

**Next Steps for Continuation:**
1. ✅ Create WorkflowDesignerPage skeleton with React Flow canvas
2. ✅ Build FlowCanvas component that converts store state to React Flow nodes
3. ✅ Create PropertiesPanel for editing selected nodes/transitions
4. **Next:** Build ConditionBuilder component for transition conditions
5. Create WorkflowTemplatesPage for template management (list, clone, delete)
6. Add node palette for adding/deleting nodes (drag-and-drop)
7. Add navigation menu item for Workflow Designer (admin only)
8. Test end-to-end: clone template → edit visually → save → test execution

**Plan File Location:**
`/home/runner/.claude/plans/glistening-riding-creek.md` - Complete 11-phase implementation plan

---

## Previous Session Status

### 🎯 Latest Session Summary (2025-11-26 - Azure Blob Storage Implementation)

**Major Accomplishments:**
1. ✅ Implemented complete Azure Blob Storage document management system
2. ✅ Added Required vs Optional document distinction with visual indicators
3. ✅ Implemented GUID-based hierarchical path structure with precalculation
4. ✅ Created DocumentUpload component with drag-and-drop support
5. ✅ Updated application workflow to create draft applications in Step 2
6. ✅ Updated all documentation to reflect GUID-based architecture

**Azure Blob Storage Architecture:**

**Path Structure (GUID-Based):**
```
application-documents/
├── {tenant-guid}/
│   ├── {application-guid}/
│   │   ├── {document-guid}.pdf
│   │   ├── {document-guid}.jpg
│   │   └── {document-guid}.png
```

**Key Design Decision: Path Precalculation**
- Document ID generated once at upload time: `crypto.randomUUID()`
- Full path constructed immediately: `${tenantId}/${applicationId}/${documentId}.${ext}`
- Path stored in database `blob_path` column
- No runtime reassembly required - path retrieved directly from database
- Performance benefit: avoids multiple table joins for every download/delete operation

**Implementation Details:**

**1. Document Types (Required vs Optional)**
- **File:** `shared/additionalInfoTypes.ts`
- Added `DocumentRequirement` interface with `name`, `required`, `description`
- Updated `AdditionalInfoConfig` to include optional `documents` array
- Backward compatibility maintained with `required_documents` field

**2. Database Schema**
- **File:** `shared/schema.ts` (lines 177-190)
- New `documents` table with fields:
  - `blobPath` (text) - Full precalculated path
  - `fileName` (text) - Original filename for display
  - `fileSize`, `mimeType`, `uploadedByUserId`, `uploadedAt`
  - `applicationId` (FK with cascade delete)
  - `demoCodeId` (FK for demo isolation)
- Renamed column: `blob_name` → `blob_path` to reflect full path storage

**3. Azure Storage Service**
- **File:** `server/azureBlobStorage.ts`
- Installed `@azure/storage-blob` SDK
- Created `AzureBlobStorageService` class with methods:
  - `uploadFile()` - Accepts precalculated `blobPath`
  - `downloadFile()` - Downloads file as Buffer
  - `deleteFile()` - Removes blob from storage
  - `getDownloadUrl()` - Gets URL for download
  - `blobExists()` - Checks blob existence
  - `listBlobsByPrefix()` - Lists blobs under path prefix
- Supports both connection string and SAS token authentication
- Creates containers automatically (idempotent)

**4. Backend API Endpoints**
- **File:** `server/routes.ts`
- Installed `multer` for file upload handling (in-memory, 50MB limit)
- **POST** `/api/applications/:applicationId/documents`
  - Generates `documentId` with `crypto.randomUUID()`
  - Extracts file extension from original filename
  - Constructs full path: `${tenantId}/${applicationId}/${documentId}.${ext}`
  - Uploads to Azure with precalculated path
  - Stores metadata in database with same `documentId` and `blobPath`
- **GET** `/api/applications/:applicationId/documents` - List documents
- **GET** `/api/documents/:id/download` - Download document
- **DELETE** `/api/documents/:id` - Delete document (with permission check)
- All operations use stored `blobPath` directly

**5. Storage Layer Methods**
- **File:** `server/storage.ts` (lines 720-758)
- `createDocument()` - Insert document record
- `getDocument()` - Retrieve by ID
- `listDocumentsByApplication()` - Get all docs for application
- `deleteDocument()` - Remove document record
- `getDocumentsByRequirement()` - Filter by requirement name

**6. Frontend API Client**
- **File:** `client/src/lib/api.ts` (lines 427-468)
- `uploadDocument()` - FormData upload with progress support
- `listDocuments()` - Fetch application documents
- `getDocumentDownloadUrl()` - Construct download URL
- `deleteDocument()` - Remove document

**7. DocumentUpload Component**
- **File:** `client/src/components/DocumentUpload.tsx` (NEW - 390 lines)
- Features:
  - Progress indicator: "X of Y required documents uploaded"
  - Visual distinction: Required (red) vs Optional (muted)
  - Drag-and-drop zones for each document requirement
  - File size formatting and upload timestamps
  - Download and delete actions with permission checks
  - Real-time upload progress tracking
  - Error handling with user-friendly messages
- Uses React Query for data fetching and mutations
- Integrates with shadcn/ui components (Card, Button, Alert, Badge)

**8. Application Wizard Updates**
- **File:** `client/src/components/ApplicationWizard.tsx` (lines 147-240)
- Updated workflow to create application as "draft" in Step 2
- Provides `applicationId` for document uploads in Step 3
- Final submission in Step 4 updates status from "draft" to "pending"
- Calculates completeness score based on filled fields
- Auto-generates application number: `APP-{year}-{sequence}`

**9. DynamicAdditionalInfoForm Updates**
- **File:** `client/src/components/DynamicAdditionalInfoForm.tsx`
- Updated to display document requirements from `formConfig.documents`
- Shows required documents with red indicator
- Shows optional documents with muted styling
- Displays document descriptions as guidance text

**10. Documentation**
- **File:** `server/AZURE_STORAGE_STRUCTURE.md`
- Comprehensive documentation of:
  - GUID-based container structure
  - Path construction and precalculation strategy
  - Implementation examples with actual code
  - Querying patterns for documents
  - Lifecycle management strategies
  - Future enhancements (versioning, soft delete, CDN)
  - Monitoring and cost tracking examples
- Updated all examples to use GUID paths instead of human-readable names

**Benefits of GUID-Based Precalculated Paths:**
1. **Performance** - No runtime path assembly, direct retrieval from database
2. **Simplicity** - Single database lookup for document operations
3. **Consistency** - Path never changes, immune to tenant/application renames
4. **Scalability** - No complex joins needed for document access
5. **Security** - GUIDs are non-enumerable, harder to guess document URLs
6. **Flexibility** - Easy to implement access tiers and lifecycle policies

**Files Created:**
- `server/azureBlobStorage.ts` - Azure Blob Storage service (NEW)
- `server/AZURE_STORAGE_STRUCTURE.md` - Comprehensive documentation (NEW)
- `client/src/components/DocumentUpload.tsx` - Upload UI component (NEW)

**Files Modified:**
- `shared/schema.ts` - Added documents table, renamed blob_name to blob_path
- `shared/additionalInfoTypes.ts` - Added DocumentRequirement interface
- `server/routes.ts` - Added document upload/download/delete endpoints with GUID path logic
- `server/storage.ts` - Added 5 document CRUD methods
- `client/src/lib/api.ts` - Added document API client methods
- `client/src/components/ApplicationWizard.tsx` - Updated workflow for draft creation
- `client/src/components/DynamicAdditionalInfoForm.tsx` - Display document requirements
- `package.json` - Added @azure/storage-blob and multer dependencies

**Environment Variables Required:**
```bash
# Option 1: Connection String (Recommended)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...

# Option 2: SAS Token
AZURE_STORAGE_ACCOUNT_NAME=your-account-name
AZURE_STORAGE_SAS_TOKEN=?sv=2021-06-08&ss=b&srt=sco&sp=rwdlac&se=...
```

**Next Steps:**
1. Configure Azure Blob Storage credentials in environment
2. Test document upload end-to-end workflow
3. Verify GUID-based paths are correctly generated and stored
4. Test download and delete operations
5. Monitor storage usage and costs
6. Consider implementing lifecycle policies for cost optimization

---

### 🎯 Previous Session Summary (2025-11-24 - Part 2)

**Major Accomplishments:**
1. ✅ Added elegant 6-option application type selector
2. ✅ Fixed demo login race condition (state clearing)
3. ✅ Added POA Association logo favicon
4. ✅ Fixed Directory to require property filter for management users
5. ✅ Fixed JSX syntax errors and missing imports

**Application Type Selector Implementation:**

Created beautiful card-based UI for application submission with 6 types:
1. **Exterior Modifications** - Paint, siding, windows, doors, roofing
2. **Structural Changes** - Additions, extensions, modifications
3. **Landscaping** - Trees, plants, irrigation, hardscaping
4. **Fencing & Barriers** - Fences, gates, privacy screens, retaining walls
5. **Outdoor Structures** - Sheds, gazebos, pergolas, pools, outdoor kitchens
6. **Signage** - Address signs, decorative signs, business signage

**Features Implemented:**
- Card-based UI with icons (lucide-react) and hover effects
- Each card shows title, description, and example items
- Application completeness progress indicator (0% placeholder)
- Responsive design (mobile-first, grid layout)
- Routes: `/apply` → type selector, `/applications/submit/:typeId` → form

**Files Created:**
- `client/src/pages/ApplicationTypeSelect.tsx` - 6-card type selector

**Files Modified:**
- `client/src/App.tsx` - Added routes for type selector and individual forms

**Next Steps for Tomorrow: Complete Application Forms**

### Phase 1: Common Application Data Collection
Build a form component that collects standard information for ALL application types:
- **Project Title** (text input)
- **Property Address** (text input or dropdown from user's properties)
- **Description** (textarea)
- **Estimated Start Date** (date picker)
- **Estimated Completion Date** (date picker)
- **Contractor Information** (optional - name, company, license #)
- **Estimated Cost** (number input)

### Phase 2: Type-Specific Dynamic Forms
After common data, show type-specific custom form:
- Each application type has a unique form schema
- Forms built using AI Form Wizard functionality (already exists in codebase)
- Use the `DynamicForm` component with JSON schema
- Store schemas in database via `formTemplates` table

### Phase 3: Form Wizard Integration
**Key Insight:** Use existing AI form generation capabilities
- Admin/Management can create custom forms per application type
- Forms stored as JSON schemas in `formTemplates` table
- Each tenant can have different requirements for same application type
- Example: Markland POA's "Exterior Modifications" form vs Whispering Pines'

### Phase 4: Completeness Tracking
Implement the application completeness score:
- Calculate based on required vs filled fields
- Update progress bar in real-time as user fills form
- Store completion percentage with draft applications
- Show visual feedback (0% → 100%)

### Phase 5: Backend Integration
- Update ApplicationSubmit to accept `typeId` param
- Fetch appropriate form schema from database
- Save application with type, common data, and form responses
- Link to current user and tenant
- Set initial status (e.g., "draft" or "pending_review")

**Implementation Pattern:**
```typescript
// 1. Common data form
<CommonApplicationForm onComplete={(commonData) => {
  // 2. Load type-specific schema from database
  const schema = await api.getFormTemplateForType(typeId, tenantId);

  // 3. Show dynamic form
  <DynamicForm
    schema={schema}
    onSubmit={(formData) => {
      // 4. Combine and save
      api.createApplication({
        ...commonData,
        type: typeId,
        formData: formData,
        tenantId,
        userId,
        status: 'pending_review'
      });
    }}
  />
}}>
```

**Database Schema Notes:**
- `applications` table has `type` field - update to use application type IDs
- Link applications to `formTemplates` via `formTemplateId`
- Store type-specific responses in `formData` JSONB field

**Files to Create Tomorrow:**
- `client/src/components/CommonApplicationForm.tsx` - Shared data collection
- `client/src/components/ApplicationFormFlow.tsx` - Orchestrates common → dynamic form
- Update `client/src/pages/ApplicationSubmit.tsx` - Use typeId param

**Files to Modify Tomorrow:**
- `server/routes.ts` - Add endpoint to get form template by application type
- `server/storage.ts` - Add method to fetch form templates by type
- `client/src/lib/api.ts` - Add client methods for form templates

---

### 🎯 Previous Session Summary (2025-11-24 - Part 1)

**Major Accomplishments:**
1. ✅ Fixed Properties page bug - `getManagedProperties` SQL error
2. ✅ Implemented global property filter UI in sidebar
3. 📋 TODO: Update data-fetching pages to respect property filter

**Bug Fix Details:**
- **Issue:** Properties page showing error: `malformed array literal`
- **Root Cause:** `getManagedProperties` method in `server/storage.ts` was using SQL `ANY()` syntax incorrectly with Drizzle ORM
- **Solution:**
  - Replaced `sql ANY()` with `inArray()` at two locations (lines 174, 191)
  - Updated method to return both management companies AND communities (for dropdown support)
  - Added `inArray` to imports from drizzle-orm
- **Result:** Emily Foster now sees both Markland POA and Whispering Pines HOA on /properties page

**New Feature In Progress: Global Property Filter**

**Requirement:**
Management company users (like Emily Foster) need a property filter dropdown in the sidebar header that acts as a **global filter** across the entire application.

**UI Placement:**
- Located in sidebar header next to the logo/title (client/src/components/layout/DashboardLayout.tsx:148)
- Shows in the `SidebarHeader` component area

**Filter Behavior:**
- **Default:** "All Properties" - shows all data across all managed properties
- **When specific property selected:** Filters all application data to only that property:
  - Applications list (only that property's applications)
  - Directory (only users in that property)
  - Forms (only forms for that property)
  - Any other tenant-scoped data
- Acts as a tenant context override for management company users

**Implementation Status:**
1. ✅ Added `selectedPropertyFilter` state to Zustand store (lib/store.ts)
2. ✅ Created PropertyFilter dropdown in sidebar header (DashboardLayout.tsx)
3. ✅ Dropdown populated with properties from `getManagedProperties` API
4. ✅ Shows only for management company users (when currentTenant.type === 'management_company')
5. 📋 TODO: Update data-fetching pages to respect the filter:
   - Directory.tsx - Use `selectedPropertyFilter || currentTenant.id` for tenant ID
   - Dashboard.tsx - Currently uses placeholder data, needs real API calls
   - Any future pages that list tenant-scoped data

**What Was Implemented:**
- **Store (client/src/lib/store.ts):**
  - Added `selectedPropertyFilter: string | null` to state
  - Added `setSelectedPropertyFilter` action
  - Resets to null on logout via `clearState()`

- **UI (client/src/components/layout/DashboardLayout.tsx):**
  - Added property filter dropdown in SidebarHeader (line 161-199)
  - Fetches properties via `useQuery` with `getManagedProperties` API
  - Shows "All Properties" by default (selectedPropertyFilter = null)
  - Lists all communities (type='community') from managed properties
  - Only visible when currentTenant.type === 'management_company'
  - Uses Filter icon from lucide-react

**How to Use the Filter in Other Pages:**
```typescript
import { useAppStore } from '@/lib/store';

// In your component:
const { currentTenant, selectedPropertyFilter } = useAppStore();

// Use this for API calls instead of currentTenant.id:
const effectiveTenantId = selectedPropertyFilter || currentTenant?.id;

// Example in useQuery:
const { data } = useQuery({
  queryKey: ["applications", effectiveTenantId, selectedPropertyFilter],
  queryFn: () => api.listApplicationsForTenant(effectiveTenantId),
  enabled: !!effectiveTenantId,
});
```

**Technical Details:**
- Filter persists in Zustand (but maybe should NOT persist to localStorage for security)
- Resets to "All Properties" when user changes tenants or logs out
- Component placement: Inside `<SidebarHeader>` below the logo/title div
- Uses existing property data from `getManagedProperties` API

**Files Modified:**
- ✅ `client/src/lib/store.ts` - Added selectedPropertyFilter state and setter
- ✅ `client/src/components/layout/DashboardLayout.tsx` - Added PropertyFilter dropdown
- ✅ `server/storage.ts` - Fixed getManagedProperties bug (inArray instead of SQL ANY)

**Files That Need Updates (for future sessions):**
- 📋 `client/src/pages/Directory.tsx` - Add `selectedPropertyFilter || currentTenant.id` logic
- 📋 `client/src/pages/Dashboard.tsx` - Replace placeholder data with real API calls respecting filter
- 📋 `client/src/pages/FormBuilder.tsx` - Respect property filter when listing forms
- 📋 Any future pages showing tenant-scoped data

---

### 🎯 Previous Session Summary (2025-11-23 - Part 3)

**Major Accomplishments:**
1. ✅ Implemented Properties page with role-based filtering for account admins
2. ✅ Built complete CRUD functionality for property management
3. ✅ Added backend logic to get properties based on account_admin role
4. ✅ Implemented support for two organizational structures (management company and POA board as account admin)

**What Was Built:**

#### 1. Backend Storage Layer
**File:** `server/storage.ts`
- Added `getManagedProperties(userId)` method to IStorage interface
- Implements complex query logic:
  - Gets all tenants where user has `account_admin` role
  - If tenant is a community, includes that community
  - If tenant is a management company, includes all communities under that company
  - Returns deduplicated list of communities
- Uses Drizzle ORM with SQL for efficient querying

#### 2. API Endpoint
**File:** `server/routes.ts`
- Added `GET /api/properties` endpoint
- Authenticated users only
- Returns communities that the current user manages as account_admin
- Supports both demo session auth and Replit OAuth auth

#### 3. Client API Method
**File:** `client/src/lib/api.ts`
- Added `getManagedProperties()` method
- Returns list of Tenant objects (communities)
- Handles error responses appropriately

#### 4. Properties Page Component
**File:** `client/src/pages/Properties.tsx` (NEW)
- Full CRUD interface for property management:
  - **List View:** Table showing all managed properties
  - **Search:** Filter by property name, subdomain, or management company
  - **Create:** Form to add new property with subdomain validation
  - **Edit:** Update existing property details
  - **Delete:** Soft delete (deactivate) properties
- Features:
  - Shows property name, subdomain, management company, status, type (demo/production), creation date
  - Management company dropdown for assignment
  - Visual indicators (icons, badges) for property types
  - Responsive UI with shadcn/ui components
  - Loading states and error handling
- **Role-Based Access:** Only shows properties where user is account_admin
- **Organizational Flexibility:** Supports both scenarios:
  1. Management company as account admin (sees all their communities)
  2. POA board as account admin (sees just their community)

#### 5. Route Configuration
**File:** `client/src/App.tsx`
- Added `/properties` route
- Wrapped in DashboardLayout
- Available to authenticated users

**Technical Implementation Details:**

**Backend Query Logic (storage.ts:140-194):**
```typescript
async getManagedProperties(userId: string): Promise<schema.Tenant[]> {
  // 1. Get all tenants where user has account_admin role
  const adminRoles = await db.select()
    .from(schema.userTenantRoles)
    .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
    .where(and(
      eq(schema.userTenantRoles.userId, userId),
      eq(schema.userTenantRoles.role, 'account_admin')
    ));

  // 2. Collect community IDs and management company IDs
  const communityIds = new Set<string>();
  const managementCompanyIds: string[] = [];

  for (const role of adminRoles) {
    if (role.tenants.type === 'community') {
      communityIds.add(role.tenants.id);
    } else if (role.tenants.type === 'management_company') {
      managementCompanyIds.push(role.tenants.id);
    }
  }

  // 3. Get all communities managed by the management companies
  if (managementCompanyIds.length > 0) {
    const managedCommunities = await db.select()
      .from(schema.tenants)
      .where(and(
        eq(schema.tenants.type, 'community'),
        sql`${schema.tenants.managementCompanyId} = ANY(${managementCompanyIds})`
      ));

    for (const community of managedCommunities) {
      communityIds.add(community.id);
    }
  }

  // 4. Fetch all unique communities
  return await db.select()
    .from(schema.tenants)
    .where(sql`${schema.tenants.id} = ANY(${Array.from(communityIds)})`);
}
```

**Use Cases Supported:**
1. **Emily (Management Manager)** - Has account_admin on "Apex Management Solutions"
   - Sees all communities under Apex (Markland POA, Whispering Pines HOA)
   - Can create new communities and assign them to Apex

2. **POA Board with Account Admin** - Hypothetical board member with account_admin on specific community
   - Sees only their community
   - Can manage that community's details
   - Can still assign it to a management company

**Files Modified/Created:**
- `server/storage.ts` - Added getManagedProperties method
- `server/routes.ts` - Added GET /api/properties endpoint
- `client/src/lib/api.ts` - Added getManagedProperties method
- `client/src/pages/Properties.tsx` - **NEW** Full properties page
- `client/src/App.tsx` - Added /properties route

---

### 🎯 Previous Session Summary (2025-11-23 - Part 2)

**Major Accomplishments:**
1. ✅ Implemented comprehensive role-based menu filtering
2. ✅ Built multi-role support with context switcher
3. ✅ Created full user management Directory with RBAC
4. ✅ Implemented role-based permissions system
5. ✅ Added API endpoints for user invitation and role assignment

**What Was Built:**

#### 1. Role-Based Navigation Menu Filtering
- Added `roles` array to each navigation item specifying access
- Menu items now dynamically filter based on `currentUserRole`
- Homeowners only see: Dashboard, Applications, Submit Request
- Board members see full management menus
- Management roles see Properties and cross-community features

#### 2. Multi-Role Context Switcher
- **Store Updates:** Added `availableRolesForCurrentTenant` to track all user roles
- **Role Hierarchy:** Automatic selection of highest privilege role as default
- **UI Component:** Dropdown in sidebar footer for switching between roles
- **Visual Indicators:** Role-specific emojis and badges
- **Smart Detection:** Auto-updates when changing tenants

**Sarah Chen (Board Member) now has dual roles:**
- 👔 POA Board Member (sees all applications, can approve)
- 🏠 Homeowner (sees only her applications)
- Can switch context via sidebar dropdown

#### 3. User Management Directory (Complete CRUD)
**Backend:**
- New storage methods: `getTenantUsers`, `removeUserRole`, `removeUserFromTenant`
- 5 new API endpoints:
  - GET `/api/tenants/:tenantId/users` - List all users
  - POST `/api/tenants/:tenantId/users` - Invite/add user with roles
  - POST `/api/users/:userId/roles` - Assign additional role
  - DELETE `/api/users/:userId/roles/:role` - Remove specific role
  - DELETE `/api/tenants/:tenantId/users/:userId` - Remove user entirely

**Frontend:**
- Full Directory page at `/directory` with:
  - User list table with search/filter
  - Add User modal with role selection checkboxes
  - Edit User Roles modal (add/remove individual roles)
  - Remove User confirmation dialog
  - Role-based permission checks (who can do what)

**Permission Matrix Implemented:**
| Role | Can View | Can Invite | Can Assign Roles | Can Remove |
|------|----------|------------|------------------|------------|
| Board Contributor | ✅ | ❌ | ❌ | ❌ |
| Board Member | ✅ | ✅ Homeowners | ✅ Some | ❌ |
| Management Rep | ✅ | ✅ All | ✅ Most | ❌ |
| Management Manager | ✅ | ✅ All | ✅ All | ✅ |
| Account Admin | ✅ | ✅ All | ✅ All | ✅ |

**Files Modified/Created:**
- `server/storage.ts` - Added user management methods
- `server/routes.ts` - Added 5 user management endpoints
- `client/src/lib/api.ts` - Added client-side API methods
- `client/src/lib/store.ts` - Added multi-role support
- `client/src/hooks/useUserTenants.ts` - Added role detection logic
- `client/src/components/layout/DashboardLayout.tsx` - Added role switcher UI
- `client/src/lib/mock-data.ts` - Added roles to navigation items
- `client/src/pages/Directory.tsx` - **NEW** Full directory page
- `client/src/App.tsx` - Added /directory route
- `server/provision.ts` - Sarah now gets both board_member and homeowner roles

---

## 🚀 Next Steps (Priority Order)

### **Phase 1: Finalize RBAC & Directory (Testing)**
**Status:** Code complete, needs testing
**Priority:** High
**Tasks:**
1. Test Directory with all 4 demo personas (Emily, Sarah, James, Alex)
2. Verify permission matrix enforced correctly
3. Test role switcher with Sarah (dual roles)
4. Test invite flow: can board members only assign homeowner/contributor roles?
5. Test remove flow: can management manager remove users?
6. Edge case: prevent removing user's last role
7. Add user activity audit logging (who assigned/removed which role when)

### **Phase 2: Document Storage Integration**
**Status:** Not started
**Priority:** High
**Technology:** Azure Blob Storage
**Requirements:**
1. **Architecture Design:**
   - Container structure (per-tenant? per-application?)
   - Naming conventions for blobs
   - Security: SAS tokens vs connection strings
   - CDN integration for serving documents

2. **Backend Implementation:**
   - Azure SDK integration (`@azure/storage-blob`)
   - Environment variables for connection string
   - Upload endpoint: POST `/api/applications/:id/documents`
   - Download endpoint: GET `/api/documents/:id`
   - Delete endpoint: DELETE `/api/documents/:id`
   - Storage methods: `uploadDocument`, `getDocumentUrl`, `deleteDocument`

3. **Database Schema:**
   - New table: `documents`
     - id, applicationId, fileName, blobName, fileSize, mimeType, uploadedBy, uploadedAt
   - Track all uploaded documents with metadata

4. **Frontend Components:**
   - File upload component with drag-and-drop
   - Document list viewer in application detail
   - Preview modal for PDFs/images
   - Download button with progress indicator

5. **Considerations:**
   - File size limits (10MB? 50MB?)
   - Allowed file types (PDF, JPG, PNG, DOCX?)
   - Virus scanning integration?
   - Retention policy (auto-delete after application closed?)

### **Phase 3: AI-Driven Form Wizard Automation**
**Status:** Not started
**Priority:** Medium-High

**Vision:** Properties specify their design guidelines URL, then AI generates custom application forms by reading their actual rules and creating structured JSON forms matching the REFERENCE_ARCHITECTURE.md specification.

**Key Principle:** NOT open-ended prompts where users describe what they want. Instead, structured generation where AI reads the property's actual published guidelines and generates forms based on their real rules.

**Architecture:**

1. **Property Settings - Design Guidelines URL:**
   - New tenant setting: `designGuidelinesUrl` (string, nullable)
   - URL points to publicly posted covenants/design standards
   - Examples: Property website, HOA documents portal, Dropbox folder, etc.
   - AI will fetch and parse all content from this URL

2. **Form Generation Process:**
   - Property admin navigates to Form Wizard
   - Sees list of 6 application categories with status:
     - Exterior Modifications (✓ Custom form exists / ⚠ Using default / ➕ Generate custom)
     - Structural Changes
     - Landscaping
     - Fencing & Barriers
     - Outdoor Structures
     - Signage
   - For each category, options:
     - **View/Edit** existing form (if one exists)
     - **Generate with AI** - creates custom form from their guidelines
     - **Use Default** - use generic template

3. **AI Generation Flow:**
   ```
   Input:
   - tenantId (to get designGuidelinesUrl)
   - applicationType (e.g., "exterior-modifications")
   - Reference architecture JSON structure

   AI Process:
   1. Fetch tenant's designGuidelinesUrl from database
   2. Use WebFetch to read all content from that URL (and linked pages)
   3. Parse property-specific rules, requirements, restrictions, bylaws
   4. Call Anthropic API with structured prompt:
      - "Generate a {applicationType} form matching this JSON structure"
      - "Base it on these design guidelines: {fetched content}"
      - "Include actual bylaw quotes in relevantBylaws fields"
      - "Create appropriate fields for their specific requirements"
   5. Receive generated JSON matching REFERENCE_ARCHITECTURE structure
   6. Validate against schema
   7. Return to frontend for preview/editing

   Output Structure (see /ref_docs/REFERENCE_ARCHITECTURE.md):
   {
     "title": "...",
     "description": "...",
     "relevantBylaws": {
       "primary": { section, document, summary, keyRequirements, quote },
       "additionalReferences": [...]
     },
     "sections": [
       {
         "title": "...",
         "fields": [
           { id, label, type, required, options, description, relevantBylaws, ... }
         ]
       }
     ],
     "required_documents": [...],
     "scoring_weights": { fieldId: weight, ... },
     "complianceNotes": { ... }
   }
   ```

4. **Reference Examples:**
   - See `/ref_docs/REFERENCE_ARCHITECTURE.md` for complete JSON schema documentation
   - See `/ref_docs/*.json` for 6 vision examples (target quality):
     - exterior-modifications.json (very detailed, includes Markland-specific bylaws)
     - structural-changes.json (comprehensive structural requirements)
     - landscaping.json
     - fencing.json
     - outdoor-structures.json
     - signage.json
   - All generated forms must match this exact structure

5. **Backend Implementation:**
   - **Database Schema Changes:**
     - Add `designGuidelinesUrl` to tenants table (nullable varchar)
     - Create `ai_form_generations` table:
       - id, tenantId, applicationType, designGuidelinesUrl (snapshot)
       - generatedSchema (jsonb), status (draft/approved/rejected)
       - tokensUsed, cost, createdBy, createdAt, approvedBy, approvedAt

   - **New API Endpoints:**
     - `GET /api/tenants/:id/design-guidelines` - Get tenant's guidelines URL
     - `PUT /api/tenants/:id/design-guidelines` - Update guidelines URL
     - `POST /api/ai/generate-form` - Generate form
       - Request: `{ tenantId, applicationType }`
       - Response: `{ generatedForm, generationId, tokensUsed, cost }`
     - `GET /api/admin/ai-generations` - List all AI generations (admin dashboard)
     - `GET /api/admin/ai-generations/:id` - Get specific generation details

   - **AdditionalInfoService Updates:**
     - Existing: `getAdditionalInfoConfig(projectType)` loads from `/server/config/additional-info/*.json`
     - New: Check if tenant has custom form first, fallback to default
     - New: `generateCustomForm(tenantId, applicationType)` - AI generation logic
     - New: `saveCustomForm(tenantId, applicationType, formJson)` - Save to database

6. **Frontend Implementation:**

   - **Property Settings Page Updates:**
     - Add "Design Guidelines" section
     - Input field for designGuidelinesUrl
     - Validation: URL format, accessibility check
     - Save button updates tenant settings

   - **Form Wizard Page (NEW):**
     - Location: `/admin/form-wizard` or `/forms/wizard`
     - Layout: Grid of 6 application type cards
     - Each card shows:
       - Type name and icon
       - Current status (custom/default/none)
       - "View/Edit" button (if form exists)
       - "Generate with AI" button
       - "Use Default" button
     - Click "Generate with AI":
       - Shows loading modal "Fetching your guidelines..."
       - "Reading design standards..."
       - "Generating custom form..."
       - Shows preview of generated form
       - Options: Save, Edit, Regenerate, Cancel
     - Form editor: JSON editor or visual form builder

   - **Admin AI Activity Dashboard:**
     - Location: `/admin/ai-activity`
     - Table of all AI generations across all properties
     - Columns: Date, Property, Type, Status, Tokens, Cost, Generated By
     - Filters: Property, Date range, Status
     - Click row: View generated form, approval actions

7. **Safety & Quality:**
   - **Prompt Engineering:**
     - Structured system prompt defining JSON schema requirements
     - Clear instructions to extract and cite actual bylaws
     - Examples of good vs bad form generation
     - Validation rules for field types and required properties

   - **Schema Validation:**
     - TypeScript interfaces for form structure
     - Runtime validation using Zod
     - Reject malformed JSON before saving

   - **Human Review Workflow:**
     - Generated forms start in "draft" status
     - Property admin can preview, edit, approve
     - Optional: Require super admin approval before activation

   - **Rate Limiting:**
     - Max X generations per tenant per day
     - Max Y generations per tenant per month
     - Prevents abuse and cost overruns

   - **Cost Tracking:**
     - Track tokens per generation
     - Calculate cost (tokens * price per token)
     - Monthly reports per tenant
     - Budget alerts for super admin

8. **Fallback & Error Handling:**
   - If designGuidelinesUrl not set: Show message, prompt to add URL
   - If URL fetch fails: Show error, offer to retry or use default
   - If AI generation fails: Log error, offer to retry or use default
   - If AI returns malformed JSON: Validate, show errors, offer to regenerate
   - Always have default forms available as fallback

9. **UI/UX Flow Example:**
   ```
   Property Admin Flow:
   1. Go to Settings → Design Guidelines
   2. Enter URL: https://marklandpoa.com/design-standards
   3. Save
   4. Go to Form Wizard
   5. See 6 cards: "Exterior Modifications" shows "Using Default Form"
   6. Click "Generate with AI"
   7. Modal: "Reading your design guidelines from marklandpoa.com..."
   8. Modal: "Analyzing architectural standards and bylaw requirements..."
   9. Modal: "Generating custom form..."
   10. Preview appears: Shows generated form with Markland-specific fields
   11. Review: See bylaw quotes, field options match their rules
   12. Click "Save Custom Form"
   13. Confirmation: "Custom form saved! Now active for Exterior Modifications."
   14. Homeowners now use this custom form when submitting applications
   ```

### **Phase 4: Testing & Documentation**
**Status:** Ongoing
**Tasks:**
1. Write integration tests for RBAC
2. E2E tests for user management flow
3. Document API endpoints (OpenAPI/Swagger?)
4. Update deployment guide with Azure Blob setup
5. Create admin guide for managing users and monitoring AI

---

### 🎯 Earlier Session Summary (2025-11-23 - Part 1)

**Major Accomplishments:**
1. ✅ Fixed all demo user authentication issues (401 errors)
2. ✅ Implemented demo code persistence in localStorage
3. ✅ Built complete subdomain routing functionality
4. ✅ Fixed logout redirect loops
5. ✅ Created comprehensive deployment guide for production

**Commits Today:**
- `1557fd3` - Add comprehensive subdomain deployment guide
- `44cb009` - Implement subdomain-based tenant routing
- `eb6fc18` - Add debug logging and explicit session save
- `d9f67ff` - Fix session cookie configuration for local development
- `5adc196` - Add demo code persistence to localStorage
- `c363ea2` - Fix logout redirect loop with ?logout=true parameter
- `73581d9` - Fix isAuthenticated middleware to support demo session auth
- `d0cc76a` - Fix sign out race condition for demo users
- `6650f05` - Document sign out race condition fix in session handoff
- `0716fe8` - Document logout loop and communities fixes

---

## Current Status

### ✅ COMMITTED - Demo Ecosystem System (commit c0cc1f8)

**All phases completed, tested, and committed to main branch!**

### Latest Commit Summary
- 30 files changed, 8517 insertions
- Complete isolated demo ecosystem system with admin UI
- All backend and frontend components functional
- Documentation complete
- Automated tests passed

### Active Demo Codes (Available for Testing)
- **TEST2024** - Test Demo for E2E (expires: 2025-11-28)
- **DEMO2024** - Production Demo (expires: 2025-12-21)

### Environment Setup Required
Add to `.env` or Replit Secrets:
```
SUPER_ADMIN_EMAILS=your-email@example.com;another@example.com
```

### ✅ RESOLVED - Dashboard Routing & Role-Based Views (commit b359ce7)

**Issue:** Demo users getting 404 on `/dashboard` route after login

**Root Cause:**
- Demo login succeeded and set session cookie
- Navigation used wouter's `navigate()` which doesn't reload the page
- React Query cache still had "unauthorized" response from before login
- `useAuth` hook returned isAuthenticated: false
- Route fell through to 404

**Solution:**
- Changed `navigate('/dashboard')` to `window.location.href = '/dashboard'`
- Forces full page reload, refreshing auth state
- React Query fetches fresh user data
- Authentication succeeds, dashboard loads

**Discovery:** Role-based dashboards were already fully implemented!
- ✅ ManagementDashboard - Multi-community overview with stats
- ✅ BoardMemberDashboard - Review queue focused with approval workflow
- ✅ ContributorDashboard - Non-voting board contributor view
- ✅ HomeownerDashboard - Personal application management
- ✅ Auto-role detection via useUserTenants hook
- ✅ Dynamic role switching when changing tenant context

### ✅ RESOLVED - Sign Out Race Condition (commit d0cc76a)

**Issue:** After signing out of demo user A and signing into demo user B, user A's name still shows in bottom left

**Root Cause:**
- `/api/logout` endpoint only cleared Replit OAuth session, not express session
- Demo users store `req.session.userId` which wasn't being destroyed
- Zustand store persisted to localStorage and wasn't cleared on logout
- React Query cache wasn't being invalidated on logout

**Solution:**
- Created new `/api/auth/logout` endpoint that properly destroys express session
- Added `clearState()` method to Zustand store
- Updated logout flow to:
  1. Clear Zustand store and localStorage
  2. Clear React Query cache
  3. Destroy backend session via API
  4. Redirect to landing page

**Files Modified:**
- `server/routes.ts` - Added `/api/auth/logout` endpoint
- `client/src/lib/store.ts` - Added `clearState()` method
- `client/src/lib/api.ts` - Added `logout()` method
- `client/src/components/layout/DashboardLayout.tsx` - Updated logout handler

### ✅ RESOLVED - Logout Redirect Loop (commit c363ea2)

**Issue:** After clicking logout, screen would flicker and log user back in

**Root Cause:**
- Logout redirected to `/` (landing page)
- Page reloaded and checked authentication
- If session wasn't fully cleared yet (race condition), user appeared authenticated
- App.tsx redirected to `/dashboard` creating an infinite loop

**Solution:**
- Redirect to `/?logout=true` instead of just `/`
- Check for `logout=true` query parameter in App.tsx
- If present, show Landing page even if user appears authenticated
- Prevents redirect loop during session cleanup

**Files Modified:**
- `client/src/components/layout/DashboardLayout.tsx` - Redirect to `/?logout=true`
- `client/src/App.tsx` - Check for logout param to prevent redirect

### ✅ RESOLVED - Demo Users "No Communities Assigned" (commit 73581d9)

**Issue:** Emily (and all demo users) showed "No Communities Assigned" message

**Root Cause:**
- `isAuthenticated` middleware only checked for Replit OAuth auth (`req.user`)
- Demo users use session-based auth (`req.session.userId`)
- When demo users tried to access `/api/users/:userId/tenants`, they got 401 Unauthorized
- Frontend couldn't load tenant assignments, showing "No Communities Assigned"

**Solution:**
- Updated `isAuthenticated` middleware to check for both auth types:
  1. First check for demo session auth (`req.session.userId`)
  2. Then check for Replit OAuth auth (`req.user`)
- Demo users now pass authentication and can access protected routes

**Files Modified:**
- `server/replitAuth.ts` - Updated `isAuthenticated` middleware

### ✅ NEW FEATURE - Demo Code Persistence (commit 5adc196)

**Feature:** Seamless return to demo without re-entering code

**Implementation:**
- Demo codes are stored in localStorage (base64 encoded) after validation
- On return to `/demo` page, automatically validates stored code
- If valid, skips code entry and goes directly to persona selection
- If invalid/expired, clears stored code and shows entry form
- Stored code cleared on logout for security

**User Experience:**
1. User enters demo code once
2. Closes browser and returns later
3. Goes to `/demo` → automatically validated
4. Taken directly to persona selection
5. No need to re-enter code!

**Files Modified:**
- `client/src/pages/DemoCodeEntry.tsx` - Auto-validation on mount, localStorage storage
- `client/src/components/layout/DashboardLayout.tsx` - Clear demo code on logout

**Storage Key:** `poa-demo-code` (base64 encoded)

### ✅ NEW FEATURE - Subdomain Routing (commit 44cb009)

**Feature:** Tenant-specific subdomain access (e.g., markland.poassociation.com)

**How It Works:**
1. User visits `markland.poassociation.com`
2. Backend middleware detects subdomain from hostname
3. Frontend auto-selects Markland POA tenant
4. Tenant switcher is hidden (locked to subdomain tenant)
5. Header displays subdomain URL

**Testing on Replit:**
Since Replit doesn't support custom subdomains, use query parameter:
```
https://your-app.repl.co/dashboard?subdomain=markland
https://your-app.repl.co/dashboard?subdomain=whispering-pines
```

**Production Setup:**
Cloudflare DNS with wildcard CNAME → see `subdomain-deployment-guide.md`

**Backend Implementation:**
- Middleware detects subdomain from `req.hostname`
- Falls back to `?subdomain=` query parameter for testing
- Exposes via `/api/subdomain` endpoint
- Subdomain stored in `req.subdomain` for all routes

**Frontend Implementation:**
- New hook: `useSubdomain()` detects subdomain
- Auto-selects matching tenant from availableTenants
- Tenant switcher hidden when `isSubdomainMode === true`
- Header shows subdomain URL instead of "Context: Tenant Name"

**Files Added:**
- `client/src/hooks/useSubdomain.ts` - Subdomain detection and auto-selection
- `persistent-memory/subdomain-deployment-guide.md` - Complete production deployment guide

**Files Modified:**
- `server/routes.ts` - Subdomain middleware, `/api/subdomain` endpoint
- `client/src/components/layout/DashboardLayout.tsx` - Conditional UI based on subdomain mode

**Next Steps for Production:**
1. Deploy to hosting platform that supports wildcard subdomains (Railway, Vercel, Fly.io)
2. Configure Cloudflare DNS with wildcard CNAME
3. Add domain to hosting platform
4. Test subdomain routing

### 🐛 Known Issues to Triage

**Homeowner Role Permissions (Priority: Medium)**
- **Symptom:** James (homeowner) can see content he shouldn't have access to
- **To Investigate:**
  1. Check what applications he can see (should only see his own)
  2. Verify he can't access admin features
  3. Check community data access (should only see his community)
  4. Add permission checks to components that need role-based filtering

### Blockers/Issues
- None currently

### Implementation Status
- ✅ Phase 1: Database Schema
- ✅ Phase 2: Provisioning & Storage
- ✅ Phase 3: API Endpoints
- ✅ Phase 4: Frontend Pages (Demo Code Entry, Persona Select)
- ✅ Phase 5: Purge Script
- ✅ Phase 6: Testing & Documentation
- ✅ Phase 7: Admin UI (Complete - List, Form, Stats pages)
- ✅ Phase 8: Super Admin Access Control (Environment variable based)

---

## Implementation Progress: Isolated Demo Ecosystems

### Architecture Chosen
- **Fully isolated sandboxes** - Each demo code gets complete ecosystem
- **No behavioral differences** - Demo users are just regular users with demoCodeId
- **Cascade delete safety** - One DELETE removes entire demo ecosystem
- **Zero production risk** - Production data has demoCodeId = NULL

### Phase 1: Database Schema ✅ COMPLETE
**Files Modified:**
- `shared/schema.ts` - Added demoCodes, demoSessions tables, demoCodeId columns

**Schema Changes Applied:**
```sql
-- New tables
demo_codes (id, code, label, validFrom, validUntil, isActive, maxUses, currentUses, isProvisioned, provisionedAt, createdBy, createdAt, updatedAt)
demo_sessions (id, demoCodeId, userId, startedAt, endedAt, lastActivityAt, ipAddress, userAgent)

-- Added columns
users.demoCodeId → references demo_codes.id ON DELETE CASCADE
tenants.demoCodeId → references demo_codes.id ON DELETE CASCADE
user_tenant_roles.demoCodeId → references demo_codes.id ON DELETE CASCADE
form_templates.demoCodeId → references demo_codes.id ON DELETE CASCADE
applications.demoCodeId → references demo_codes.id ON DELETE CASCADE
```

**Database Changes:**
- All schema changes applied via `npm run db:push`
- Cascade delete working: deleting demo code removes all related data
- Production data safe: demoCodeId NULL for all existing records

### Phase 2: Provisioning & Storage ✅ COMPLETE
**Files Created/Modified:**
- `server/provision.ts` - Complete ecosystem provisioning function
- `server/storage.ts` - Added 12 demo-related methods to IStorage and DbStorage

**What Was Built:**
1. ✅ `provisionDemoEcosystem(demoCodeId)` function
   - Creates 1 management company (Apex Management Solutions)
   - Creates 2 communities (Markland POA, Whispering Pines HOA)
   - Creates 4 demo users (Emily Foster, Sarah Chen, James Martinez, Alex Rivera)
   - Assigns user roles to tenants
   - Creates 4 form templates (2 per community)
   - Creates 30 sample applications with realistic data
   - All tagged with demoCodeId

2. ✅ Storage layer methods:
   - `getDemoCode()`, `getDemoCodeByCode()`, `listDemoCodes()`
   - `createDemoCode()`, `updateDemoCode()`, `deleteDemoCode()`
   - `incrementDemoCodeUsage()`
   - `getDemoUsersByCodeId()`
   - `createDemoSession()`, `endDemoSession()`, `getDemoSessionStats()`

**Helper Functions:**
- `createSampleApplications()` - generates 30 realistic applications
- `generateRealisticFormData()` - creates believable form submissions
- `generateReviewNotes()` - adds contextual review comments
- `createPaintFenceSchema()` - simple form schema
- `createLandscapingSchema()` - medium complexity form

### Phase 3: API Endpoints ✅ COMPLETE
**Files Modified:**
- `server/routes.ts` - Added 8 demo-related endpoints

**Public Endpoints (no auth required):**
1. ✅ `POST /api/demo/validate-code` - Validates demo code, checks expiration, returns personas
2. ✅ `POST /api/demo/login` - Logs in as demo persona, creates session, tracks usage

**Admin Endpoints (auth + super_admin required):**
3. ✅ `GET /api/admin/demo-codes` - Lists all demo codes
4. ✅ `POST /api/admin/demo-codes` - Creates demo code + triggers async provisioning
5. ✅ `PATCH /api/admin/demo-codes/:id` - Updates demo code (activate/deactivate, extend dates)
6. ✅ `DELETE /api/admin/demo-codes/:id` - Deletes demo code (cascade deletes ecosystem)
7. ✅ `GET /api/admin/demo-codes/:id/stats` - Gets usage stats and session analytics

**Auth Updates:**
- ✅ Modified `/api/auth/user` to handle both Replit auth and demo session auth
- ✅ Added `requireSuperAdmin` middleware (TODO: implement proper role checking)

**Key Features:**
- Demo code validation checks: active, provisioned, date range, usage limit
- Demo login creates standard session (no special demo flags)
- Async provisioning doesn't block API response
- Cascade delete removes entire ecosystem safely
- Session tracking for analytics

### Phase 4: Frontend Pages ✅ COMPLETE
**Files Created/Modified:**
- `client/src/pages/DemoCodeEntry.tsx` - Beautiful splash page with code input
- `client/src/pages/DemoPersonaSelect.tsx` - Grid of 4 personas with one-click login
- `client/src/pages/Landing.tsx` - Added "View Demo" button
- `client/src/App.tsx` - Added /demo and /demo/personas routes
- `client/src/lib/api.ts` - Added 7 demo-related API methods

**What Was Built:**
1. ✅ `DemoCodeEntry.tsx`
   - Logo and marketing content (3 feature highlights)
   - Code input with uppercase auto-formatting
   - Validation with loading states
   - Stores demo info in sessionStorage
   - Navigates to persona selection on success

2. ✅ `DemoPersonaSelect.tsx`
   - Displays 4 personas in responsive grid
   - Each persona has: icon, gradient, title, description, feature list
   - One-click login functionality
   - Loading states per persona
   - Clears sessionStorage after login
   - Redirects to dashboard as authenticated demo user

3. ✅ `Landing.tsx`
   - Added "View Demo" button next to "Get Started"
   - Uses outline variant for secondary CTA
   - Navigates to /demo route

4. ✅ `App.tsx`
   - Added demo routes BEFORE authentication check
   - Routes accessible without auth: /demo, /demo/personas
   - Maintains existing authenticated routes

5. ✅ API Client (`client/src/lib/api.ts`)
   - `validateDemoCode()` - validates code, returns personas
   - `loginAsDemo()` - creates demo session
   - `listDemoCodes()` - admin: list all codes
   - `createDemoCode()` - admin: create new code
   - `updateDemoCode()` - admin: update code
   - `deleteDemoCode()` - admin: delete code + ecosystem
   - `getDemoCodeStats()` - admin: get usage analytics

**Persona Configuration:**
```typescript
const PERSONA_INFO = {
  'Emily': { title: 'Management Company Manager', icon: Building, gradient: 'from-blue-500 to-blue-600' },
  'Sarah': { title: 'POA Board Member', icon: ShieldCheck, gradient: 'from-purple-500 to-purple-600' },
  'James': { title: 'Homeowner / Resident', icon: Home, gradient: 'from-green-500 to-green-600' },
  'Alex': { title: 'Board Contributor', icon: Users, gradient: 'from-orange-500 to-orange-600' },
};
```

### Phase 5: Purge Script ✅ COMPLETE
**Files Created:**
- `server/purgeExpiredDemos.ts` - Automated cleanup script for expired demos

**What Was Built:**
1. ✅ `purgeExpiredDemos()` function
   - Finds all demo codes where validUntil < NOW()
   - Displays detailed info: code, label, days expired, usage stats
   - Deletes demo codes (cascade removes entire ecosystem)
   - Returns structured result with deleted codes
   - Supports dry-run mode

2. ✅ `purgeInactiveDemos()` function
   - Finds all demo codes marked as inactive
   - Optional cleanup for failed provisioning or deactivated codes
   - Same dry-run support

3. ✅ CLI Interface
   - Can be run directly: `tsx server/purgeExpiredDemos.ts`
   - Flags: `--dry-run` (preview without deleting), `--inactive` (include inactive codes)
   - Detailed console output with emoji indicators
   - Exit codes for scripting (0 = success, 1 = failure)

**Safety Features:**
- Dry-run mode by default can be enabled
- Detailed logging before deletion
- Stats display before purge
- No production data risk (demoCodeId = NULL)
- Transaction safety via cascade delete

### Phase 6: Admin UI (OPTIONAL - NOT IMPLEMENTED)
**Could Build Later:**
- Admin dashboard page for demo code management
- List view of all demo codes with status
- Create/edit forms for demo codes
- Real-time stats and session monitoring
- Manual provisioning trigger UI

**Not critical because:**
- Demo codes can be created via API directly
- Database admin tools can manage codes
- CLI script handles cleanup
- Focus was on user-facing demo experience

---

## Recent Session Summary

### Session 1: Initial Exploration (2025-11-21)

**Objectives:**
- Perform first-time comprehensive app exploration
- Create persistent memory folder structure
- Document application architecture and patterns

**Key Actions:**
1. Used Explore agent with "very thorough" setting to analyze entire codebase
2. Documented findings in comprehensive exploration report
3. Created `/persistent-memory` folder in workspace
4. Created this session-handoff document
5. Creating global-memory document with patterns and conventions

**Outcomes:**
- Complete understanding of POA Association multi-tenant SaaS platform
- Identified tech stack: React 19, Vite 7, Tailwind 4, Express, Neon PostgreSQL, Drizzle ORM
- Documented all 5 database tables and their relationships
- Mapped 72 client TypeScript files and 55 UI components
- Discovered 12 API endpoints with RESTful design
- Found no tests currently implemented (testing opportunity)
- Rebranded entire application from CivicFlow to POA Association (poassociation.com)

**Decisions Made:**
- Created persistent memory system in workspace root under `persistent-memory/`
- Using Markdown format for memory documents for readability
- Session handoff will track progress between sessions
- Global memory will capture reusable patterns and conventions

**Next Session Plan: Super Admin Management UI**

**Goal:** Build comprehensive super admin interface for managing the entire application hierarchy

**Features to Implement:**

1. **Management Company Management**
   - List all management companies
   - Create new management company
   - Edit management company details (name, subdomain, settings)
   - View communities under management company
   - Deactivate/reactivate management companies

2. **Community Management**
   - List all communities (filterable by management company)
   - Create new community
   - Edit community details (name, subdomain, parent management company)
   - View community stats (users, applications, forms)
   - Deactivate/reactivate communities

3. **RBAC User Assignment**
   - View all users in the system
   - Assign users to tenants with specific roles
   - Manage user-tenant-role relationships
   - Bulk assignment capabilities
   - Role hierarchy visualization

4. **Tenant Subdomain Management**
   - View/edit subdomain for each tenant
   - Validate subdomain uniqueness
   - Preview subdomain URL
   - Test subdomain routing

**Database Schema Notes:**
- `tenants` table already has all needed fields:
  - `type`: 'management_company' | 'community'
  - `subdomain`: unique subdomain
  - `managementCompanyId`: parent relationship
  - `isActive`: soft delete flag
- `userTenantRoles` table handles RBAC:
  - `userId`, `tenantId`, `role`
  - Already has 8 role types defined

**Implementation Approach:**
1. Create super admin navigation section in DashboardLayout
2. Build management companies list/form pages
3. Build communities list/form pages
4. Build user-role assignment interface
5. Add subdomain management to tenant forms
6. Add validation and error handling
7. Test with demo data

**Files to Create:**
- `client/src/pages/admin/ManagementCompanies.tsx`
- `client/src/pages/admin/ManagementCompanyForm.tsx`
- `client/src/pages/admin/Communities.tsx`
- `client/src/pages/admin/CommunityForm.tsx`
- `client/src/pages/admin/UserRoles.tsx`

**API Endpoints Needed:**
Most CRUD endpoints already exist! May need to add:
- `POST /api/admin/users/:userId/roles` - Assign role
- `DELETE /api/admin/user-roles/:id` - Remove role assignment
- `GET /api/admin/tenants/hierarchy` - Get tenant hierarchy tree

**Next Session Recommendations:**
- Start with management companies list view
- Reuse existing tenant CRUD endpoints where possible
- Focus on super admin access control (check SUPER_ADMIN_EMAILS)
- Test with demo ecosystem data

---

## Context for Next Agent

### What You Should Know
1. **Application Type:** Full-stack TypeScript SaaS for community/HOA management
2. **Key Features:**
   - Multi-tenant architecture with subdomain isolation (simulated)
   - Dynamic JSON schema-driven forms with AI generation UI
   - Role-based access control (8 user roles)
   - Architectural review board (ARB) application workflows
   - Comprehensive Markland POA structural changes form (50+ fields)

3. **Tech Stack Highlights:**
   - Frontend: React 19 + Vite 7 + Tailwind 4 + shadcn/ui
   - State: React Query + Zustand + React Hook Form
   - Backend: Express + TypeScript + Drizzle ORM
   - Database: Neon Serverless PostgreSQL
   - Routing: Wouter (lightweight)
   - Validation: Zod schemas

4. **Code Organization:**
   - `client/` - React frontend application
   - `server/` - Express backend (4 main files: index, routes, storage, vite)
   - `shared/` - Shared schema definitions
   - `attached_assets/` - Generated images and form schemas

5. **Important Files:**
   - `shared/schema.ts` - Single source of truth for database schema
   - `client/src/lib/api.ts` - API client for all backend calls
   - `client/src/components/DynamicForm.tsx` - Core form renderer
   - `server/routes.ts` - All API endpoint definitions
   - `server/storage.ts` - Database access layer (repository pattern)

6. **Current State:**
   - Application is functional with seeded database
   - No tests implemented yet
   - Git status shows `.replit` file modified
   - Last commit: "Saved progress at the end of the loop" (a1e3010)

### Known Patterns to Follow
- See `global-memory.md` for comprehensive pattern documentation
- Always use shared schema types from `@shared/schema`
- Use API client methods instead of direct fetch calls
- Follow shadcn/ui conventions for new components
- Maintain type safety with Zod validation on API boundaries

### Environment Notes
- Development: `npm run dev` (runs tsx + Vite with HMR)
- Build: `npm run build` (Vite + esbuild)
- Database: Uses DATABASE_URL environment variable
- Port: 5000 (mapped to 80 for deployment)
- Platform: Replit with autoscale deployment config

---

## Quick Reference

### Common Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build
npm run db:push      # Push schema changes to database
tsx server/seed.ts   # Seed database with sample data
```

### API Endpoints
```
GET    /api/tenants
GET    /api/tenants/subdomain/:subdomain
POST   /api/tenants
GET    /api/tenants/:tenantId/forms
POST   /api/tenants/:tenantId/forms
GET    /api/forms/:id
PATCH  /api/forms/:id
GET    /api/applications/:id
POST   /api/applications
GET    /api/tenants/:tenantId/applications
PATCH  /api/applications/:id/status
GET    /api/users/:userId/tenants
```

### Database Tables
- `users` - User accounts
- `tenants` - Communities and management companies
- `userTenantRoles` - Junction table for user-tenant-role relationships
- `formTemplates` - JSON schema form definitions
- `applications` - Submitted form data with workflow status

---

## Notes for Future Sessions

### Technical Debt / Improvements Identified
1. **No testing framework** - Opportunity to add Vitest/Playwright
2. **Test IDs present** but no tests using them
3. **Subdomain routing is simulated** - Could implement actual subdomain logic
4. **No authentication** implemented (Passport configured but not used)
5. **No migrations folder** exists yet (Drizzle configured but not used)

### Useful Context
- Application was built by Replit Agent in iterative commits
- Recent focus: connecting frontend to backend (commit d2d1447)
- Database seeding is manual via tsx server/seed.ts
- Forms are stored as JSONB, enabling runtime form creation
- Inline bylaws/regulations feature is unique to this app

---

## Handoff Checklist

Before ending a session, update this document with:
- [ ] Summary of work completed
- [ ] Any new blockers or issues discovered
- [ ] Git status and any uncommitted changes
- [ ] Recommendations for next session
- [ ] Any new patterns or conventions to document in global-memory.md
- [ ] Updated "Last Updated" timestamp at top
