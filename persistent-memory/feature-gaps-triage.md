# Feature Gaps Triage - POA Association Platform

**Date:** 2025-11-21
**Status:** Initial analysis completed

---

## Executive Summary

This document provides a comprehensive triage of the POA Association platform, identifying what functionality is truly operational versus what is UI-only mockups ("vaporware"). The analysis reveals a **~40% functional backend** with **~25% frontend integration**.

### Quick Stats
- ✅ **Fully Functional:** 3 major features
- ⚠️ **Partially Functional:** 5 major features
- ❌ **Vaporware (UI Only):** 7 major features
- 🚫 **Missing Entirely:** 6 major features

---

## ✅ Fully Functional Features

These features have complete backend implementation AND frontend integration:

### 1. Replit Authentication (NEW - Nov 21)
- **Status:** ✅ Fully functional
- **Backend:** `/api/auth/user` endpoint with `isAuthenticated` middleware
- **Frontend:** `useAuth` hook, login redirect working
- **Files:**
  - `server/replitAuth.ts` (163 lines)
  - `client/src/hooks/useAuth.ts`
  - All API routes protected with `isAuthenticated` middleware
- **Capabilities:**
  - OpenID Connect integration with Replit
  - Session management with PostgreSQL store
  - User profile retrieval
  - Logout functionality
- **Gap:** No sandbox/demo mode (see feature-sandbox-demo.md)

### 2. Database Seeding
- **Status:** ✅ Fully functional
- **Backend:** `server/seed.ts` script
- **Database:** Creates 1 management company + 3 communities + 1 form template
- **Usage:** `tsx server/seed.ts`
- **Data Created:**
  - Apex Management Solutions (management company)
  - Markland POA, Whispering Pines HOA, Oak Ridge Estates (communities)
  - Markland Structural Changes form template
- **Gap:** No demo users/roles created, only tenants and forms

### 3. Dynamic Form Rendering
- **Status:** ✅ Fully functional
- **Frontend:** `DynamicForm` component renders JSON schemas
- **Capabilities:**
  - All field types: text, textarea, number, date, select, radio, checkbox, file
  - Section-based organization
  - Inline bylaws guidance with HoverCard
  - Validation feedback
  - Save draft vs. submit distinction
- **Files:** `client/src/components/DynamicForm.tsx` (285 lines)
- **Gap:** Always uses hardcoded schemas, never fetches from API

---

## ⚠️ Partially Functional Features

These features have backend implementation but lack complete frontend integration:

### 4. Tenant Management
- **Backend:** ✅ Complete
  - `GET /api/tenants` - list all tenants
  - `GET /api/tenants/subdomain/:subdomain` - get by subdomain
  - `POST /api/tenants` - create tenant
  - Storage layer: `getTenant()`, `getTenantBySubdomain()`, `listTenants()`, `createTenant()`

- **Frontend:** ⚠️ Uses mock data
  - Context switcher dropdown in sidebar (`DashboardLayout.tsx:72-99`)
  - Uses hardcoded `TENANTS` array from `mock-data.ts`
  - Never calls `/api/tenants` endpoint
  - Zustand store persists tenant selection but only from mock array

- **Gap:** Frontend should fetch real tenants from API on mount

### 5. Form Template Management
- **Backend:** ✅ Complete
  - `GET /api/tenants/:tenantId/forms` - list forms for tenant
  - `POST /api/tenants/:tenantId/forms` - create form
  - `GET /api/forms/:id` - get specific form
  - `PATCH /api/forms/:id` - update form
  - Storage layer fully implemented

- **Frontend:** ⚠️ Partially wired
  - API client has methods: `getFormTemplatesForTenant()`, `getFormTemplate()`
  - **NO pages actually call these methods**
  - FormBuilder page (`FormBuilder.tsx`) is pure UI mockup
  - ApplicationSubmit page uses hardcoded `ARCH_REQUEST_FORM_SCHEMA`
  - Markland example uses hardcoded `MARKLAND_STRUCTURAL_SCHEMA`

- **Gap:** Need to fetch forms from API before rendering, implement form CRUD UI

### 6. Application Submission & Review
- **Backend:** ✅ Complete
  - `POST /api/applications` - submit application
  - `GET /api/applications/:id` - get application
  - `GET /api/tenants/:tenantId/applications` - list tenant applications
  - `PATCH /api/applications/:id/status` - update status (approve/reject)
  - Storage layer fully implemented

- **Frontend:** ⚠️ Submit exists, no review UI
  - API client has `submitApplication()`, `getApplication()`, `getApplicationsForTenant()`
  - DynamicForm component can submit (used in ApplicationSubmit page)
  - **NO application review/approval UI exists**
  - **NO applications list page implemented** (route exists but shows placeholder)
  - Dashboard "Recent Applications" section is hardcoded mock data

- **Gap:** Need applications list page, review/approval workflow UI

