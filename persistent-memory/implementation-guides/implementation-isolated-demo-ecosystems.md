# Implementation: Isolated Demo Ecosystems

**Feature:** Fully isolated, fully functional demo sandboxes
**Architecture:** Each demo code provisions complete ecosystem
**Data Strategy:** Demo data tagged with `demoCodeId` for safe purging
**Behavior:** Zero differences between demo and real users

---

## Architecture Principles

### 1. Complete Isolation
- Each demo code gets its own management company, communities, users, forms, applications
- Demo users are real users in the database, just tagged
- No shared data between demo codes
- No shared data between demo and production

### 2. Identical Behavior
- Demo users authenticate through normal session (no special demo auth)
- Demo users see/use same UI as real users
- Demo users can create, edit, delete - full CRUD
- No "if demo" branches in code

### 3. Safe Deletion
- All demo records tagged with `demoCodeId` foreign key
- Purge script deletes by `demoCodeId` where code expired
- No risk of deleting real data (different demoCodeId or null)
- Atomic provisioning and atomic deletion

---

## Database Schema

### Update All Main Tables

Add `demoCodeId` column to tables that need demo data:

```typescript
// shared/schema.ts

export const demoCodes = pgTable('demo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
  validFrom: timestamp('valid_from').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  maxUses: integer('max_uses'), // null = unlimited
  currentUses: integer('current_uses').notNull().default(0),
  isProvisioned: boolean('is_provisioned').notNull().default(false),
  provisionedAt: timestamp('provisioned_at'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Add demoCodeId to all demo-able tables
export const users = pgTable('users', {
  // ... existing fields
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});

export const tenants = pgTable('tenants', {
  // ... existing fields
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});

export const formTemplates = pgTable('form_templates', {
  // ... existing fields
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});

export const applications = pgTable('applications', {
  // ... existing fields
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});

export const userTenantRoles = pgTable('user_tenant_roles', {
  // ... existing fields
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }),
});
```

**Key Points:**
- `demoCodeId` is nullable - null means real production data
- `onDelete: cascade` - when demo code deleted, all related data auto-deleted
- `isProvisioned` flag prevents double-provisioning
- No `isDemo` flags needed anywhere else in code

### Session Tracking Table (Optional, for analytics)

```typescript
export const demoSessions = pgTable('demo_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});
```

---

## Ecosystem Provisioning

### Provisioning Function

When admin creates a demo code, automatically provision complete ecosystem:

