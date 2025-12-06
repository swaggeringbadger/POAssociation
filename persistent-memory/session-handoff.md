# Session Handoff Document

**Last Updated:** 2025-12-03
**Current Session:** Community Custom Landing Pages - COMPLETE

---

## IMMEDIATE NEXT STEPS FOR NEXT SESSION

### 1. Test Community Landing Pages

The new feature allows each community to have a custom public landing page accessible via subdomain.

#### Testing Community Landing Page

1. **Access via Query Parameter (for testing)**
   - Go to `https://your-app.replit.app/?subdomain=markland`
   - Should display the Markland POA community landing page
   - Shows: Hero image, community name, description, next meeting, contact info, quick links

2. **Test Different Communities**
   - `?subdomain=markland` - Markland POA
   - `?subdomain=whispering-pines` - Whispering Pines HOA

3. **Verify Public API Endpoint**
   ```bash
   curl http://localhost:5000/api/public/markland/info
   curl http://localhost:5000/api/public/whispering-pines/info
   ```

4. **Configure Hero Image (Optional)**
   - Login as Emily (management_manager) or board member
   - Go to Settings page
   - Edit Community Settings
   - Add Hero Image URL (any public image URL)
   - Save and refresh the landing page

#### Landing Page Features
- **Hero Section**: Community name with custom or default hero image
- **Next Meeting Card**: Shows upcoming scheduled event (if any)
- **Contact Info Card**: Phone, email, hours, address from community settings
- **Quick Links**: Submit Request, View Guidelines, Resident Portal, Community Website

### 2. Test Hero Image Settings

1. **Login as Emily or Sarah (board member)**
2. **Go to Settings > Community Settings**
3. **Edit Settings**
   - New "Community Landing Page" section at top
   - Enter Hero Image URL field
   - Preview shows the image
4. **Save and verify on landing page**

---

## Current Status

### Latest Session Summary (2025-12-03)

**Session Goal:** Implement Community Custom Landing Pages

**Status:** IMPLEMENTATION COMPLETE - READY FOR TESTING

**Completed This Session:**

1. **Database Schema (`shared/schema.ts`):**
   - Added `heroImageUrl` field to tenants table
   - Pushed migration via direct SQL (ALTER TABLE)

2. **Public API Endpoint (`server/routes.ts`):**
   - `GET /api/public/:subdomain/info` - Returns community info without auth
   - Returns: tenant (id, name, subdomain, heroImageUrl, designGuidelinesUrl, communitySettings)
   - Returns: nextEvent (if any scheduled event exists)
   - Only exposes community type tenants (not management companies)

3. **CommunityLanding Page (`client/src/pages/CommunityLanding.tsx`):**
   - New public landing page component
   - Fetches data from public API endpoint
   - Shows hero image (custom or default)
   - Shows community name and description
   - Next Meeting card with "Add to Calendar" button
   - Contact Information card (phone, email, hours, address)
   - Quick Links section (Submit Request, View Guidelines, Resident Portal)
   - Footer with "Powered by POA Association"

4. **App Router Updates (`client/src/App.tsx`):**
   - Added subdomain detection via `/api/subdomain` endpoint
   - Also supports `?subdomain=markland` query param for testing
   - Shows CommunityLanding when subdomain detected and user not authenticated
   - Normal landing page (marketing) shown when no subdomain

5. **Settings Form Updates (`client/src/components/CommunitySettingsCard.tsx`):**
   - Added "Community Landing Page" section
   - Hero Image URL field with live preview
   - Saves heroImageUrl to tenant record

6. **API Types (`client/src/lib/api.ts`):**
   - Added `heroImageUrl` to Tenant interface

---

## Files Created/Modified This Session

### New Files:
- `/client/src/pages/CommunityLanding.tsx` - Public community landing page

### Modified Files:
- `/shared/schema.ts` - Added heroImageUrl to tenants table
- `/server/routes.ts` - Added GET /api/public/:subdomain/info endpoint
- `/client/src/App.tsx` - Added subdomain routing to CommunityLanding
- `/client/src/components/CommunitySettingsCard.tsx` - Added heroImageUrl field
- `/client/src/lib/api.ts` - Added heroImageUrl to Tenant interface

---

## Demo Personas

| Persona | Name | Role | Access |
|---------|------|------|--------|
| **Emily** | Emily Foster | management_manager, account_admin | Full access to all |
| **Sarah** | Sarah Chen | poa_board_member, homeowner | Board + homeowner at Markland |
| **Jordan** | Jordan Mitchell | management_rep | Rep for Whispering Pines only |
| **Alex** | Alex Rivera | poa_board_contributor | Contributor at Markland |

---

## Project Overview

**POA Association Portal** - A multi-tenant SaaS platform for HOA/POA community management with:
- Multi-tenant architecture with subdomain isolation
- Role-based access control (8 user roles including management_rep)
- Dynamic JSON schema-driven forms with AI generation
- Architectural review board (ARB) application workflows
- AI-powered application analysis
- Visual workflow designer
- Complete billing system with Stripe integration
- Property-rep assignment system
- **Community custom landing pages** (NEW)

### Tech Stack
- **Frontend:** React 19 + Vite 7 + Tailwind 4 + shadcn/ui
- **State:** React Query + Zustand + React Hook Form
- **Backend:** Express + TypeScript + Drizzle ORM
- **Database:** Neon Serverless PostgreSQL
- **AI:** Anthropic Claude (claude-sonnet-4-5-20250929)
- **Storage:** Azure Blob Storage
- **Maps:** Google Maps API (geocoding + satellite imagery)
- **Payments:** Stripe (customers, invoices, payment methods)

---

## Feature Implementation Status

### COMPLETE - Community Custom Landing Pages

