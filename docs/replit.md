# POA Association - Multi-Tenant Community Management Platform

## Overview

POA Association is a full-stack SaaS platform for managing homeowner and property owner associations. The system provides architectural review board (ARB) workflows, dynamic form generation, document management, and multi-tenant isolation for management companies overseeing multiple communities.

**Core Value Proposition:**
- Dynamic, AI-powered form builder for community-specific applications
- Multi-tenant architecture with subdomain-based isolation
- Complete application submission and review workflows
- Azure Blob Storage document management with GUID-based paths
- Demo ecosystem system for prospect evaluation

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Tenant Data Model

**Three-Tier Tenant Hierarchy:**
1. **Management Companies** - Top-level organizations managing multiple communities
2. **Communities** - Individual HOAs/POAs (Markland POA, Whispering Pines HOA, etc.)
3. **Users** - Assigned to tenants with specific roles via `userTenantRoles` join table

**Tenant Isolation:**
- Subdomain-based routing (e.g., `markland.poassociation.com`)
- All database queries filtered by `tenantId`
- Demo data tagged with `demoCodeId` for safe deletion
- Zustand store persists `currentTenant` selection in localStorage

**Role-Based Access Control:**
- `super_admin` - Platform administrators
- `account_admin` - Community administrators  
- `management_manager` - Management company managers
- `management_rep` - Management company representatives
- `poa_board_member` - Community board members
- `poa_board_contributor` - Board contributors
- `resident` - Homeowners/residents

### Authentication & Sessions

**Replit OpenID Connect Integration:**
- Session storage in PostgreSQL via `connect-pg-simple`
- 7-day session TTL
- Sessions table tracks `sid`, `sess` (JSON), and `expire`
- Passport.js with `openid-client` strategy
- All API routes protected with `isAuthenticated` middleware

**Demo System (Isolated Ecosystems):**
- Time-limited demo codes with scheduled validity windows
- Each code provisions complete isolated ecosystem: 1 management company, 2 communities, 4 users, 4 form templates, 30+ sample applications
- Demo users are real users in database, tagged with `demoCodeId`
- Zero behavioral differences between demo and production users
- Cascade delete removes entire ecosystem atomically
- Session tracking via `demoSessions` table

### Database Schema (Drizzle ORM + Neon PostgreSQL)

**Core Tables:**
- `users` - User profiles with Replit auth data
- `tenants` - Management companies and communities
- `userTenantRoles` - Many-to-many user-tenant assignments with roles
- `formTemplates` - Dynamic form configurations (JSON schema)
- `applications` - Submitted applications with status workflow
- `documents` - File metadata with Azure blob paths (GUID-based)
- `demoCodes` - Demo access codes with provisioning state
- `demoSessions` - Demo usage analytics
- `sessions` - Express session store

**Design Decisions:**
- UUID primary keys for all entities (via `gen_random_uuid()`)
- JSONB columns for flexible form schemas and metadata
- Timestamp tracking (`createdAt`, `updatedAt`) on all mutable tables
- Soft deletes avoided - hard deletes with cascade constraints
- Foreign key constraints enforce referential integrity

### Dynamic Form System

**Configuration-Driven Architecture:**
- Form templates stored as JSONB in `formTemplates` table
- Each template tied to specific `tenantId` and `projectType`
- Version tracking with `isActive` flag (only one active per type)
- Field types: text, textarea, select, radio, checkbox, number, date
- Inline compliance guidance with `relevantBylaws` references
- Scoring system for form completeness calculation

**Form Template Structure:**
```typescript
{
  title: string,
  description: string,
  sections: [{
    title: string,
    fields: [{
      id: string,
      label: string,
      type: FieldType,
      required: boolean,
      options?: string[],
      description?: string,
      relevantBylaws?: BylawReference
    }]
  }],
  documents?: DocumentRequirement[],
  scoring_weights?: object
}
```