```typescript
// server/provision.ts

interface DemoEcosystem {
  managementCompany: Tenant;
  communities: Tenant[];
  users: User[];
  formTemplates: FormTemplate[];
  applications: Application[];
  userTenantRoles: UserTenantRole[];
}

export async function provisionDemoEcosystem(demoCodeId: string): Promise<DemoEcosystem> {
  console.log(`🌱 Provisioning demo ecosystem for code: ${demoCodeId}`);

  // 1. Create Management Company
  const managementCompany = await storage.createTenant({
    name: 'Apex Management Solutions',
    type: 'management_company',
    subdomain: `apex-${demoCodeId.slice(-8)}`, // Unique subdomain per code
    managementCompanyId: null,
    isActive: true,
    demoCodeId,
  });
  console.log('✅ Created management company');

  // 2. Create Communities
  const markland = await storage.createTenant({
    name: 'Markland POA',
    type: 'community',
    subdomain: `markland-${demoCodeId.slice(-8)}`,
    managementCompanyId: managementCompany.id,
    isActive: true,
    demoCodeId,
  });

  const whisperingPines = await storage.createTenant({
    name: 'Whispering Pines HOA',
    type: 'community',
    subdomain: `whispering-pines-${demoCodeId.slice(-8)}`,
    managementCompanyId: managementCompany.id,
    isActive: true,
    demoCodeId,
  });
  console.log('✅ Created 2 communities');

  // 3. Create Demo Users
  const demoUsers = await Promise.all([
    storage.upsertUser({
      id: `${demoCodeId}-user-manager`,
      email: `demo-manager-${demoCodeId.slice(-8)}@poassociation.com`,
      firstName: 'Emily',
      lastName: 'Foster',
      profileImageUrl: null,
      demoCodeId,
    }),
    storage.upsertUser({
      id: `${demoCodeId}-user-board`,
      email: `demo-board-${demoCodeId.slice(-8)}@poassociation.com`,
      firstName: 'Sarah',
      lastName: 'Chen',
      profileImageUrl: null,
      demoCodeId,
    }),
    storage.upsertUser({
      id: `${demoCodeId}-user-resident`,
      email: `demo-resident-${demoCodeId.slice(-8)}@poassociation.com`,
      firstName: 'James',
      lastName: 'Martinez',
      profileImageUrl: null,
      demoCodeId,
    }),
    storage.upsertUser({
      id: `${demoCodeId}-user-contributor`,
      email: `demo-contributor-${demoCodeId.slice(-8)}@poassociation.com`,
      firstName: 'Alex',
      lastName: 'Rivera',
      profileImageUrl: null,
      demoCodeId,
    }),
  ]);
  console.log('✅ Created 4 demo users');

  // 4. Assign User Roles
  const userTenantRoles = await Promise.all([
    // Emily (Manager) - access to all
    storage.assignUserRole({
      userId: demoUsers[0].id,
      tenantId: managementCompany.id,
      role: 'management_manager',
      demoCodeId,
    }),
    storage.assignUserRole({
      userId: demoUsers[0].id,
      tenantId: markland.id,
      role: 'management_rep',
      demoCodeId,
    }),
    storage.assignUserRole({
      userId: demoUsers[0].id,
      tenantId: whisperingPines.id,
      role: 'management_rep',
      demoCodeId,
    }),

    // Sarah (Board Member) - Markland only
    storage.assignUserRole({
      userId: demoUsers[1].id,
      tenantId: markland.id,
      role: 'poa_board_member',
      demoCodeId,
    }),

    // James (Resident) - Whispering Pines only
    storage.assignUserRole({
      userId: demoUsers[2].id,
      tenantId: whisperingPines.id,
      role: 'homeowner',
      demoCodeId,
    }),

    // Alex (Contributor) - Markland only
    storage.assignUserRole({
      userId: demoUsers[3].id,
      tenantId: markland.id,
      role: 'poa_board_contributor',
      demoCodeId,
    }),
  ]);
  console.log('✅ Assigned user roles');

  // 5. Create Form Templates
  const formTemplates = await Promise.all([
    storage.createFormTemplate({
      tenantId: markland.id,
      name: 'Structural Changes Application',
      description: 'For major modifications to property structure',
      schema: MARKLAND_STRUCTURAL_SCHEMA, // Import from mock-data
      isActive: true,
      demoCodeId,
    }),
    storage.createFormTemplate({
      tenantId: markland.id,
      name: 'Paint & Fence Request',
      description: 'For exterior paint changes and fence installations',
      schema: PAINT_FENCE_SCHEMA,
      isActive: true,
      demoCodeId,
    }),
    storage.createFormTemplate({
      tenantId: whisperingPines.id,
      name: 'Landscaping Modification',
      description: 'For tree removal, planting, and landscape changes',
      schema: LANDSCAPING_SCHEMA,
      isActive: true,
      demoCodeId,
    }),
    storage.createFormTemplate({
      tenantId: whisperingPines.id,
      name: 'General Architectural Request',
      description: 'For all other architectural modifications',
      schema: ARCH_REQUEST_FORM_SCHEMA,
      isActive: true,
      demoCodeId,
    }),
  ]);
  console.log('✅ Created 4 form templates');

  // 6. Create Sample Applications
  const applications = await createSampleApplications({
    demoCodeId,
    markland,
    whisperingPines,
    demoUsers,
    formTemplates,
  });
  console.log(`✅ Created ${applications.length} sample applications`);

  // 7. Mark demo code as provisioned
  await storage.updateDemoCode(demoCodeId, {
    isProvisioned: true,
    provisionedAt: new Date(),
  });

  console.log('🎉 Demo ecosystem provisioned successfully!');

  return {
    managementCompany,
    communities: [markland, whisperingPines],
    users: demoUsers,
    formTemplates,
    applications,
    userTenantRoles,
  };
}

// Helper to create realistic sample applications
async function createSampleApplications(params: {
  demoCodeId: string;
  markland: Tenant;
  whisperingPines: Tenant;
  demoUsers: User[];
  formTemplates: FormTemplate[];
}): Promise<Application[]> {
  const { demoCodeId, markland, whisperingPines, demoUsers, formTemplates } = params;
  const applications: Application[] = [];

  // Create applications with varied statuses and dates
  const statuses = ['pending', 'under_review', 'approved', 'rejected'];
  const daysAgo = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];

  for (let i = 0; i < 30; i++) {
    const tenant = i % 2 === 0 ? markland : whisperingPines;
    const formTemplate = formTemplates.find(f => f.tenantId === tenant.id);
    const status = statuses[i % 4];
    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - daysAgo[i % 10]);

    if (!formTemplate) continue;

    const app = await storage.createApplication({
      tenantId: tenant.id,
      formTemplateId: formTemplate.id,
      submittedByUserId: demoUsers[2].id, // Most apps from resident
      formData: generateRealisticFormData(formTemplate.name, i),
      status,
      submittedAt,
      reviewedAt: status !== 'pending' ? new Date(submittedAt.getTime() + 86400000 * 2) : null,
      reviewedByUserId: status !== 'pending' ? demoUsers[1].id : null,
      reviewNotes: status !== 'pending' ? generateReviewNotes(status) : null,
      demoCodeId,
    });

    applications.push(app);
  }

  return applications;
}

function generateRealisticFormData(formName: string, index: number): any {
  // Generate realistic form data based on form type
  const addresses = [
    '142 Lakeside Drive',
    '8734 Maple Ridge Court',
    '521 Willow Creek Lane',
    '1903 Oakmont Circle',
    '4567 Pine Valley Road',
  ];

  const names = [
    'Robert Chen',
    'Maria Garcia',
    'David Thompson',
    'Lisa Anderson',
    'Michael Brown',
  ];

  return {
    homeowner_name: names[index % 5],
    property_address: addresses[index % 5],
    project_type: 'Deck Addition',
    project_description: `Sample project description for application ${index + 1}`,
    estimated_cost: `${(Math.random() * 50000 + 5000).toFixed(0)}`,
    contractor_name: 'Summit Builders',
    contractor_license: `NC-${10000 + index}`,
  };
}

function generateReviewNotes(status: string): string {
  if (status === 'approved') {
    return 'Application meets all architectural guidelines. Approved with standard conditions.';
  } else if (status === 'rejected') {
    return 'Project does not comply with Section 4.2 of the architectural guidelines. Please revise and resubmit.';
  } else {
    return 'Under review. Board will make decision at next meeting.';
  }
}
```

