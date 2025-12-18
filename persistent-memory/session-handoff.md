# Session Handoff Document

**Last Updated:** 2025-12-18
**Current Session:** Memory Refresh & Documentation Update

---

## CURRENT STATE SUMMARY

### Work In Progress (Uncommitted Changes)

Based on git status, the following features have been developed but not yet committed:

#### 1. Co-Applicant System (Major Feature)
**Status:** Schema complete, backend routes added, frontend components created

**New Database Tables:**
- `household_members` - Links household members to primary homeowners within a tenant
- `contractors` - Contractor profiles (cross-tenant, linked to user)
- `application_collaborators` - Links contractors to specific applications
- `invitations` - Universal invitation tracking (household members + contractors)
- `contractor_referrals` - Track POA signups via contractor referral codes

**New Frontend Pages:**
- `ContractorDashboard.tsx` - Contractor's main dashboard
- `ContractorProfile.tsx` - Contractor profile management
- `ContractorReferrals.tsx` - Contractor referral tracking
- `HouseholdSettings.tsx` - Manage household members
- `InvitationAccept.tsx` - Accept invitation flow
- `ReferralLanding.tsx` - Landing page for referral links

**New Components:**
- `InviteContractorDialog.tsx` - Dialog to invite contractor to application
- `InviteHouseholdMemberDialog.tsx` - Dialog to invite household member
- `ProcessingOverlay.tsx` - Full-screen processing indicator
- `QRCodeDisplay.tsx` - QR code display component

**Migration:** `migrations/0002_co_applicant_system.sql` - Full migration ready

#### 2. Tour/Onboarding System
**Status:** Components created, admin customization ready

**New Database Tables:**
- `user_tour_progress` - Tracks which page tours a user has completed per role
- `tour_content_overrides` - Admin customizations to tour content

**New Files:**
- `client/src/components/tour/` - Tour UI components
- `client/src/lib/tour/` - Tour logic and content
- `client/src/pages/admin/TourContent.tsx` - Admin tour management

#### 3. Email Template System
**Status:** Backend complete, admin UI created

**New Files:**
- `server/emailTemplateRegistry.ts` - Centralized email template registry
- `client/src/pages/admin/EmailTemplates.tsx` - Admin email template management

**Enhanced:**
- `server/emailService.ts` - Extended email service
- `server/emailTemplates.ts` - Additional email templates

#### 4. Inter-App Sync with HomeHub
**Status:** Functional, dev instructions system added

**New Database Tables:**
- `sync_events` - Track sync events for debugging/audit
- `dev_instructions` - Claude-to-Claude developer instructions across apps

**New Files:**
- `scripts/send-homehub-instruction.ts` - Script to send instructions to HomeHub

**Enhanced:**
- `server/sync/client.ts` - Sync client improvements

#### 5. Other Enhancements
- `ApplicationWizard.tsx` - Enhanced with co-applicant support
- `ApplicationDetail.tsx` - Enhanced with collaborator display
- `DashboardLayout.tsx` - New navigation items
- `App.tsx` - New routes for contractor/household pages
- `rbac.ts` - Added contractor role support
- `api.ts` - ~370 new lines for new endpoints
- `routes.ts` - ~1180 new lines for new API endpoints
- `storage.ts` - ~618 new lines for new storage methods

---

## MIGRATION STATUS

**Pending Migration:** `migrations/0002_co_applicant_system.sql`

This migration adds:
- 12 new tables (contractors, household_members, invitations, etc.)
- New columns on existing tables (ai_analyses, applications, events, tenants, user_tenant_roles, workflow_templates)
- All required indexes and foreign keys

**To apply:**
```bash
npm run db:push
```

---

## FILES MODIFIED (Not Committed)

### Major Changes:
| File | Lines Changed | Description |
|------|---------------|-------------|
| `server/routes.ts` | +1181 | Co-applicant, contractor, invitation endpoints |
| `server/storage.ts` | +618 | Storage methods for new tables |
| `shared/schema.ts` | +342 | New tables and types |
| `client/src/lib/api.ts` | +371 | API client for new endpoints |
| `client/src/components/ApplicationWizard.tsx` | +272 | Co-applicant integration |
| `server/emailTemplates.ts` | +279 | New email templates |
| `server/emailService.ts` | +193 | Enhanced email service |

