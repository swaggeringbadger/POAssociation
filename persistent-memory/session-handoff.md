# Session Handoff Document

**Last Updated:** 2025-12-31
**Current Session:** Multiple AI Context Sources & Instructions Complete

---

## CURRENT STATE SUMMARY

### Just Completed (2025-12-31)

#### Multiple AI Context Sources & Instructions - COMPLETE

Built support for multiple document sources (URLs + uploaded files) and custom instructions for AI form generation and application analysis, replacing the single `designGuidelinesUrl` field.

**New Database Tables (in `shared/schema.ts`):**
- `ai_context_sources` - Multiple document sources (URL or uploaded) with priority ordering
  - Fields: id, tenantId, name, description, sourceType ('url' | 'uploaded_document')
  - URL fields: sourceUrl
  - Upload fields: blobPath, containerName, fileName, fileSize, mimeType
  - Scope: priority, appliesToAllForms, appliesToFormTypes
  - State: isActive (toggle), audit fields
- `ai_instructions` - Custom AI instructions at community or form-type level
  - Fields: id, tenantId, scope ('community' | 'form_type'), formType, title, instructions
  - State: isActive (toggle), audit fields

**New Service (in `server/services/aiContextService.ts`):**
- `AiContextService` class for aggregating context from multiple sources
- `gatherContext(tenantId, formType?)` - Main method to collect active sources
- `formatContextForPrompt()` - Format text documents for prompts
- `getPdfDocuments()` - Get PDF documents for Claude's document blocks API
- 15-minute content caching, token limit handling via priority ordering

**New Components (in `client/src/components/`):**
- `AiContextSourcesManager.tsx` - List view with add URL, upload file, toggle, edit, delete
- `AiInstructionsEditor.tsx` - Community + per-form-type instructions management

**Modified Components:**
- `CommunitySettingsCard.tsx` - Added collapsible "AI Configuration" section with both components

**New API Endpoints (in `server/routes.ts`):**
```
GET    /api/tenants/:tenantId/ai-context-sources
POST   /api/tenants/:tenantId/ai-context-sources          (URL source)
POST   /api/tenants/:tenantId/ai-context-sources/upload   (file upload)
PATCH  /api/tenants/:tenantId/ai-context-sources/:id
DELETE /api/tenants/:tenantId/ai-context-sources/:id
POST   /api/tenants/:tenantId/ai-context-sources/:id/toggle
POST   /api/tenants/:tenantId/ai-context-sources/reorder

GET    /api/tenants/:tenantId/ai-instructions
POST   /api/tenants/:tenantId/ai-instructions
PATCH  /api/tenants/:tenantId/ai-instructions/:id
DELETE /api/tenants/:tenantId/ai-instructions/:id
POST   /api/tenants/:tenantId/ai-instructions/:id/toggle
```

**New Storage Methods (in `server/storage.ts`):**
- Context sources: `listAiContextSources()`, `createAiContextSource()`, `updateAiContextSource()`, `deleteAiContextSource()`, `toggleAiContextSource()`, `reorderAiContextSources()`
- Instructions: `listAiInstructions()`, `createAiInstruction()`, `updateAiInstruction()`, `deleteAiInstruction()`, `toggleAiInstruction()`, `getActiveInstructionsForAnalysis()`

**Modified AI Services:**
- `server/services/aiAnalysisService.ts` - Uses `aiContextService.gatherContext()` with fallback to legacy URL
- `server/aiFormGenerationService.ts` - Added `generateFormWithContext()` method

**API Client Functions (in `client/src/lib/api.ts`):**
- Types: `AiContextSource`, `AiInstruction`, request types
- Full CRUD functions for both entities

**Backward Compatibility:**
- If no AI context sources exist, falls back to legacy `designGuidelinesUrl`
- Existing tenants continue to work without migration

---

### Previous Session (2025-12-30)

#### Meeting Agenda Presentation Mode - COMPLETE

