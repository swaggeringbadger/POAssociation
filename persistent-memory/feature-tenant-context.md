# Feature: Tenant Context Switching & Multi-Tenancy

**Priority:** High
**Status:** UI exists, not wired to backend
**Impact:** Users see wrong data, can't access their actual tenants

---

## Current State

### What Exists
- ✅ Tenant switcher dropdown in sidebar (UI only)
- ✅ Hardcoded TENANTS array with 3 mock tenants
- ✅ Zustand store persists currentTenant selection
- ✅ Backend API endpoints for tenants
- ✅ Database has tenants table with proper schema
- ✅ Seed script creates 4 tenants (1 mgmt company + 3 communities)

### What's Broken
- ❌ Dropdown shows hardcoded tenants, not user's actual tenants
- ❌ Users can "switch" to tenants they don't belong to
- ❌ Never fetches tenants from `/api/tenants` endpoint
- ❌ Never fetches user's tenant assignments from `/api/users/:userId/tenants`
- ❌ No permission checks based on tenant access
- ❌ Context header shows tenant name but doesn't enforce isolation

---

## Problem Statement

**Current Behavior:**
1. User logs in with Replit auth
2. Frontend loads hardcoded TENANTS array from `mock-data.ts`
3. User can select any tenant from dropdown
4. No validation that user actually has access to that tenant
5. All users see same 3 tenants regardless of their assignments

**Expected Behavior:**
1. User logs in with Replit auth
2. Frontend fetches user's assigned tenants from `/api/users/:userId/tenants`
3. Dropdown shows only tenants user has access to
4. User selects a tenant they're assigned to
5. All API calls filtered by selected tenant
6. Backend validates user has access to requested tenant

---

## User Stories

### As a Homeowner in One Community
**Current:** See all 3 communities, can switch to any
**Expected:** See only "Markland POA", no switcher needed

### As a Board Member in Two Communities
**Current:** See all 3 communities
**Expected:** See only "Markland POA" and "Whispering Pines HOA", can switch between them

### As a Management Company Manager
**Current:** See all 3 communities
**Expected:** See "Apex Management" + all managed communities, can switch between them

### As a Super Admin
**Current:** See 3 hardcoded communities
**Expected:** See all tenants in system, can switch to any for support purposes

---

## Implementation Plan

### Step 1: Fetch User's Tenants on Auth

**When:** After successful Replit authentication
**File:** `client/src/hooks/useAuth.ts` or create `useUserTenants.ts`

**Implementation:**
```typescript
// New hook: client/src/hooks/useUserTenants.ts
export function useUserTenants() {
  const { user } = useAuth();
  const { setAvailableTenants, setCurrentTenant } = useAppStore();

  const { data: userTenants, isLoading } = useQuery({
    queryKey: ['userTenants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return api.getUserTenants(user.id);
    },
    enabled: !!user?.id,
    onSuccess: (tenants) => {
      setAvailableTenants(tenants);
      // Auto-select first tenant if none selected
      if (tenants.length > 0 && !useAppStore.getState().currentTenant) {
        setCurrentTenant(tenants[0].tenant);
      }
    },
  });

  return { userTenants, isLoading };
}
```

**Add to API client:**
```typescript
// client/src/lib/api.ts
async getUserTenants(userId: string): Promise<UserTenantAssignment[]> {
  const response = await fetch(`${this.baseUrl}/users/${userId}/tenants`);
  if (!response.ok) throw new Error('Failed to fetch user tenants');
  return response.json();
}
```

### Step 2: Update Store to Use Dynamic Tenants

**File:** `client/src/lib/store.ts`

**Changes:**
```typescript
interface AppState {
  availableTenants: Tenant[]; // NEW: fetched from API
  currentTenant: Tenant | null; // nullable until loaded
  currentUserRole: Role;
  setAvailableTenants: (tenants: Tenant[]) => void; // NEW
  setCurrentTenant: (tenant: Tenant) => void;
  setCurrentUserRole: (role: Role) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      availableTenants: [], // Start empty
      currentTenant: null,
      currentUserRole: 'homeowner',

      setAvailableTenants: (tenants) => set({ availableTenants: tenants }),
      setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),
    }),
    {
      name: 'poassociation-state',
    }
  )
);
```

