# Feature: Sandbox Demo Account

**Priority:** High
**Status:** Not implemented
**Target:** Pre-authentication demo environment

---

## Overview

Create a sandbox/demo mode that allows users to explore the platform without requiring Replit authentication. This provides a risk-free way for prospects to evaluate the platform and for developers to test features.

---

## User Story

**As a** prospective customer visiting poassociation.com
**I want to** explore the platform without creating an account
**So that** I can evaluate features before committing to sign up

**As a** developer
**I want to** quickly access a pre-populated demo environment
**So that** I can test features without authentication setup

---

## Current State

### What Exists
- ✅ Replit authentication with OpenID Connect
- ✅ Landing page (`Landing.tsx`) shows when not authenticated
- ✅ Database seeding script creates tenants and forms
- ⚠️ Context switcher dropdown exists but uses mock data

### What's Missing
- ❌ Pre-auth choice screen (Login vs. Sandbox)
- ❌ Sandbox mode flag/state
- ❌ Demo user accounts
- ❌ Demo ecosystem (management company + neighborhoods)
- ❌ Sample applications in various states
- ❌ Read-only or limited-write demo environment

---

## Proposed Solution

### Architecture

```
Landing Page (/)
    ↓
Auth Choice Screen (NEW)
    ├─→ "Login with Replit" → Replit OAuth → Authenticated Dashboard
    └─→ "Try Sandbox Demo" → Demo Session → Sandbox Dashboard
                                 ↓
                        Fake demo user + ecosystem
```

### Demo Ecosystem Structure

```
Apex Management Solutions (Management Company)
├── Markland POA (Community 1)
│   ├── 8 properties
│   ├── 3 board members
│   ├── 12 homeowners
│   ├── 2 form templates (Structural Changes, Paint/Fence)
│   └── 15 sample applications (5 pending, 3 under review, 4 approved, 3 rejected)
│
└── Whispering Pines HOA (Community 2)
    ├── 12 properties
    ├── 4 board members
    ├── 18 homeowners
    ├── 3 form templates (Landscaping, Addition, General Request)
    └── 22 sample applications (various states)
```

---

## Implementation Plan

### Phase 1: Auth Choice Screen (Essential)

#### 1.1 Create Auth Choice Component
**File:** `client/src/pages/AuthChoice.tsx`

Features:
- Two prominent cards: "Login" and "Try Demo"
- Marketing copy explaining each option
- Visual preview of what demo includes
- Clear "no credit card required" messaging for demo

#### 1.2 Update Routing
**File:** `client/src/App.tsx`

```typescript
// Pseudocode
if (!isAuthenticated && !isDemoMode) {
  return <AuthChoice />
} else if (isDemoMode) {
  return <DashboardWithDemoData />
} else {
  return <DashboardWithRealData />
}
```

#### 1.3 Add Demo Mode State
**File:** `client/src/lib/store.ts`

Add to Zustand store:
```typescript
interface AppState {
  isDemoMode: boolean;
  demoUser: DemoUser | null;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  // ... existing state
}
```

### Phase 2: Demo Data Generation (Essential)

#### 2.1 Create Demo Seed Script
**File:** `server/seedDemo.ts`

Creates complete ecosystem:
- 1 management company
- 2 communities (Markland POA, Whispering Pines HOA)
- 3 demo users with different roles:
  - `demo-board@poassociation.com` (Board Member perspective)
  - `demo-homeowner@poassociation.com` (Homeowner perspective)
  - `demo-manager@poassociation.com` (Management company perspective)
- Multiple form templates per community
- 30+ sample applications in various states with realistic data

#### 2.2 Create Demo Data Export
**File:** `server/exportDemoData.ts`

Exports seeded demo data to JSON for frontend caching:
- Allows frontend to operate without backend calls in demo mode
- Enables fast "reset demo" functionality
- Could be committed to repo for consistent demo experience

### Phase 3: Demo Mode Backend (Two Options)

#### Option A: Frontend-Only Demo (Recommended for MVP)
**Pros:**
- Faster to implement
- No backend changes needed
- No database pollution
- Instant reset