Built a "flattened" presentation view for running live ARC review meetings with facilitator tracking, section completion, roll call attendance, and inline bylaws display.

**New Database Tables (in `shared/schema.ts`):**
- `meetingSectionCompletions` - Track which sections are completed during meeting (eventId, sectionId, completedAt, completedByUserId)
- `meetingAttendance` - Roll call attendance tracking (eventId, userId, status, attendeeRole, markedAt, markedByUserId)

**Modified Tables:**
- `events` - Added: `facilitatorUserId`, `facilitatorClaimedAt`, `meetingStartedAt`, `meetingEndedAt`

**New Components (in `client/src/components/agenda/`):**
- `RollCallAttendance.tsx` - Checkbox list of attendees grouped by role (board members, management)
- `InlineBylawDisplay.tsx` - Always-visible bylaw card (no hover/click) + FormLevelBylawsDisplay
- `MeetingControls.tsx` - Claim facilitator, start/end meeting buttons with elapsed timer
- `PresentationAgendaItem.tsx` - Agenda item with inline bylaws and full application details
- `PresentationAgendaSection.tsx` - Non-collapsible section with completion checkbox

**New Helper File:**
- `client/src/lib/bylawHelpers.ts` - Functions for extracting bylaws from form schemas

**New Page:**
- `client/src/pages/AgendaPresentation.tsx` - Presentation mode at `/calendar/events/:eventId/agenda/present`

**New API Endpoints (in `server/routes.ts`):**
```
POST /api/events/:eventId/facilitator/claim
POST /api/events/:eventId/facilitator/release
POST /api/events/:eventId/meeting/start
POST /api/events/:eventId/meeting/end
POST /api/events/:eventId/sections/:sectionId/complete
DELETE /api/events/:eventId/sections/:sectionId/complete
GET  /api/events/:eventId/attendance
POST /api/events/:eventId/attendance/initialize
PATCH /api/events/:eventId/attendance/:userId
POST /api/events/:eventId/attendance
GET  /api/events/:eventId/present (full presentation data)
```

**New Storage Methods (in `server/storage.ts`):**
- Facilitator: `claimFacilitator()`, `releaseFacilitator()`, `startMeeting()`, `endMeeting()`
- Section completions: `markSectionComplete()`, `unmarkSectionComplete()`, `getSectionCompletions()`
- Attendance: `initializeMeetingAttendance()`, `markAttendance()`, `addAttendee()`, `getMeetingAttendance()`
- `getEventPresentationData()` - Full presentation payload with bylaws

**RBAC (in `client/src/lib/rbac.ts`):**
- Added permission for `/calendar/events/:eventId/agenda/present`
- Roles with edit access: `poa_board_member`, `management_manager`, `account_admin`, `super_admin`
- Roles with view-only access: `poa_board_contributor`, `management_rep`

**UI Integration:**
- Added "Present Mode" button to MeetingAgenda.tsx (next to Print button)

---

### Previous Session (2025-12-26)

#### Intelligent Agenda System - UI Phase 1 Complete

Built the complete UI for the intelligent meeting agenda system with React components and a full-featured page.

**New Components (in `client/src/components/agenda/`):**
- `AgendaItem.tsx` - Individual agenda item card with decision recording, edit, and delete capabilities
- `AgendaSection.tsx` - Collapsible section displaying grouped agenda items with time estimates
- `AgendaSuggestions.tsx` - Smart suggestions panel with three tabs (New Business, Old Business, Final Approval)
- `index.ts` - Barrel export file

**New Page:**
- `client/src/pages/MeetingAgenda.tsx` - Full agenda management page at `/calendar/events/:eventId/agenda`

**Features Implemented:**
- View and manage agenda sections with collapsible UI
- Add discussion items, announcements, and motions to sections
- Record decisions (approved, rejected, tabled, needs info, conditional, deferred, withdrawn, recommended)
- Apply meeting templates to set up agenda structure
- Smart suggestions auto-categorized by review stage
- Finalize/unfinalize agenda (lock/unlock editing)
- Print-friendly styling
- Integration with Calendar page via dropdown menu

