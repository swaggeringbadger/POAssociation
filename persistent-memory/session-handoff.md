# Session Handoff Document

**Last Updated:** 2025-12-22
**Current Session:** Contractor Enhancements & AI Credit Changes

---

## CURRENT STATE SUMMARY

### Just Completed (2025-12-22)

#### 1. Contractor Role Switching Fix
Fixed contractor role not persisting in sidebar when switching contexts.

**Changes Made:**
- `client/src/lib/rbac.ts` - Added 'contractor' to route permissions for /contractor routes
- `client/src/lib/mock-data.ts` - Added 'contractor' to Role type, added CONTRACTOR_NAV_ITEMS
- `client/src/components/layout/DashboardLayout.tsx` - Shows contractor nav when role is 'contractor', persists role to backend
- `client/src/hooks/useUserTenants.ts` - Exception to prevent 'contractor' role from being reset by tenant logic

#### 2. Contractor Areas of Expertise (Multi-Select)
Added ability for contractors to specify multiple areas of expertise.

**Changes Made:**
- `shared/schema.ts` - Added `areasOfExpertise` JSONB column to contractors table
- `client/src/pages/ContractorProfile.tsx` - Multi-select checkboxes for 15 expertise areas
- `server/routes.ts` - Updated POST/PATCH endpoints to handle areasOfExpertise
- `client/src/lib/api.ts` - Updated API client types
- `server/provision.ts` - Alex's profile includes landscaping, fencing, outdoor_structures

**Available Expertise Areas:**
- General Contractor, Landscaping, Fencing, Roofing, Pool/Spa
- Painting, HVAC, Electrical, Plumbing, Architect/Design
- Exterior Modifications, Structural Changes, Outdoor Structures, Signage, Other

**Invitation Flow:**
When a contractor accepts an invitation and doesn't have a profile, the system creates one with initial expertise based on the application's project type.

#### 3. Doubled AI Credit Costs (Centralized)
Created centralized credit cost constants and doubled all values.

**New Constants** (`shared/subscriptionTypes.ts`):
```typescript
export const CREDIT_COSTS = {
  STANDARD_ANALYSIS: 2,   // was 1
  FULL_ANALYSIS: 4,       // was 2
  AI_FORM_GENERATION: 2,  // was 1
} as const;
```

**Changes Made:**
- `shared/subscriptionTypes.ts` - Added CREDIT_COSTS constants
- `client/src/components/SubscriptionManagement.tsx` - Uses CREDIT_COSTS in "What Uses Credits"
- `server/services/communitySubscriptionService.ts` - deductCredit() accepts count parameter
- `server/services/usageTrackingService.ts` - logAiAnalysis() accepts analysisType, uses CREDIT_COSTS
- `server/services/analysisQueueService.ts` - Determines analysis type from job options
- `client/src/components/ai-analysis/AIAnalysisButton.tsx` - Shows dynamic credit cost based on options

**Credit Cost Logic:**
- Standard (satellite only): 2 credits
- Full (mockups OR breakdown report OR property research): 4 credits

---

### Commit Made
```
665f62b Add contractor areas of expertise and double AI credit costs
```

18 files changed, 470 insertions, 99 deletions

---

## WORK IN PROGRESS (From Previous Sessions)

The following features were developed in earlier sessions and are now committed:

#### 1. Co-Applicant System
- Household members linked to primary homeowners
- Contractor profiles (cross-tenant)
- Application collaborators
- Invitation system

#### 2. Tour/Onboarding System
- Role-based guided tours
- Admin tour customization
- User progress tracking

#### 3. Email Template System
- Centralized email template registry
- Admin email template management

#### 4. Inter-App Sync with HomeHub
- Sync events tracking
- Developer instructions across apps

---

## DATABASE STATUS

The `areasOfExpertise` column was added directly to the contractors table:
```sql
ALTER TABLE contractors ADD COLUMN areas_of_expertise JSONB DEFAULT '[]'::jsonb;
```

All existing Alex contractor profiles were updated:
```sql
UPDATE contractors SET areas_of_expertise = '["landscaping", "fencing", "outdoor_structures"]'::jsonb
WHERE company_name = 'Rivera Landscaping & Design';
```

---

## NEXT STEPS

### Testing Priorities
1. **Contractor Role Switching** - Switch to contractor role in sidebar, verify it persists
2. **Areas of Expertise** - Edit contractor profile, select multiple expertise areas
3. **AI Credit Costs** - Check "What Uses Credits" shows 2/4/2, run analysis to verify deduction

### Future Enhancements
- Contractor search by expertise area
- Contractor license verification
- AI analysis cost estimation before running

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
| `shared/subscriptionTypes.ts` | Added CREDIT_COSTS constants |
| `shared/schema.ts` | Added areasOfExpertise to contractors |
| `client/src/lib/rbac.ts` | Added contractor role permissions |
| `client/src/lib/mock-data.ts` | Added contractor role, nav items |
| `client/src/hooks/useUserTenants.ts` | Contractor role exception |
| `client/src/components/layout/DashboardLayout.tsx` | Contractor navigation |
| `client/src/pages/ContractorProfile.tsx` | Multi-select expertise UI |
| `client/src/components/SubscriptionManagement.tsx` | Uses CREDIT_COSTS |
| `client/src/components/ai-analysis/AIAnalysisButton.tsx` | Dynamic credit display |
| `server/routes.ts` | areasOfExpertise in contractor endpoints |
| `server/services/communitySubscriptionService.ts` | deductCredit count param |
| `server/services/usageTrackingService.ts` | Analysis type tracking |
| `server/services/analysisQueueService.ts` | Determines analysis type |