### 7. User-Tenant-Role Relationships
- **Backend:** ✅ Complete
  - `GET /api/users/:userId/tenants` - get user's tenant assignments with roles
  - Storage layer: `getUserRolesForTenant()`, `getUserTenants()`, `assignUserRole()`
  - Database table `userTenantRoles` exists with proper schema

- **Frontend:** ⚠️ Role switcher is client-only
  - Role dropdown in sidebar (`DashboardLayout.tsx:126-141`)
  - Changes `currentUserRole` in Zustand store only
  - **Never fetches user's actual roles from API**
  - **No backend enforcement of role-based permissions**

- **Gap:** Fetch user roles on login, implement RBAC middleware

### 8. User Profile Management
- **Backend:** ✅ Partially complete
  - `GET /api/auth/user` - returns current user (from Replit auth)
  - Storage: `getUser()`, `getUserByEmail()`, `upsertUser()` implemented
  - Auth creates/updates user on login via `upsertUser()`

- **Frontend:** ⚠️ Shows user but no edit UI
  - `useAuth` hook fetches current user
  - User displayed in sidebar avatar/dropdown
  - **NO profile edit page exists**
  - **NO settings page implemented**

- **Gap:** Profile editing, settings management

---

## ❌ Vaporware Features (UI Only)

These features have UI components but NO backend implementation or integration:

### 9. Dashboard Statistics
- **Location:** `Dashboard.tsx` lines 14-19
- **What exists:** Visual stat cards with numbers
- **Reality:** All hardcoded values:
  - "Pending Requests: 12"
  - "Active Violations: 3"
  - "Approved Projects: 89"
  - "Total Units: 245"
- **Gap:** Need actual queries for real-time counts from database

### 10. Recent Applications Feed
- **Location:** `Dashboard.tsx` lines 30-48
- **What exists:** List of 3 recent applications with avatars and badges
- **Reality:** Hardcoded array `[1, 2, 3].map()` with fake data
- **Gap:** Should call `getApplicationsForTenant()` and display real data

### 11. AI Form Builder
- **Location:** `FormBuilder.tsx` (entire page)
- **What exists:** Beautiful UI with prompt textarea and "Generate" button
- **Reality:**
  - Button just does `setTimeout()` for 1.5 seconds
  - Always returns hardcoded `ARCH_REQUEST_FORM_SCHEMA`
  - No AI integration whatsoever
  - "Save Template" button does nothing
- **Gap:** Need actual AI integration (Claude API, OpenAI) OR remove feature

### 12. Community Status Sidebar
- **Location:** `Dashboard.tsx` lines 72-93
- **What exists:** Card showing next board meeting, management rep, office hours
- **Reality:** All hardcoded text
- **Gap:** Need tenant settings/metadata table, management assignment system

### 13. Quick Actions
- **Location:** `Dashboard.tsx` lines 55-67
- **What exists:** Buttons for "Start New Application", "Report Violation"
- **Reality:**
  - "Start New Application" → works (goes to form page)
  - "Report Violation" → button does nothing
- **Gap:** Implement violation reporting feature or remove button

### 14. Navigation Placeholders
- **Location:** Multiple nav items in `NAV_ITEMS` array
- **Routes that don't exist:**
  - `/directory` - no page
  - `/properties` - no page
  - `/compliance` - no page
  - `/settings` - no page
- **Routes that are placeholders:**
  - `/applications` - shows "Applications List (Placeholder)" text only
- **Gap:** Implement these pages or remove from navigation

### 15. User Dropdown Actions
- **Location:** `DashboardLayout.tsx` lines 164-167
- **What exists:** "Profile" menu item
- **Reality:** MenuItem onClick does nothing
- **Gap:** Create profile page or remove menu item

---

## 🚫 Missing Features (Not Even UI)

Features that should exist but have no UI or backend:

### 16. File Upload Handling
- **Schema:** Form fields support `type: "file"`
- **Backend:** NO file storage implementation (no S3, no local storage)
- **Frontend:** DynamicForm renders file inputs but doesn't upload
- **Gap:** Critical for applications requiring documents (plat maps, photos, contracts)

### 17. Email Notifications
- **Use cases:**
  - Application submitted → notify board
  - Application approved/rejected → notify homeowner
  - Account created → welcome email
- **Status:** Zero email functionality
- **Gap:** Need email service integration (SendGrid, AWS SES, etc.)

### 18. Application Review Comments/History
- **Database:** `reviewNotes` field exists but just single text field
- **Status:** No comment thread system, no activity log
- **Gap:** Need proper audit trail for application workflow

### 19. Subdomain Routing
- **Current:** Simulated via dropdown, logs "Navigated to X.poassociation.com"
- **Reality:** Single deployment, no actual subdomain logic
- **Gap:** Need Express subdomain middleware or completely different approach

### 20. Search & Filtering
- **Applications:** No search or filter UI
- **Properties:** Don't exist
- **Users:** No directory with search
- **Gap:** Need search implementation across all list views