### Step 3: Update Tenant Switcher Component

**File:** `client/src/components/layout/DashboardLayout.tsx` lines 72-99

**Changes:**
```typescript
// OLD: Uses hardcoded TENANTS
import { TENANTS } from '@/lib/mock-data'; // ← Remove this

// NEW: Uses store's availableTenants
const { currentTenant, availableTenants, setCurrentTenant } = useAppStore();

// In the dropdown:
{availableTenants.map(t => (
  <DropdownMenuItem key={t.id} onClick={() => setCurrentTenant(t)}>
    <Building className="mr-2 h-4 w-4" />
    <div className="flex flex-col">
      <span>{t.name}</span>
      <span className="text-xs text-muted-foreground">{t.subdomain}.poassociation.com</span>
    </div>
    {currentTenant?.id === t.id && <Badge variant="secondary">Active</Badge>}
  </DropdownMenuItem>
))}

// Hide switcher if user only has one tenant
{availableTenants.length > 1 && (
  <div className="mb-6 px-2">
    {/* Tenant switcher dropdown */}
  </div>
)}
```

### Step 4: Add Loading State for Tenant Fetch

**File:** `client/src/App.tsx` or `DashboardLayout.tsx`

**Implementation:**
```typescript
function DashboardLayout({ children }) {
  const { isLoading: authLoading } = useAuth();
  const { userTenants, isLoading: tenantsLoading } = useUserTenants();
  const { currentTenant } = useAppStore();

  if (authLoading || tenantsLoading) {
    return <LoadingSpinner />;
  }

  if (!currentTenant) {
    return <NoTenantsAssigned />;
  }

  return (
    // ... normal layout
  );
}
```

### Step 5: Backend Validation

**Requirement:** Validate user has access to requested tenant on all API calls

**Implementation - Option 1: Middleware**
```typescript
// server/middleware/tenantAccess.ts
export function requireTenantAccess() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    const tenantId = req.params.tenantId || req.body.tenantId;

    if (!userId || !tenantId) {
      return res.status(400).json({ error: 'Missing user or tenant' });
    }

    const hasAccess = await storage.userHasAccessToTenant(userId, tenantId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    next();
  };
}

// Apply to routes:
app.get('/api/tenants/:tenantId/forms',
  isAuthenticated,
  requireTenantAccess(),
  async (req, res) => { ... }
);
```

**Implementation - Option 2: In Storage Layer**
```typescript
// server/storage.ts
async getFormTemplatesForTenant(tenantId: string, userId?: string): Promise<FormTemplate[]> {
  // If userId provided, validate access
  if (userId) {
    const hasAccess = await this.userHasAccessToTenant(userId, tenantId);
    if (!hasAccess) {
      throw new Error('User does not have access to this tenant');
    }
  }

  return db.select().from(formTemplates)
    .where(eq(formTemplates.tenantId, tenantId));
}

async userHasAccessToTenant(userId: string, tenantId: string): Promise<boolean> {
  const [assignment] = await db
    .select()
    .from(userTenantRoles)
    .where(and(
      eq(userTenantRoles.userId, userId),
      eq(userTenantRoles.tenantId, tenantId)
    ));
  return !!assignment;
}
```

---

## Data Flow

### Current (Broken) Flow
```
1. User logs in → Auth successful
2. Frontend loads TENANTS from mock-data.ts
3. User selects "Markland POA" from dropdown
4. Zustand stores selection
5. API calls use tenantId from selection
6. ⚠️ No validation that user has access
```

### Fixed Flow
```
1. User logs in → Auth successful
2. Frontend fetches GET /api/users/{userId}/tenants
3. Store availableTenants in Zustand
4. Dropdown shows only user's tenants
5. User selects tenant OR auto-select if only one
6. Zustand stores selection
7. API calls use tenantId from selection
8. ✅ Backend validates user has access to tenant
```