**Cons:**
- No real form submissions
- Can't demonstrate full workflow
- Less realistic

**Implementation:**
- All API calls intercepted by mock layer
- Demo data stored in memory
- Changes don't persist
- Perfect for "read-only" exploration

#### Option B: Backend Demo with Isolation
**Pros:**
- Full functionality demonstration
- Real form submissions work
- More realistic experience

**Cons:**
- Requires backend changes
- Need demo user cleanup strategy
- Potential database pollution

**Implementation:**
- Create demo user on each session with unique ID
- Tag all demo data with `isDemo: true` flag
- Periodic cleanup job removes old demo data
- Demo users have limited permissions

### Phase 4: Demo Mode UX (Essential)

#### 4.1 Demo Mode Banner
Display persistent banner at top:
```
🎭 Demo Mode Active | Exploring as: Board Member @ Markland POA |
[Switch Role ▼] [Exit Demo] [Reset Demo]
```

#### 4.2 Demo Role Switcher
Allow switching between demo personas:
- **Board Member** - See application review workflow
- **Homeowner** - See application submission
- **Management Manager** - See multi-community overview

Each role switch changes current user and tenant context.

#### 4.3 Demo Limitations UI
Show tooltips/modals when demo users try restricted actions:
```
"🎭 Demo Mode: Changes saved temporarily.
Sign up to save permanently."
```

#### 4.4 Exit Demo CTA
Prominent "Upgrade to Full Account" buttons in:
- Demo banner
- After completing key actions
- On attempted restricted actions

### Phase 5: Demo Data Quality (Important)

#### 5.1 Realistic Sample Applications
Create applications with:
- Varied submission dates (last 90 days)
- Different statuses throughout workflow
- Realistic names, addresses, descriptions
- Some with reviewer comments
- Mix of simple and complex requests

#### 5.2 Realistic Form Schemas
Include variety:
- Simple 3-field form
- Complex Markland form (existing)
- Form with conditional fields
- Form with file uploads (show UI even if uploads disabled in demo)

#### 5.3 Realistic Community Data
- Believable HOA names and details
- Varied community sizes
- Different management companies
- Board meeting dates and times
- Community rules/bylaws excerpts

---

## Detailed Feature Specs

### Auth Choice Screen Design

```
┌─────────────────────────────────────────────────────────────┐
│                    POA Association                          │
│         Modern Community Management Platform                │
└─────────────────────────────────────────────────────────────┘

        ┌──────────────────────┐    ┌──────────────────────┐
        │   Login / Sign Up    │    │   Try Demo           │
        │                      │    │                      │
        │   [Replit Logo]      │    │   [Play Icon]        │
        │                      │    │                      │
        │   Continue with      │    │   Explore without    │
        │   Replit Account     │    │   signing up         │
        │                      │    │                      │
        │   • Access your      │    │   • Pre-loaded       │
        │     communities      │    │     sample data      │
        │   • Submit real      │    │   • All features     │
        │     applications     │    │     enabled          │
        │   • Full features    │    │   • No account       │
        │                      │    │     required         │
        │   [Login Button]     │    │   [Demo Button]      │
        └──────────────────────┘    └──────────────────────┘
```