---

## API Endpoints

### 1. Create Demo Code (Admin Only)

```typescript
// POST /api/admin/demo-codes
// Creates demo code AND provisions ecosystem

app.post('/api/admin/demo-codes',
  isAuthenticated,
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { code, label, validFrom, validUntil, maxUses } = req.body;

      // Validate inputs
      const schema = z.object({
        code: z.string().min(3).max(50),
        label: z.string().min(3).max(200),
        validFrom: z.string().datetime(),
        validUntil: z.string().datetime(),
        maxUses: z.number().int().positive().optional(),
      });

      const validated = schema.parse(req.body);

      // Create demo code
      const demoCode = await storage.createDemoCode({
        code: validated.code.toUpperCase(),
        label: validated.label,
        validFrom: new Date(validated.validFrom),
        validUntil: new Date(validated.validUntil),
        maxUses: validated.maxUses,
        currentUses: 0,
        isActive: true,
        isProvisioned: false,
        createdBy: req.session.userId,
      });

      // Provision ecosystem asynchronously (don't block response)
      provisionDemoEcosystem(demoCode.id).catch((error) => {
        console.error('Failed to provision demo ecosystem:', error);
        // Mark demo code as failed
        storage.updateDemoCode(demoCode.id, { isActive: false });
      });

      res.status(201).json({
        ...demoCode,
        message: 'Demo code created. Ecosystem provisioning in progress...',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  }
);
```

### 2. Validate Demo Code (Public)

