# POA Association - Multi-Tenant Community Management Platform

## Overview

POA Association is a full-stack SaaS platform for managing homeowner and property owner associations (HOAs/POAs). The system provides architectural review board (ARB) workflows, AI-powered dynamic form generation, multi-tenant isolation with subdomain routing, and comprehensive document management.

**Core Value Proposition:**
- AI-powered form generation from community design guidelines (PDF/HTML)
- Multi-tenant architecture with subdomain-based tenant isolation
- Complete application submission and review workflows
- Azure Blob Storage document management with GUID-based paths
- Demo ecosystem system for prospect evaluation with gated access

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Tenant Data Model

**Three-Tier Tenant Hierarchy:**
1. **Management Companies** - Top-level organizations managing multiple communities
2. **Communities** - Individual HOAs/POAs (e.g., Markland POA, Whispering Pines HOA)
3. **Users** - Assigned to tenants with specific roles via `userTenantRoles` join table

**Tenant Isolation Strategy:**
- Subdomain-based routing (e.g., `markland.poassociation.com`)
- All database queries filtered by `tenantId`
- Demo data tagged with `demoCodeId` for safe deletion via CASCADE constraints
- Zustand store persists `currentTenant` selection in localStorage

**Role-Based Access Control:**
- `super_admin` - Platform administrators
- `account_admin` - Community administrators  
- `management_manager` - Management company managers
- `management_rep` - Management company representatives
- `poa_board_member` - Community board members
- `poa_board_contributor` - Board contributors
- `resident` - Homeowners/residents

**Key Design Decision: Demo Isolation**
- Demo codes generate isolated ecosystems with unique subdomains
- All demo entities (users, tenants, applications, forms) tagged with `demoCodeId`
- Automatic CASCADE deletion when demo code expires
- Production data (`demoCodeId = NULL`) is never affected

### Frontend Architecture

**Stack:**
- React 19 + TypeScript 5.6
- Vite 7 (build tool) with HMR
- Wouter 3.3 (lightweight routing)
- Tailwind CSS 4 + shadcn/ui (New York variant)
- TanStack React Query 5.6 (server state)
- Zustand 5.0 (client state with localStorage persistence)
- React Hook Form 7.66 + Zod 3.25 (forms and validation)

**State Management Strategy:**
- **Server State**: React Query with automatic caching, refetching, and optimistic updates
- **Client State**: Zustand for UI state (current tenant, sidebar collapsed, etc.)
- **Form State**: React Hook Form with Zod validation schemas

**Component Organization:**
- `/client/src/components` - Reusable UI components (ApplicationCard, DynamicForm, etc.)
- `/client/src/pages` - Route-level page components
- `/client/src/hooks` - Custom React hooks (useAuth, useTenant, etc.)
- `/client/src/lib` - Utilities and API client

### Backend Architecture

**Stack:**
- Node.js 20 + Express 4.21 + TypeScript
- Neon Serverless PostgreSQL 16
- Drizzle ORM 0.39 (schema-first with migrations)
- Express Session + connect-pg-simple (PostgreSQL-backed sessions)
- Self-hosted email + password auth (bcryptjs; `server/auth.ts`)

**Service Layer:**
- `storage.ts` - Database access layer (single source of truth for all DB operations)
- `additionalInfoService.ts` - Form configuration management and validation
- `aiFormGenerationService.ts` - Anthropic Claude integration for form generation
- `azureBlobStorage.ts` - Document upload/download/deletion
- `emailService.ts` - SMTP2GO transactional email sending
- `provision.ts` - Demo ecosystem provisioning

**API Design:**
- RESTful endpoints under `/api/*`
- All routes protected with `isAuthenticated` middleware
- Subdomain detection middleware extracts tenant context
- Zod validation for all request payloads

### Database Schema

**Core Tables:**
- `users` - User profiles + credentials (email, bcrypt `passwordHash`, email verification)
- `tenants` - Management companies and communities
- `userTenantRoles` - Many-to-many user-tenant-role assignments
- `formTemplates` - AI-generated form configurations (JSON)
- `applications` - Submitted applications with workflow state
- `documents` - File metadata with Azure Blob Storage paths
- `sessions` - Express session storage (connect-pg-simple)
- `passwordResetTokens` / `emailVerificationTokens` - single-use, hashed auth tokens
- `demoCodes` - Time-limited demo access codes