**Key Files:**
- `/shared/schema.ts` - heroImageUrl field on tenants
- `/server/routes.ts` - GET /api/public/:subdomain/info endpoint
- `/client/src/pages/CommunityLanding.tsx` - Landing page component
- `/client/src/App.tsx` - Subdomain routing
- `/client/src/components/CommunitySettingsCard.tsx` - Hero image settings

**Public API Response:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Markland POA",
    "subdomain": "markland",
    "heroImageUrl": null,
    "designGuidelinesUrl": null,
    "communitySettings": { ... }
  },
  "nextEvent": {
    "id": "uuid",
    "title": "Board Meeting",
    "startDatetime": "2025-12-15T19:00:00Z",
    "endDatetime": "2025-12-15T21:00:00Z",
    "location": "Community Center",
    "meetingUrl": null,
    "eventType": { "name": "Board Meeting", "slug": "board_meeting" }
  }
}
```

### COMPLETE - Management Rep Property Assignment

**Key Files:**
- `/shared/schema.ts` - propertyRepAssignments table
- `/server/storage.ts` - 9 storage methods
- `/server/routes.ts` - 11 API endpoints
- `/server/provision.ts` - Demo data with Jordan + rep assignments
- `/client/src/components/PropertyRepAssignmentModal.tsx` - Manager UI
- `/client/src/components/RepContactCard.tsx` - Homeowner contact card
- `/client/src/pages/Properties.tsx` - Rep column and manage action
- `/client/src/pages/Dashboard.tsx` - Homeowner sidebar card

### COMPLETE - Billing & Usage System

**Pricing Model:** Everyone gets ALL features. Premium operations cost Credits.

**Pricing Tiers (door-based):**
| Tier | Doors | Base Price | Included Credits | Overage Cost |
|------|-------|------------|------------------|--------------|
| Small | 1-50 | $29/mo | 10 | $2.00/credit |
| Medium | 51-150 | $79/mo | 25 | $1.75/credit |
| Large | 151-500 | $149/mo | 50 | $1.50/credit |
| XL | 501+ | $299/mo | 100 | $1.25/credit |

**Credit Consumption:**
| Operation | Credits |
|-----------|---------|
| Standard AI Analysis | 1 credit |
| Full AI Analysis (+ mockup, research, breakdown) | 2 credits |
| AI Form Generation | 1 credit |

**All features included in every tier:**
- Applications, workflows, calendar, compliance tracking
- Custom branding, community landing pages
- Document storage, e-signatures, QR upload
- Unlimited users, role-based access

---

## API Endpoints Reference

### Public Community Info (NEW)
```
GET    /api/public/:subdomain/info  # Get community info without auth
```

### Property Rep Assignment
```
GET    /api/properties/:propertyId/reps           # Get rep assignments
GET    /api/properties/:propertyId/rep-info       # Get rep info (homeowner)
POST   /api/properties/:propertyId/reps           # Assign rep
PATCH  /api/property-rep-assignments/:id          # Update assignment
DELETE /api/property-rep-assignments/:id          # Remove assignment
POST   /api/reps/:userId/bulk-assign              # Bulk assign
GET    /api/users/:userId/property-assignments    # Get user's properties
GET    /api/management-companies/:id/default-rep  # Get default rep
PUT    /api/management-companies/:id/default-rep  # Set default rep
GET    /api/tenants/:tenantId/users               # Get tenant users
```

### Billing & Stripe
```
GET    /api/billing/stripe-config                    # Get Stripe config
POST   /api/billing/setup-intent                     # Create SetupIntent
GET    /api/billing/payment-methods/:tenantId        # List payment methods
POST   /api/billing/payment-methods/:tenantId/default# Set default
DELETE /api/billing/payment-methods/:paymentMethodId # Remove
GET    /api/billing/settings/:tenantId               # Get billing settings
PATCH  /api/billing/settings/:tenantId               # Update billing settings
POST   /api/webhooks/stripe                          # Stripe webhook
GET    /api/billing/consumption                      # Usage summary
GET    /api/billing/usage-history                    # Historical usage
GET    /api/billing/invoices                         # List invoices
```

---

## Environment Variables

### Stripe (Dev Keys):
```
STRIPE_SECRET_KEY_DEV=sk_test_xxx       # SET
STRIPE_PUBLISHABLE_KEY_DEV=pk_test_xxx  # SET
STRIPE_WEBHOOK_SECRET_DEV=              # NOT SET - need webhook
```

### Stripe (Prod Keys - for later):
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Important Conventions

### Application Number Format
**Format:** `{tenant-last-4-chars}-{year}-{random-4-alphanumeric}`
**Example:** `A1B2-2025-XY9Z`

This is generated in:
- `server/routes.ts` (line ~872) - for real applications
- `server/provision.ts` (line ~335) - for demo applications

**DO NOT** use old formats like `APP-2024-001` or similar sequential numbering.

---

## Known Issues

### Pre-existing TypeScript Errors (Low Priority)
- Some TypeScript errors exist in provision.ts and other files
- These are pre-existing and don't affect runtime
- The new components compile cleanly

### Subdomain Detection in Replit
- Replit's hostname parsing may detect GUID as subdomain
- Use `?subdomain=markland` query param for reliable testing
- True subdomain routing works when deployed with custom domain

---

## Future Enhancements

### Community Landing Pages
- Add events calendar section (show multiple upcoming events)
- Add community announcements/news section
- Add photo gallery
- Social media links

### Property-Level Permission Enforcement
- Restrict ACTIONS on unassigned properties (not just visibility)
- Show "read-only" badge on unassigned property pages
- Block operations on applications for unassigned properties

### Default Fallback Rep UI
- Add UI in ManagementSettingsModal to set default fallback rep
- Storage method `setDefaultFallbackRep()` already exists