**Route Added (in `client/src/App.tsx`):**
- `/calendar/events/:eventId/agenda` - Meeting agenda page

**Calendar Integration (in `client/src/pages/Calendar.tsx`):**
- Added "Agenda" option to event dropdown menus (sidebar and list view)
- New icon: `ClipboardList` for agenda navigation

---

### Previous Session (2025-12-24)

#### Intelligent Agenda System - Backend Foundation

Built the complete backend for an intelligent meeting agenda system that auto-categorizes applications by review stage and provides structured meeting templates.

**New Database Tables (in `shared/schema.ts`):**
- `agenda_sections` - 9 predefined sections (Call to Order, Roll Call, Old Business, New Business, Final Approvals, etc.)
- `meeting_templates` - Reusable meeting structures (ARC Review Meeting, Board Meeting, Quick Review)
- `event_agenda_items` - Structured agenda items linked to sections with application/discussion support

**Modified Tables:**
- `events` - Added: `meetingTemplateId`, `agendaFinalized`, `agendaFinalizedAt`, `agendaFinalizedByUserId`

**New Files:**
- `server/seed-agenda.ts` - Seeds default agenda sections and 3 meeting templates

**Storage Layer Methods (in `server/storage.ts`):**
- `listAgendaSections()`, `getAgendaSectionBySlug()`
- `listMeetingTemplates()`, `getMeetingTemplate()`, `getDefaultMeetingTemplate()`, `createMeetingTemplate()`
- `getEventAgenda()`, `addAgendaItem()`, `updateAgendaItem()`, `deleteAgendaItem()`, `reorderAgendaItems()`
- `getApplicationJourney()` - Get meeting history for an application
- `getAgendaSuggestions()` - Smart suggestions categorized by review stage
- `finalizeEventAgenda()`, `unfinalizeEventAgenda()`

**API Endpoints (in `server/routes.ts`):**
```
GET  /api/agenda-sections                         # List all sections
GET  /api/meeting-templates                       # List templates
GET  /api/meeting-templates/:id                   # Get template
POST /api/meeting-templates                       # Create template
PATCH /api/meeting-templates/:id                  # Update template
GET  /api/events/:eventId/agenda                  # Full agenda with sections/items
GET  /api/events/:eventId/agenda/suggestions      # Smart suggestions
POST /api/events/:eventId/agenda/apply-template   # Apply template to event
POST /api/events/:eventId/agenda/items            # Add agenda item
PATCH /api/events/:eventId/agenda/items/:id       # Update item
DELETE /api/events/:eventId/agenda/items/:id      # Delete item
POST /api/events/:eventId/agenda/reorder          # Reorder items
POST /api/events/:eventId/agenda/finalize         # Lock agenda
POST /api/events/:eventId/agenda/unfinalize       # Unlock agenda
GET  /api/applications/:id/journey                # Application meeting history
```

**API Client Functions (in `client/src/lib/api.ts`):**
- Types: `AgendaSection`, `MeetingTemplate`, `EventAgendaItem`, `EventAgenda`, `AgendaSuggestions`, `ApplicationJourney`
- Functions: `listAgendaSections()`, `listMeetingTemplates()`, `getEventAgenda()`, `getAgendaSuggestions()`, `addAgendaItem()`, `updateAgendaItem()`, `finalizeAgenda()`, `getApplicationJourney()`, etc.

**Review Stage Categorization Logic:**
- `new_business` - First time at a meeting
- `old_business` - Previously tabled, needs info, or deferred
- `final_approval` - Previously given conditional/recommended status

---

### Previous Session (2025-12-22)

#### 1. Account Admin Billing Dashboard
Built a comprehensive billing page for Account Admins with full audit trail.