### Demo Banner Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🎭 DEMO MODE | Viewing as: Sarah Chen (Board Member) @      │
│ Markland POA | [Switch Role ▼] [Reset] [Exit & Sign Up]    │
└─────────────────────────────────────────────────────────────┘
```

### Demo User Personas

#### Persona 1: Board Member (Sarah Chen)
- **Email:** demo-board@poassociation.com
- **Role:** Board Member at Markland POA
- **Use Case:** Review and approve applications
- **View:**
  - Dashboard with pending applications
  - Application review interface
  - Approval/rejection workflow
  - Comment/request changes capability

#### Persona 2: Homeowner (James Martinez)
- **Email:** demo-homeowner@poassociation.com
- **Role:** Homeowner at Whispering Pines HOA
- **Use Case:** Submit new applications, track status
- **View:**
  - Available form templates
  - Form submission interface
  - "My Applications" list with status
  - Communication with board

#### Persona 3: Management Manager (Emily Foster)
- **Email:** demo-manager@poassociation.com
- **Role:** Manager at Apex Management Solutions
- **Use Case:** Oversee multiple communities
- **View:**
  - Multi-community dashboard
  - Cross-community analytics
  - Form template management
  - User/role assignment

---

## Technical Considerations

### Session Management

**Option 1: Frontend-Only Session**
```typescript
// Store in sessionStorage, cleared on tab close
const demoSession = {
  isDemoMode: true,
  demoUser: { /* persona */ },
  demoData: { /* cached demo dataset */ },
  sessionId: uuidv4(), // for analytics
};
```

**Option 2: Backend Demo Session**
```typescript
// Create temporary demo user in database
app.get('/api/demo/start', async (req, res) => {
  const demoUser = await storage.createDemoUser();
  req.session.demoUserId = demoUser.id;
  req.session.isDemoMode = true;
  res.json({ user: demoUser, tenants: demTenants });
});
```

### Demo Data Persistence

**Option 1: Ephemeral (Recommended)**
- Demo data stored in memory/sessionStorage
- Reset on page refresh
- Fast, no cleanup needed

**Option 2: Temporary Database Records**
- Create demo user with TTL (time-to-live)
- Cron job deletes demo data older than 24 hours
- More realistic but requires cleanup

### API Mocking Strategy

**Frontend Interceptor:**
```typescript
// client/src/lib/demoApiClient.ts
class DemoApiClient extends ApiClient {
  async getApplicationsForTenant(tenantId: string) {
    if (useAppStore.getState().isDemoMode) {
      return DEMO_APPLICATIONS.filter(a => a.tenantId === tenantId);
    }
    return super.getApplicationsForTenant(tenantId);
  }
}
```

### Demo Reset Functionality

**Quick Reset:**
- Reload initial demo dataset
- Clear any changes made during session
- Reset to default persona

**Full Reset:**
- Clear sessionStorage
- Reload page
- Return to auth choice screen

---

## User Flows

### Flow 1: New Visitor Explores Demo

1. Visit poassociation.com
2. See auth choice screen
3. Click "Try Demo"
4. Instantly see dashboard as Board Member
5. See 5 pending applications
6. Click into one application
7. See full application details with inline bylaws
8. (Optional) Approve application with comment
9. See success toast: "Demo application approved! Sign up to save real data."
10. Banner: "Like what you see? [Sign Up Now]"

### Flow 2: Demo User Switches Roles

1. In demo mode as Board Member
2. Click "Switch Role" in banner
3. See dropdown with 3 personas
4. Select "Homeowner"
5. Dashboard reloads with homeowner perspective
6. See "Submit Request" prominently
7. Click and see available forms
8. Fill out sample form
9. Submit
10. See in "My Applications" list

### Flow 3: Demo User Exits to Sign Up

1. In demo mode
2. Try to perform action (e.g., create new form template)
3. See modal: "Sign up to unlock full features"
4. Click "Sign Up"
5. Exit demo mode
6. Show Replit auth flow
7. After auth, show dashboard with empty slate
8. Offer to "Import demo data as template"

---

## Success Metrics

### Engagement Metrics
- % visitors who try demo vs. sign up directly
- Average demo session duration
- Number of features explored per demo session
- % demo users who convert to signup
- Time from demo start to signup decision

### Feature Metrics
- Which demo role is most popular
- Which pages viewed most in demo
- Which actions attempted most
- Drop-off points in demo flow

### Conversion Metrics
- Demo → Signup conversion rate
- Time between demo and signup
- Feature usage correlation with signup
- Signup source attribution

---

## Alternative Approaches

### Approach 1: Video Demo Instead
**Pros:** No implementation needed, easier to maintain
**Cons:** Less engaging, can't explore freely, no hands-on feel
**Verdict:** Could complement but not replace interactive demo

### Approach 2: Guided Tour with Tooltips
**Pros:** Real user data, simpler implementation
**Cons:** Requires signup first, can't freely explore
**Verdict:** Good for onboarding, not discovery

### Approach 3: Read-Only Access to Real Tenant
**Pros:** Shows real data, easier to implement
**Cons:** Privacy concerns, stale data, no interaction
**Verdict:** Possible but less engaging than isolated demo

---

## Open Questions

1. **Should demo submissions persist across sessions?**
   - Recommendation: No, fresh start each session for consistency

2. **Should we allow demo users to create forms?**
   - Recommendation: Yes, but don't save to database OR save to demo schema

3. **How long should demo sessions last?**
   - Recommendation: Single browser session (cleared on tab close)

4. **Should demo mode have all features or subset?**
   - Recommendation: All features visible, some with "Sign up to unlock" gates

5. **Should we track demo user analytics?**
   - Recommendation: Yes, with anonymous session ID

6. **Can demo users export data?**
   - Recommendation: No, or only to show feature UI then prompt signup

---

## Implementation Phases

### Phase 1: MVP (3-5 days)
- [ ] Auth choice screen
- [ ] Frontend-only demo mode with hardcoded data
- [ ] Single demo persona (Board Member)
- [ ] Basic demo banner
- [ ] Exit demo flow
- **Goal:** Functional but limited demo

### Phase 2: Enhanced (2-3 days)
- [ ] Three demo personas with role switching
- [ ] Richer demo dataset (30+ applications)
- [ ] Demo reset functionality
- [ ] Better demo-to-signup conversion flow
- **Goal:** Compelling demo experience

### Phase 3: Polish (2-3 days)
- [ ] Backend demo mode with real submissions
- [ ] Demo analytics tracking
- [ ] Contextual "Sign up" CTAs
- [ ] Demo onboarding tooltips
- **Goal:** Production-ready demo

### Phase 4: Scale (Ongoing)
- [ ] A/B test different demo flows
- [ ] Optimize conversion funnels
- [ ] Add more demo scenarios
- [ ] Seasonal/industry-specific demo data
- **Goal:** Maximize conversion

---

## Dependencies

### Required Before Implementation
- ✅ Replit authentication (already done)
- ⚠️ Wire frontend to use real API calls (see feature-gaps-triage.md)
- ⚠️ Build applications list page (needed for demo to be useful)

### Nice to Have
- Application review/approval UI
- Profile management
- Better error handling

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Demo too limited, unimpressive | Low conversion | Include 80% of features, focus on wow moments |
| Demo too complex, overwhelming | User confusion | Start with guided flow, offer free exploration |
| Demo data unrealistic | Credibility issues | Use real-world community names (anonymized), realistic scenarios |
| Demo users spam database | Performance/cost | Use frontend-only OR aggressive cleanup |
| Security: demo users access real data | Critical security issue | Strict isolation, separate demo flag checks |
| Users can't find demo option | Low adoption | Prominent placement on landing, A/B test messaging |

---

## Related Documents

- `feature-gaps-triage.md` - Overall platform triage
- `feature-auth-and-users.md` - Authentication system
- `feature-application-workflow.md` - Application submission/review
- `global-memory.md` - Architectural patterns

---

## Appendix: Sample Demo Data Structure

### Demo Applications

```json
{
  "id": "demo-app-001",
  "tenantId": "markland-poa",
  "formTemplateId": "structural-changes",
  "submittedByUserId": "demo-homeowner-1",
  "status": "pending",
  "submittedAt": "2025-11-18T14:30:00Z",
  "formData": {
    "homeowner_name": "Robert Chen",
    "property_address": "142 Lakeside Drive",
    "project_type": "Deck Addition",
    "project_description": "10x12 composite deck on rear of property",
    "estimated_cost": "8500",
    "contractor_name": "Summit Deck Builders",
    "contractor_license": "NC-12345"
  }
}
```

### Demo Users

```json
{
  "id": "demo-board-member",
  "email": "demo-board@poassociation.com",
  "firstName": "Sarah",
  "lastName": "Chen",
  "role": "poa_board_member",
  "tenantId": "markland-poa",
  "avatar": "/demo-avatars/sarah.jpg"
}
```

---

## Notes

- This feature is **critical for growth** - reduces signup friction
- Recommended to implement MVP first, iterate based on usage
- Consider as marketing tool, not just product demo
- Could power sales demos, embedded website widgets, etc.