---

## Edge Cases

### User Has Zero Tenants
**Scenario:** New user just signed up, not assigned to any tenant yet
**UI:** Show onboarding screen: "Welcome! Contact your community manager to get access."
**Component:** Create `NoTenantsAssigned.tsx`

### User Has One Tenant
**Scenario:** Homeowner in single community
**UI:** Don't show tenant switcher dropdown, just display tenant name in header
**Simplification:** Reduces cognitive load

### User Loses Access to Current Tenant
**Scenario:** User switched to Markland POA, but admin removes their access
**Behavior:**
- Next API call returns 403 Forbidden
- Frontend catches error, clears currentTenant
- Refetches availableTenants
- Shows "Access removed" message
- Auto-selects different tenant if available

### Management Company View
**Scenario:** User is manager at Apex Management, which manages 3 communities
**UI:**
- Dropdown shows "Apex Management" + 3 communities
- When "Apex Management" selected, dashboard shows aggregate data across all communities
- When community selected, dashboard shows that community only

### Super Admin View
**Scenario:** Platform super admin needs to access any tenant for support
**Backend:** Check if user has `super_admin` role
**Permission:** If super_admin, skip tenant access validation
**UI:** Fetch ALL tenants, show full list in dropdown

---

## URL Strategy for Multi-Tenancy

### Option 1: Query Parameter (Current)
**URL:** `https://poassociation.com/dashboard?tenant=markland`
**Pros:** Simple, single deployment
**Cons:** Can be manipulated, not as clean

### Option 2: Path Parameter
**URL:** `https://poassociation.com/t/markland/dashboard`
**Pros:** Cleaner than query param, still single deployment
**Cons:** Requires route restructuring

### Option 3: Subdomain (Future)
**URL:** `https://markland.poassociation.com/dashboard`
**Pros:** True isolation, better branding per community
**Cons:** Complex deployment, DNS config, SSL certs

**Recommendation for now:** Option 1 (query param), migrate to Option 2 later if needed

---

## Security Considerations

### Tenant Isolation
- ✅ All API endpoints must validate tenant access
- ✅ Database queries must filter by tenantId
- ✅ User can only see data from their assigned tenants
- ⚠️ Current implementation has NO validation

### Data Leakage Risks
**Risk 1:** User changes tenantId in API call
- **Mitigation:** Backend validates user has access to requested tenant

**Risk 2:** User sees data from wrong tenant in UI
- **Mitigation:** Always fetch data for currentTenant only, validate on backend

**Risk 3:** Cross-tenant data mixing in cache
- **Mitigation:** Include tenantId in React Query cache keys

```typescript
// Good: tenant-specific cache
queryKey: ['applications', currentTenant.id]

// Bad: shared cache across tenants
queryKey: ['applications']
```

---

## React Query Cache Strategy

All queries that return tenant-specific data must include tenantId in queryKey:

```typescript
// Applications
queryKey: ['applications', tenantId]
queryKey: ['applications', 'recent', tenantId]
queryKey: ['application', applicationId] // Single app doesn't need tenantId

// Forms
queryKey: ['formTemplates', tenantId]
queryKey: ['formTemplate', formId]

// Users within tenant
queryKey: ['users', tenantId]

// Properties within tenant
queryKey: ['properties', tenantId]
```

When tenant switches, invalidate all tenant-specific queries:

```typescript
function setCurrentTenant(tenant: Tenant) {
  const previousTenant = useAppStore.getState().currentTenant;

  // Update store
  set({ currentTenant: tenant });

  // Invalidate all queries for previous tenant
  if (previousTenant?.id !== tenant.id) {
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey.includes(previousTenant.id)
    });
  }
}
```

---

## Role-Based Filtering

Users have roles **per tenant** via `userTenantRoles` table. Same user can have different roles in different tenants.