**New Pages:**
- `client/src/pages/AccountAdminBilling.tsx` - Billing landing page
- `client/src/pages/AccountAdminBillingDetail.tsx` - Property detail with activity log

**Landing Page Features:**
- Summary cards: Total Credits Used, Total Overage Cost, Applications, AI Analyses
- Properties table with tier, credit usage progress, overage costs
- "View Details" links to property drill-down

**Detail Page Features:**
- Credit usage progress bar with overage indicators
- Period filter: This Month, Last Month, Quarter, Year
- Activity tab: Full audit trail of billable events (AI analyses, forms, applications)
- Invoices tab: Invoice management with generate, send, download actions

**Backend Endpoints (in `server/routes.ts`):**
```
GET  /api/account-admin/billing/summary
GET  /api/account-admin/billing/:communityId/detail
POST /api/account-admin/billing/:communityId/invoices/generate
POST /api/account-admin/billing/:communityId/invoices/:invoiceId/send
```

**API Client Functions (in `client/src/lib/api.ts`):**
- `getAccountAdminBillingSummary()` - Get all properties with billing summary
- `getAccountAdminBillingDetail()` - Get property detail with activities/invoices
- `generateCommunityInvoice()` - Generate invoice for a property
- `sendCommunityInvoice()` - Send invoice email to property

**Route Changes:**
- `client/src/lib/mock-data.ts` - Updated Billing nav href to `/account-admin/billing`
- `client/src/lib/rbac.ts` - Added billing route permissions
- `client/src/App.tsx` - Registered new billing routes

---

### Previous Session Work (Committed)

#### 1. Contractor Role Switching Fix
Fixed contractor role not persisting in sidebar when switching contexts.

#### 2. Contractor Areas of Expertise (Multi-Select)
Added ability for contractors to specify multiple areas of expertise.

#### 3. Doubled AI Credit Costs (Centralized)
Created centralized credit cost constants (CREDIT_COSTS in shared/subscriptionTypes.ts).

---

## DATABASE STATUS

No database changes required for this feature - uses existing tables:
- `community_subscriptions` - Subscription and credit data
- `usage_events` - Audit trail of billable activities
- `invoices` - Invoice records

#### 2. Activity Log Credits Fix (2025-12-22)
Fixed activity log not showing credits for historical events.

**Problem:** Historical usage events had `creditsUsed: 0` because they were created before credit tracking was implemented.

**Solution:** Calculate expected credits based on event type using centralized `CREDIT_COSTS`:
- AI Analysis (Standard): 2 credits
- AI Analysis (Full): 4 credits
- AI Form Generated: 2 credits
- Application Submitted: 0 credits
- Document Uploaded: 0 credits

**File Changed:** `server/routes.ts` (billing detail endpoint at ~line 6108)

---

## NEXT STEPS

### Intelligent Agenda System - Remaining Work

**Phase 1: Core UI Components** - COMPLETE
- `AgendaSection.tsx`, `AgendaItem.tsx`, `AgendaSuggestions.tsx`

**Phase 2: Pages & Integration** - COMPLETE
- `MeetingAgenda.tsx` page - DONE
- `AgendaPresentation.tsx` (Presentation Mode) - DONE (2025-12-30)
- Add "Agenda" tab to `EventModal.tsx` - Optional enhancement
- Add template selector when creating events - Optional enhancement

**Phase 3: Application Journey** (Next Priority)
1. `ApplicationJourneyTimeline.tsx` component
2. Add journey section to `ApplicationDetail.tsx`
3. `ApplicationJourney.tsx` page at `/applications/:id/journey`

**Phase 4: Polish**
1. Drag-and-drop reordering within sections
2. Data migration from `eventApplications` (if needed)