```typescript
// POST /api/demo/validate-code

app.post('/api/demo/validate-code', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.json({ valid: false });
    }

    const demoCode = await storage.getDemoCodeByCode(code.toUpperCase());

    if (!demoCode) {
      return res.json({ valid: false });
    }

    // Check if provisioned
    if (!demoCode.isProvisioned) {
      return res.json({ valid: false, message: 'Ecosystem still provisioning...' });
    }

    // Check if active
    if (!demoCode.isActive) {
      return res.json({ valid: false });
    }

    // Check date range
    const now = new Date();
    if (now < new Date(demoCode.validFrom) || now > new Date(demoCode.validUntil)) {
      return res.json({ valid: false, message: 'Demo code expired' });
    }

    // Check usage limit
    if (demoCode.maxUses && demoCode.currentUses >= demoCode.maxUses) {
      return res.json({ valid: false, message: 'Demo code usage limit reached' });
    }

    // Get demo users for this code
    const demoUsers = await storage.getDemoUsersByCodeId(demoCode.id);

    res.json({
      valid: true,
      codeId: demoCode.id,
      label: demoCode.label,
      personas: demoUsers.map(u => ({
        id: u.id,
        persona: u.demoPersona,
        firstName: u.firstName,
        lastName: u.lastName,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Login as Demo Persona (Public)

```typescript
// POST /api/demo/login