### Example Scenarios

**Scenario 1:** Sarah is board member at Markland, homeowner at Whispering Pines
```typescript
userTenantRoles:
[
  { userId: 'sarah-123', tenantId: 'markland', role: 'poa_board_member' },
  { userId: 'sarah-123', tenantId: 'whispering-pines', role: 'homeowner' },
]
```

**UI Behavior:**
- When Markland selected: Show board member nav and permissions
- When Whispering Pines selected: Show homeowner nav and permissions
- Role switcher in sidebar should update based on selected tenant

### Implementation

**Fetch roles with tenant:**
```typescript
const { data: userTenantAssignments } = useQuery({
  queryKey: ['userTenants', userId],
  queryFn: () => api.getUserTenants(userId),
});

// Response structure:
[
  {
    id: 'utr-1',
    userId: 'sarah-123',
    tenantId: 'markland',
    role: 'poa_board_member',
    tenant: { id: 'markland', name: 'Markland POA', ... }
  },
  {
    id: 'utr-2',
    userId: 'sarah-123',
    tenantId: 'whispering-pines',
    role: 'homeowner',
    tenant: { id: 'whispering-pines', name: 'Whispering Pines HOA', ... }
  },
]
```

**Update role when tenant switches:**
```typescript
function setCurrentTenant(tenant: Tenant) {
  set({ currentTenant: tenant });

  // Find user's role for this tenant
  const userTenantAssignments = useAppStore.getState().userTenantAssignments;
  const assignment = userTenantAssignments?.find(a => a.tenantId === tenant.id);

  if (assignment) {
    set({ currentUserRole: assignment.role });
  }
}
```

---

## Testing Strategy

### Unit Tests
- [ ] `getUserTenants()` returns correct tenants for user
- [ ] `userHasAccessToTenant()` validates access correctly
- [ ] Tenant switcher shows only available tenants
- [ ] Role updates when tenant switches

### Integration Tests
- [ ] User assigned to 2 tenants sees both in dropdown
- [ ] User can switch between tenants
- [ ] API calls fail when user requests unauthorized tenant
- [ ] Cache invalidates on tenant switch

### E2E Tests
- [ ] Board member logs in, sees their communities
- [ ] Homeowner logs in, sees single community (no switcher)
- [ ] Manager logs in, sees management company + communities
- [ ] Super admin sees all tenants

---

## Migration Plan

### Phase 1: Backend Prep
1. Ensure `/api/users/:userId/tenants` endpoint works
2. Add `userHasAccessToTenant()` to storage layer
3. Add tenant access validation middleware
4. Test with Postman/curl

### Phase 2: Frontend Wiring
5. Create `useUserTenants` hook
6. Update store to use dynamic tenants
7. Wire tenant switcher to store
8. Add loading states

### Phase 3: Remove Mock Data
9. Delete `TENANTS` export from `mock-data.ts`
10. Find/replace all references to mock TENANTS
11. Ensure no hardcoded tenant IDs

### Phase 4: Testing & Refinement
12. Test with user who has 0 tenants
13. Test with user who has 1 tenant
14. Test with user who has multiple tenants
15. Test tenant switching
16. Test unauthorized access attempts

---

## Success Metrics

- ✅ Zero hardcoded tenant references in frontend
- ✅ All users see only their assigned tenants
- ✅ Tenant switcher hidden for single-tenant users
- ✅ API calls validated for tenant access
- ✅ No 403 errors for legitimate users
- ✅ Fast tenant switching (< 500ms)

---

## Related Documents

- `feature-gaps-triage.md` - Overall platform status
- `feature-auth-and-users.md` - Authentication and user roles
- `feature-sandbox-demo.md` - Demo tenant ecosystem
- `global-memory.md` - Code patterns

---

## Notes

- This is a **critical security fix** - currently any user can access any tenant's data
- Relatively easy fix: wire existing backend to existing frontend
- Must be done before any production use
- Pairs well with sandbox demo (demo can show multi-tenant switching)