### Testing Priorities (Agenda System)
1. **Access Agenda** - Login, go to Calendar, click event dropdown → Agenda
2. **Apply Template** - Click "Apply Template" and select a meeting template
3. **Add Items** - Use suggestions panel to add applications, or manually add discussion items
4. **Record Decision** - Click item dropdown → Record Decision
5. **Finalize** - Lock the agenda and verify editing is disabled
6. **Present Mode** - Click "Present Mode" button to enter presentation view
7. **Claim Facilitator** - Click "I'm Running This Meeting" to claim facilitator role
8. **Roll Call** - Initialize attendance and mark members present/absent
9. **Section Completion** - Check off sections as they're completed during meeting

---

## PROJECT OVERVIEW

**POA Association Portal** - A multi-tenant SaaS platform for HOA/POA community management with:
- Multi-tenant architecture with subdomain isolation
- Role-based access control (9 roles including contractor)
- Dynamic JSON schema-driven forms with AI generation
- Architectural review board (ARB) application workflows
- AI-powered application analysis
- Visual workflow designer
- Complete billing system with Stripe integration
- Property-rep assignment system
- Community custom landing pages
- Recurring events support
- Co-applicant system (household members + contractors)
- Onboarding tours (role-based guided tours)
- Inter-app sync (HomeHub integration)
- Account Admin Billing Dashboard
- **NEW: Intelligent Agenda System** (backend complete - auto-categorizes applications by review stage)

### Tech Stack
- **Frontend:** React 19 + Vite 7 + Tailwind 4 + shadcn/ui
- **State:** React Query + Zustand + React Hook Form
- **Backend:** Express + TypeScript + Drizzle ORM
- **Database:** Neon Serverless PostgreSQL
- **AI:** Anthropic Claude (claude-sonnet-4-5-20250929)
- **Storage:** Azure Blob Storage
- **Maps:** Google Maps API (geocoding + satellite imagery)
- **Payments:** Stripe (customers, invoices, payment methods)
- **Recurrence:** rrule.js (RFC 5545)

---

## USER ROLES

| Role | Description |
|------|-------------|
| `super_admin` | Platform administrator |
| `account_admin` | Management company admin |
| `management_manager` | Management company manager |
| `management_rep` | Property representative |
| `poa_board_member` | Board member with full access |
| `poa_board_contributor` | Board member with limited access |
| `homeowner` | Property owner |
| `household_member` | Member of homeowner's household |
| `contractor` | External contractor |

---

## DEMO PERSONAS

| Persona | Name | Role | Access |
|---------|------|------|--------|
| **Emily** | Emily Foster | management_manager, account_admin | Full access to all |
| **Sarah** | Sarah Chen | poa_board_member, homeowner | Board + homeowner at Markland |
| **Jordan** | Jordan Mitchell | management_rep | Rep for Whispering Pines only |
| **Alex** | Alex Rivera | poa_board_contributor, **contractor** | Contributor at Markland + Landscaping business |

**Note:** Alex has a dual role - he's on the Markland board AND runs "Rivera Landscaping & Design" serving multiple communities. His expertise: landscaping, fencing, outdoor structures.

---

## IMPORTANT CONVENTIONS

### Server Restart After Code Changes
After making server-side code changes, restart the server:
```bash
pkill -f "tsx server/index.ts"
```
Then click **Run** in Replit.

### Application Number Format
**Format:** `{tenant-last-4-chars}-{year}-{random-4-alphanumeric}`
**Example:** `A1B2-2025-XY9Z`

### Feature Flags
Managed in `shared/featureDefinitions.ts` - see `/home/runner/workspace/global-memory.md`

---

## KEY FILES MODIFIED TODAY

| File | Changes |
|------|---------|
| `client/src/pages/AccountAdminBilling.tsx` | **NEW** - Billing landing page |
| `client/src/pages/AccountAdminBillingDetail.tsx` | **NEW** - Property billing detail |
| `client/src/lib/api.ts` | Added billing API functions and types |
| `client/src/lib/mock-data.ts` | Updated billing nav href |
| `client/src/lib/rbac.ts` | Added billing route permissions |
| `client/src/App.tsx` | Registered billing routes |
| `server/routes.ts` | Added account admin billing endpoints |