### 21. Data Export
- **Use cases:** Export applications to PDF, export reports to CSV
- **Status:** No export functionality anywhere
- **Gap:** Reporting and compliance features

---

## Integration Gap Analysis

### Frontend → Backend Integration Issues

| Feature | Backend Ready | Frontend Integration | Gap |
|---------|---------------|---------------------|-----|
| List Tenants | ✅ | ❌ Uses mock data | Replace TENANTS array with API call |
| Get Forms by Tenant | ✅ | ❌ Never called | Wire ApplicationSubmit to fetch real forms |
| List Applications | ✅ | ❌ Never called | Build applications list page |
| Update Application Status | ✅ | ❌ No review UI | Build review/approval workflow UI |
| Get User Roles | ✅ | ❌ Never called | Fetch roles on auth, populate dropdown |
| Create Form Template | ✅ | ❌ No save logic | Wire FormBuilder save button |

### Backend Endpoints with Zero Frontend Usage

These endpoints exist but are **never called** by the frontend:

```
GET    /api/tenants                           ← Never used
GET    /api/tenants/subdomain/:subdomain      ← Never used
POST   /api/tenants                           ← Never used
GET    /api/tenants/:tenantId/forms           ← Never used
POST   /api/tenants/:tenantId/forms           ← Never used
GET    /api/forms/:id                         ← Never used
PATCH  /api/forms/:id                         ← Never used
GET    /api/applications/:id                  ← Never used
GET    /api/tenants/:tenantId/applications    ← Never used (Dashboard uses mock)
PATCH  /api/applications/:id/status           ← Never used (No review UI)
GET    /api/users/:userId/tenants             ← Never used
```

**Only endpoints in use:**
- `GET /api/auth/user` ✅ (useAuth hook)
- `POST /api/applications` ✅ (DynamicForm submission)

---

## Data Flow Issues

### Issue 1: Mock Data Overrides Real Data
- **Problem:** Frontend has hardcoded `TENANTS`, `MOCK_USER`, `NAV_ITEMS` in `mock-data.ts`
- **Impact:** Database can have different tenants, but UI always shows same 3
- **Fix:** Fetch tenants on mount, remove TENANTS constant

### Issue 2: Context Switching is Fake
- **Problem:** Tenant switcher changes Zustand state, doesn't reflect reality
- **Impact:** Users can "switch" to tenants they don't have access to
- **Fix:** Fetch user's assigned tenants from `/api/users/:userId/tenants`

### Issue 3: Forms Never Fetched
- **Problem:** All form pages use hardcoded schemas from `mock-data.ts`
- **Impact:** Can't create new forms via UI, changes in DB won't reflect
- **Fix:** Fetch forms before showing submission page

### Issue 4: No Application State Management
- **Problem:** Submissions work, but no way to view or manage them
- **Impact:** Applications go into black hole, no workflow
- **Fix:** Build applications management pages

---

## Priority Recommendations

### High Priority (Core Functionality Broken)
1. **Wire tenant fetching** - Replace mock TENANTS with API calls
2. **Wire form fetching** - ApplicationSubmit should fetch available forms
3. **Build applications list page** - Can't manage what you can't see
4. **Implement file upload** - Many forms require document attachments
5. **Build application review UI** - Workflow is incomplete without approval flow

### Medium Priority (UX Issues)
6. **Fetch user roles** - Role switcher should show actual assigned roles
7. **Fix dashboard stats** - Replace hardcoded numbers with real queries
8. **Fix recent applications feed** - Show real recent submissions
9. **Implement profile page** - Basic user management
10. **Remove/implement missing nav items** - Don't show broken links

### Low Priority (Nice to Have)
11. **AI form builder** - Either implement or clearly mark as "coming soon"
12. **Email notifications** - Important but app works without
13. **Search/filtering** - Can add once lists are working
14. **Data export** - Reporting feature for later
15. **Subdomain routing** - Major architectural change, deprioritize

---

## Testing Gaps

Currently **ZERO tests exist** despite:
- Test IDs present in components (`data-testid` attributes)
- Mock data available
- Clean architecture (easy to test storage layer)

**Impact:** Can't confidently refactor or add features without manual testing everything.

---

## Next Steps

See individual feature documents:
- `feature-auth-and-users.md` - Authentication and user management
- `feature-tenant-context.md` - Multi-tenancy and context switching
- `feature-application-workflow.md` - Application submission and review
- `feature-form-management.md` - Form creation and management
- `feature-sandbox-demo.md` - **Sandbox demo account implementation** (priority)

---

## Notes

- This triage was performed on 2025-11-21 after Replit auth integration
- Backend is solid and well-architected
- Main issue is **frontend doesn't use the backend** it has available
- Low-hanging fruit: wire existing API calls to existing endpoints
- Biggest missing piece: Application review/approval workflow