**Key Relationships:**
- Tenant hierarchy: `tenants.managementCompanyId` → `tenants.id`
- User-tenant roles: `users` ↔ `userTenantRoles` ↔ `tenants`
- Applications: `applications.tenantId` → `tenants.id`
- Documents: `documents.applicationId` → `applications.id`
- Demo isolation: All demo entities have `demoCodeId` → `demoCodes.id`

**Document Storage Path Structure:**
```
application-documents/{tenant-guid}/{application-guid}/{document-guid}.{ext}
```
- Paths precalculated at upload time using `crypto.randomUUID()`
- Full path stored in `documents.blobPath` column
- No runtime reassembly required (performance optimization)

### Authentication & Sessions

**Email + password (self-hosted):**
- Session storage in PostgreSQL via `connect-pg-simple`
- 7-day session TTL with automatic cleanup
- `sessions` table tracks `sid`, `sess` (JSON), and `expire`
- Identity is `session.userId`; passwords hashed with bcryptjs (cost 12)
- Routes: `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`
- Per-account lockout + per-IP rate limiting on credential endpoints
- All API routes protected with `isAuthenticated` middleware (`server/auth.ts`)

**Demo Mode:**
- Demo codes create temporary access via the same `session.userId` mechanism
- Demo users auto-created during ecosystem provisioning
- Demo sessions expire when `validUntil` date passes
- Purge script (`purgeExpiredDemos.ts`) cleans up expired demos

### AI Form Generation

**Anthropic Claude Sonnet 4.5 Integration:**
- Fetches community design guidelines (PDF or HTML)
- PDF support via Anthropic's native document API (OCR included)
- Generates structured JSON forms matching `AdditionalInfoConfig` schema
- Prompts externalized to markdown files for easy iteration

**Prompt Structure:**
- `server/prompts/system-prompt.md` - Defines Claude's role and output format
- `server/prompts/user-prompt.md` - Instructions for analyzing guidelines
- Emphasizes extracting actual lot types (not hallucinating)
- Includes bylaw references with section/page citations

**Form Validation:**
- Generated forms validated against Zod schemas
- Completeness scoring based on field weights
- Caching prevents redundant AI calls

## External Dependencies

### Cloud Services

**Neon PostgreSQL:**
- Serverless PostgreSQL 16 database
- Environment variable: `DATABASE_URL`
- Used for all persistent data storage
- Auto-scaling with connection pooling

**Azure Blob Storage:**
- Document storage for application uploads
- Environment variables: `AZURE_STORAGE_CONNECTION_STRING` or `AZURE_STORAGE_ACCOUNT_NAME` + `AZURE_STORAGE_SAS_TOKEN`
- Container: `application-documents`
- GUID-based hierarchical path structure

**Anthropic Claude API:**
- AI form generation from design guidelines
- Environment variable: `ANTHROPIC_API_KEY`
- Model: Claude Sonnet 4.5
- Supports both PDF and HTML input

**SMTP2GO:**
- Transactional email service
- Environment variable: `SMTP2GO_API_KEY`
- Used for application notifications and workflow updates

**Authentication:**
- Self-hosted email + password (no external identity provider)
- Environment variables: `SESSION_SECRET` (required), `APP_URL` (base for email links)
- Session persistence in PostgreSQL

### NPM Packages

**Core Dependencies:**
- `express` - HTTP server framework
- `drizzle-orm` + `@neondatabase/serverless` - Database ORM
- `@anthropic-ai/sdk` - AI form generation
- `@azure/storage-blob` - Document storage
- `react` + `vite` - Frontend framework and build tool
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `react-hook-form` + `zod` - Form handling and validation

**UI Component Library:**
- `@radix-ui/*` (20+ packages) - Headless UI primitives
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library
- `shadcn/ui` - Pre-built accessible components

**Authentication:**
- `bcryptjs` - Password hashing
- `express-session` + `connect-pg-simple` - Session management
- `express-rate-limit` - Brute-force protection on credential endpoints

### Development Tools

**Build & Development:**
- `tsx` - TypeScript execution for dev and scripts
- `esbuild` - Fast backend bundling
- `drizzle-kit` - Database migrations
- `vite` - Frontend HMR and build

**Deployment:**
- Replit Autoscale for production hosting
- Database migrations via `npm run db:push`
- Build command: `npm run build` (frontend + backend)
- Start command: `npm start`