app.post('/api/demo/login', async (req, res) => {
  try {
    const { userId } = req.body;

    // Get user and verify it's a demo user
    const user = await storage.getUser(userId);

    if (!user || !user.demoCodeId) {
      return res.status(400).json({ error: 'Invalid demo user' });
    }

    // Verify demo code still valid
    const demoCode = await storage.getDemoCode(user.demoCodeId);
    if (!demoCode || !demoCode.isActive) {
      return res.status(400).json({ error: 'Demo code no longer valid' });
    }

    const now = new Date();
    if (now < new Date(demoCode.validFrom) || now > new Date(demoCode.validUntil)) {
      return res.status(400).json({ error: 'Demo code expired' });
    }

    // Create session (just like Replit auth)
    req.session.userId = user.id;

    // Track demo session (analytics)
    await storage.createDemoSession({
      demoCodeId: user.demoCodeId,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Increment usage counter
    await storage.incrementDemoCodeUsage(user.demoCodeId);

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Get Current User (Updated)

```typescript
// GET /api/auth/user
// No changes needed! Demo users are just regular users

app.get('/api/auth/user', async (req, res) => {
  // Session-based auth (works for both Replit and demo users)
  if (req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    return res.json(user);
  }

  // Replit OAuth (for real users)
  if (req.user?.claims?.sub) {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    return res.json(user);
  }

  res.status(401).json({ error: 'Not authenticated' });
});
```

---

## Frontend Components

### 1. DemoCodeEntry.tsx

(Same as before, but simplified validation response)

```typescript
const result = await api.validateDemoCode(code);

if (result.valid) {
  // Store for next page
  sessionStorage.setItem('demoCodeId', result.codeId);
  sessionStorage.setItem('demoLabel', result.label);
  sessionStorage.setItem('demoPersonas', JSON.stringify(result.personas));
  navigate('/demo/personas');
} else {
  toast({
    title: result.message || 'Invalid Demo Code',
    variant: 'destructive',
  });
}
```

### 2. DemoPersonaSelect.tsx

Updated to use dynamic personas:

```typescript
const personas = JSON.parse(sessionStorage.getItem('demoPersonas') || '[]');

const handlePersonaClick = async (userId: string) => {
  setIsLoading(true);
  try {
    const result = await api.loginAsDemo(userId);

    if (result.success) {
      // Clear session storage
      sessionStorage.clear();

      // Redirect to dashboard
      navigate('/dashboard');
    }
  } catch (error) {
    toast({ title: 'Login failed', variant: 'destructive' });
  } finally {
    setIsLoading(false);
  }
};
```

### 3. DemoBanner Component

**Decision: Do we show a demo banner?**

**Option A: No banner** (Recommended)
- Demo behaves identically to real
- Users don't know they're in demo
- More realistic experience

**Option B: Subtle banner**
- Small indicator "Demo Mode" in corner
- Can hide after 5 seconds
- Exit button to return to code entry

I recommend **Option A** - no banner. Demo users should experience it as if it's real.

---

## Storage Layer Methods

```typescript
// server/storage.ts

interface IStorage {
  // ... existing methods

  // Demo Codes
  getDemoCode(id: string): Promise<DemoCode | undefined>;
  getDemoCodeByCode(code: string): Promise<DemoCode | undefined>;
  listDemoCodes(): Promise<DemoCode[]>;
  createDemoCode(code: InsertDemoCode): Promise<DemoCode>;
  updateDemoCode(id: string, updates: Partial<InsertDemoCode>): Promise<DemoCode>;
  deleteDemoCode(id: string): Promise<void>; // Cascade deletes all demo data!
  incrementDemoCodeUsage(id: string): Promise<void>;

  // Demo Users
  getDemoUsersByCodeId(codeId: string): Promise<User[]>;

  // Demo Sessions
  createDemoSession(session: InsertDemoSession): Promise<DemoSession>;
  getDemoSessionStats(codeId: string): Promise<any>;
}

class DbStorage implements IStorage {
  // ... existing methods

  async getDemoCode(id: string): Promise<DemoCode | undefined> {
    const [code] = await db.select().from(demoCodes).where(eq(demoCodes.id, id));
    return code;
  }

  async getDemoCodeByCode(code: string): Promise<DemoCode | undefined> {
    const [demoCode] = await db.select().from(demoCodes).where(eq(demoCodes.code, code));
    return demoCode;
  }

  async createDemoCode(data: InsertDemoCode): Promise<DemoCode> {
    const [code] = await db.insert(demoCodes).values(data).returning();
    return code;
  }

  async updateDemoCode(id: string, updates: Partial<InsertDemoCode>): Promise<DemoCode> {
    const [code] = await db
      .update(demoCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(demoCodes.id, id))
      .returning();
    return code;
  }

  async deleteDemoCode(id: string): Promise<void> {
    // Cascade delete handles all related data automatically!
    await db.delete(demoCodes).where(eq(demoCodes.id, id));
  }

  async incrementDemoCodeUsage(id: string): Promise<void> {
    await db
      .update(demoCodes)
      .set({ currentUses: sql`${demoCodes.currentUses} + 1` })
      .where(eq(demoCodes.id, id));
  }

  async getDemoUsersByCodeId(codeId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.demoCodeId, codeId));
  }

  async createDemoSession(data: InsertDemoSession): Promise<DemoSession> {
    const [session] = await db.insert(demoSessions).values(data).returning();
    return session;
  }
}
```

---

## Purge Script

### Automated Cleanup

```typescript
// server/purgeExpiredDemos.ts

import { storage } from './storage';
import { demoCodes } from '@shared/schema';

export async function purgeExpiredDemos() {
  console.log('🧹 Starting demo ecosystem purge...');

  const now = new Date();

  // Find all expired demo codes
  const expiredCodes = await db
    .select()
    .from(demoCodes)
    .where(lt(demoCodes.validUntil, now));

  console.log(`Found ${expiredCodes.length} expired demo codes`);

  for (const code of expiredCodes) {
    try {
      console.log(`Deleting demo ecosystem for code: ${code.code}`);

      // This ONE delete cascades to all related tables!
      await storage.deleteDemoCode(code.id);

      console.log(`✅ Deleted demo code: ${code.code}`);
    } catch (error) {
      console.error(`❌ Failed to delete demo code ${code.code}:`, error);
    }
  }

  console.log('🎉 Purge complete!');
}

// Run as cron job or manual script
if (require.main === module) {
  purgeExpiredDemos()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
```

### Manual Purge Command

```bash
# package.json
"scripts": {
  "demo:purge": "tsx server/purgeExpiredDemos.ts"
}
```

### Scheduled Purge (Production)

Add to deployment:
- **Replit:** Use Replit Cron jobs (beta feature)
- **Vercel/Netlify:** Use scheduled functions
- **Manual:** Run daily via cron: `0 2 * * * cd /app && npm run demo:purge`

---

## Admin UI: Demo Code Management

### Admin Page Component

```typescript
// client/src/pages/admin/DemoCodes.tsx

export default function AdminDemoCodes() {
  const { data: demoCodes, isLoading } = useQuery({
    queryKey: ['admin', 'demoCodes'],
    queryFn: () => api.listDemoCodes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDemoCodeInput) => api.createDemoCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'demoCodes']);
      toast({ title: 'Demo code created and provisioning...' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDemoCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'demoCodes']);
      toast({ title: 'Demo ecosystem deleted' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Demo Code Management</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          Create New Demo Code
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Valid From</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {demoCodes?.map((code) => (
            <TableRow key={code.id}>
              <TableCell className="font-mono">{code.code}</TableCell>
              <TableCell>{code.label}</TableCell>
              <TableCell>{format(new Date(code.validFrom), 'MMM d, yyyy')}</TableCell>
              <TableCell>{format(new Date(code.validUntil), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                {code.currentUses} {code.maxUses ? `/ ${code.maxUses}` : ''}
              </TableCell>
              <TableCell>
                {code.isProvisioned ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="secondary">Provisioning...</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(code.id)}
                >
                  Delete Ecosystem
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        {/* Form for creating demo code */}
      </Dialog>
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Database Schema (Day 1)
- [ ] Add `demoCodeId` to all main tables
- [ ] Create `demoCodes` table
- [ ] Create `demoSessions` table (optional)
- [ ] Run `npm run db:push`
- [ ] Test cascade deletes manually

### Phase 2: Provisioning Logic (Day 1-2)
- [ ] Create `provision.ts` with ecosystem provisioning
- [ ] Create helper functions for sample data generation
- [ ] Implement storage layer methods for demo codes
- [ ] Test provisioning manually
- [ ] Verify data isolation (query by demoCodeId)

### Phase 3: API Endpoints (Day 2)
- [ ] POST /api/admin/demo-codes (create + provision)
- [ ] POST /api/demo/validate-code
- [ ] POST /api/demo/login
- [ ] GET /api/admin/demo-codes (list)
- [ ] DELETE /api/admin/demo-codes/:id
- [ ] Test with Postman

### Phase 4: Frontend (Day 3)
- [ ] Create DemoCodeEntry page
- [ ] Create DemoPersonaSelect page
- [ ] Update Landing with "View Demo" button
- [ ] Add routing
- [ ] Test full flow

### Phase 5: Admin UI (Day 4)
- [ ] Create AdminDemoCodes page
- [ ] Create form dialog
- [ ] Show usage stats
- [ ] Add to admin nav
- [ ] Test creating/deleting codes

### Phase 6: Cleanup & Polish (Day 5)
- [ ] Create purge script
- [ ] Test purge script
- [ ] Add loading states
- [ ] Error handling
- [ ] Documentation
- [ ] Setup cron job for purge

---

## Security & Safety

### Cascade Delete Safety
✅ **Safe:** Foreign key with `onDelete: cascade` ensures:
- When demo code deleted, ALL related data auto-deleted
- Atomic operation - all or nothing
- No orphaned records
- No risk to production data (different demoCodeId or null)

### Production Data Protection
✅ **Protected:** Production data has `demoCodeId = null`
- Queries for demo data: `WHERE demoCodeId = 'xyz'`
- Queries for production: `WHERE demoCodeId IS NULL`
- Deletes only affect matching demoCodeId
- Impossible to accidentally delete production data

### Demo Code Security
- Codes should be non-guessable (use UUIDs or strong random)
- Rate limit code validation (10 attempts per IP per hour)
- Track usage for abuse detection
- Can deactivate code immediately if leaked

---

## Benefits of This Architecture

### ✅ Zero Behavioral Differences
- Demo users are real users in database
- No special demo authentication
- No "if demo" branches in code
- Same UI, same features, same workflows

### ✅ Complete Isolation
- Each demo code has own ecosystem
- No data sharing between demos
- No data sharing with production
- Demo users can't see real users' data

### ✅ Safe Cleanup
- One delete cascades to all related data
- Impossible to delete production data
- Atomic operation (all or nothing)
- Can purge expired demos automatically

### ✅ Fully Functional
- Demo users can create, edit, delete
- Form submissions save to database
- Application workflows work identically
- Most realistic demo experience

### ✅ Analytics Ready
- Track demo code usage
- Track session duration
- Track which features used
- Measure conversion from demo to signup

---

## Open Questions

1. **Subdomain strategy for demos?**
   - Current: Unique subdomain per code (e.g., `markland-abc123.poassociation.com`)
   - Alternative: All demos use same subdomain, isolated by session
   - Recommendation?

2. **Demo banner?**
   - Show small "Demo Mode" indicator?
   - Or completely hide demo status for realism?
   - Lean toward hiding it

3. **Form schemas?**
   - Use existing MARKLAND_STRUCTURAL_SCHEMA
   - Create 2-3 additional simpler form schemas?
   - How complex should demo forms be?

4. **Application quantity?**
   - Current: 30 sample applications per ecosystem
   - Too many? Too few?
   - Should vary by tenant?

Ready to start implementing? Should I begin with Phase 1: Database Schema?