### New Files (Untracked):
```
client/src/components/InviteContractorDialog.tsx
client/src/components/InviteHouseholdMemberDialog.tsx
client/src/components/ProcessingOverlay.tsx
client/src/components/QRCodeDisplay.tsx
client/src/components/admin/
client/src/components/tour/
client/src/lib/tour/
client/src/pages/ContractorDashboard.tsx
client/src/pages/ContractorProfile.tsx
client/src/pages/ContractorReferrals.tsx
client/src/pages/HouseholdSettings.tsx
client/src/pages/InvitationAccept.tsx
client/src/pages/ReferralLanding.tsx
client/src/pages/admin/EmailTemplates.tsx
client/src/pages/admin/TourContent.tsx
migrations/0002_co_applicant_system.sql
scripts/send-homehub-instruction.ts
server/emailTemplateRegistry.ts
```

---

## NEXT STEPS

### Immediate Priorities

1. **Apply Database Migration**
   ```bash
   npm run db:push
   ```

2. **Test Co-Applicant Flow**
   - Login as homeowner
   - Go to Household Settings
   - Invite a household member
   - Test invitation acceptance flow

3. **Test Contractor Flow**
   - Create contractor profile
   - Invite contractor to application
   - Test contractor dashboard

4. **Test Tour System**
   - Login as different roles
   - Verify tours appear on first visit
   - Test admin tour customization

### Future Enhancements

- Contractor license verification integration
- Contractor search/directory for homeowners
- Tour analytics (completion rates, drop-off points)
- Email delivery tracking

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
- **Co-applicant system** (NEW - household members + contractors)
- **Onboarding tours** (NEW - role-based guided tours)
- **Inter-app sync** (NEW - HomeHub integration)

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
| `contractor` | External contractor (NEW) |

---

## DEMO PERSONAS

| Persona | Name | Role | Access |
|---------|------|------|--------|
| **Emily** | Emily Foster | management_manager, account_admin | Full access to all |
| **Sarah** | Sarah Chen | poa_board_member, homeowner | Board + homeowner at Markland |
| **Jordan** | Jordan Mitchell | management_rep | Rep for Whispering Pines only |
| **Alex** | Alex Rivera | poa_board_contributor | Contributor at Markland |

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

## KNOWN ISSUES

### Pre-existing TypeScript Errors (Low Priority)
- Some TypeScript errors exist in provision.ts and other files
- These are pre-existing and don't affect runtime
- New components compile cleanly

---

## API ENDPOINTS REFERENCE

### Co-Applicant System
```
# Household Members
GET    /api/household/members                    # Get household members
POST   /api/household/members                    # Invite household member
DELETE /api/household/members/:id                # Remove household member

# Contractors
GET    /api/contractors/profile                  # Get contractor profile
POST   /api/contractors/profile                  # Create/update profile
GET    /api/contractors/referrals                # Get referral stats

# Application Collaborators
GET    /api/applications/:id/collaborators       # Get collaborators
POST   /api/applications/:id/collaborators       # Invite contractor
DELETE /api/applications/:id/collaborators/:id   # Remove collaborator

# Invitations
GET    /api/invitations/:token                   # Get invitation details
POST   /api/invitations/:token/accept            # Accept invitation
POST   /api/invitations/:token/decline           # Decline invitation
```

### Recurring Events
```
POST   /api/events/:id/occurrence    # Edit occurrence
DELETE /api/events/:id/occurrence    # Delete occurrence
```

### Public Community Info
```
GET    /api/public/:subdomain/info   # Get community info without auth
```

### Property Rep Assignment
```
GET    /api/properties/:propertyId/reps           # Get rep assignments
POST   /api/properties/:propertyId/reps           # Assign rep
DELETE /api/property-rep-assignments/:id          # Remove assignment
```