**AI Form Generation (Anthropic Claude):**
- Service reads community design guidelines from URLs
- Analyzes reference architecture examples from `ref_docs/`
- Generates custom form configurations via Claude API
- Validates output against TypeScript schema
- Currently dormant - seeded forms in use

### Application Workflow

**4-Step Submission Wizard:**
1. **Project Type Selection** - 6 types: exterior modifications, structural changes, landscaping, fencing, outdoor structures, signage
2. **Project Details** - Generic fields (title, description, address)
3. **Additional Information** - Project-type-specific dynamic form
4. **Document Upload** - Azure Blob Storage with drag-and-drop

**Application States:**
- `draft` - Created in Step 2, not yet submitted
- `pending` - Submitted, awaiting initial review
- `under_review` - Active review in progress
- `approved` - Final approval granted
- `rejected` - Application denied
- `conditionally_approved` - Approved with conditions

**Workflow System (Partially Implemented):**
- `workflowTemplates` table with multi-step review processes
- `workflowSteps` track current position in workflow
- 4 pre-built templates: Standard 3-Step, Management + Board, Management Only, Extended Board
- Schema created, API endpoints pending

### Document Management (Azure Blob Storage)

**GUID-Based Hierarchical Paths:**
```
application-documents/
  {tenant-guid}/
    {application-guid}/
      {document-guid}.{extension}
```

**Path Precalculation Strategy:**
- Document ID generated once at upload: `crypto.randomUUID()`
- Full path constructed immediately: `${tenantId}/${applicationId}/${documentId}.${ext}`
- Path stored in `blob_path` column
- No runtime reassembly - direct retrieval from database
- Performance optimization: avoids multiple table joins

**Upload Flow:**
1. Frontend: User drops files in `DocumentUpload` component
2. Multer middleware: Stores file in memory (50MB limit)
3. Backend: Generates document GUID, constructs path
4. Azure: Uploads blob to container `application-documents`
5. Database: Inserts record with `blobPath`, `fileName`, `fileSize`, `mimeType`

**Required vs Optional Documents:**
- Form templates include `documents` array with `DocumentRequirement[]`
- Each requirement has `name`, `required` boolean, `description`
- Visual indicators in UI (red asterisk for required)
- Backward compatible with legacy `required_documents` string array

## External Dependencies

### Database
- **Neon Serverless PostgreSQL** - Managed Postgres with websocket connections
- Connection via `@neondatabase/serverless` Pool
- Environment variable: `DATABASE_URL`
- Schema migrations via Drizzle Kit (`drizzle-kit push`)

### Cloud Storage
- **Azure Blob Storage** - Document/file storage
- Connection via `@azure/storage-blob` SDK
- Environment variables: `AZURE_STORAGE_CONNECTION_STRING` or `AZURE_STORAGE_ACCOUNT_NAME` + `AZURE_STORAGE_SAS_TOKEN`
- Container: `application-documents`

### Authentication
- **Replit OpenID Connect** - Primary authentication provider
- Environment variables: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`
- Fallback: Demo code entry bypasses auth for sandboxed demos

### AI Services
- **Anthropic Claude API** - Form generation service
- Environment variable: `ANTHROPIC_API_KEY`
- Currently dormant - used for initial form template generation

### Email (Planned)
- **SMTP2GO** - Transactional email service
- Environment variable: `SMTP2GO_API_KEY`
- Templates created, sending infrastructure ready
- Not yet integrated into application workflow

### Frontend Build & Development
- **Vite** - Dev server and production bundler
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Radix UI component library (55 components installed)
- **TanStack React Query** - Server state management
- **Wouter** - Lightweight client-side routing
- **Replit Vite Plugins** - Runtime error overlay, dev banner, cartographer (dev only)

### Build & Deployment
- **esbuild** - Server bundling for production
- **tsx** - TypeScript execution for scripts
- **Replit Autoscale** - Deployment platform
- Build output: `dist/public` (client), `dist/index.js` (server)