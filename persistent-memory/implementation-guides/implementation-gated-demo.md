# Implementation: Gated Demo with Access Codes

**Feature:** Scheduled demo access with code-gated entry
**Started:** 2025-11-21
**Status:** Design phase

---

## Requirements Summary

### User Flow
```
Landing Page
    ↓ [View Demo]
Demo Code Entry Page (marketing splash)
    ↓ Enter code + validate
Persona Selection Page
    ↓ Click persona
Dashboard as Demo User (management/board/resident/contributor)
```

### Key Features
- ✅ Real users go through Replit Auth (existing)
- ✅ Demo accessed via valid demo code
- ✅ Demo codes stored in database
- ✅ Demo codes can be scheduled (validFrom/validUntil)
- ✅ Multiple demo codes can be active simultaneously
- ✅ Super admin can create/manage demo codes
- ✅ 4 demo personas: Manager, Board Member, Resident, Contributor
- ✅ One-click login to demo persona (no auth required after code entry)

---

## Database Schema

### New Table: `demoCodes`

```typescript
// shared/schema.ts
export const demoCodes = pgTable('demo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // e.g., "DEMO-NOV-2025"
  label: text('label').notNull(), // e.g., "November Conference Demo"
  validFrom: timestamp('valid_from').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  maxUses: integer('max_uses'), // null = unlimited
  currentUses: integer('current_uses').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type DemoCode = typeof demoCodes.$inferSelect;
export type InsertDemoCode = typeof demoCodes.$inferInsert;
```

### New Table: `demoSessions`

Track who's using demo mode for analytics:

```typescript
export const demoSessions = pgTable('demo_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  demoCodeId: uuid('demo_code_id').references(() => demoCodes.id),
  demoUserId: uuid('demo_user_id').references(() => users.id),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export type DemoSession = typeof demoSessions.$inferSelect;
```

### Update `users` Table

Add flag to mark demo users:

```typescript
// Add to existing users table
export const users = pgTable('users', {
  // ... existing fields
  isDemo: boolean('is_demo').notNull().default(false),
  demoPersona: text('demo_persona'), // 'manager' | 'board' | 'resident' | 'contributor'
});
```

---

## Demo User Ecosystem

### 4 Demo Users

```typescript
// Demo personas to seed
const DEMO_USERS = [
  {
    id: 'demo-user-manager',
    email: 'demo-manager@poassociation.com',
    firstName: 'Emily',
    lastName: 'Foster',
    isDemo: true,
    demoPersona: 'manager',
    profileImageUrl: '/demo-avatars/emily.jpg',
  },
  {
    id: 'demo-user-board',
    email: 'demo-board@poassociation.com',
    firstName: 'Sarah',
    lastName: 'Chen',
    isDemo: true,
    demoPersona: 'board',
    profileImageUrl: '/demo-avatars/sarah.jpg',
  },
  {
    id: 'demo-user-resident',
    email: 'demo-resident@poassociation.com',
    firstName: 'James',
    lastName: 'Martinez',
    isDemo: true,
    demoPersona: 'resident',
    profileImageUrl: '/demo-avatars/james.jpg',
  },
  {
    id: 'demo-user-contributor',
    email: 'demo-contributor@poassociation.com',
    firstName: 'Alex',
    lastName: 'Rivera',
    isDemo: true,
    demoPersona: 'contributor',
    profileImageUrl: '/demo-avatars/alex.jpg',
  },
];
```

### Demo User Role Assignments

```typescript
// userTenantRoles assignments
const DEMO_ROLES = [
  // Emily (Manager) - has access to Apex Management + all communities
  { userId: 'demo-user-manager', tenantId: 'apex-mgmt', role: 'management_manager' },
  { userId: 'demo-user-manager', tenantId: 'markland-poa', role: 'management_rep' },
  { userId: 'demo-user-manager', tenantId: 'whispering-pines', role: 'management_rep' },

  // Sarah (Board Member) - board member at Markland
  { userId: 'demo-user-board', tenantId: 'markland-poa', role: 'poa_board_member' },

  // James (Resident) - homeowner at Whispering Pines
  { userId: 'demo-user-resident', tenantId: 'whispering-pines', role: 'homeowner' },

  // Alex (Contributor) - non-voting board contributor at Markland
  { userId: 'demo-user-contributor', tenantId: 'markland-poa', role: 'poa_board_contributor' },
];
```

### Demo Ecosystem Data

Re-use existing seed data, but add:
- **30+ sample applications** in various states
- **Multiple form templates** per community
- **Sample properties** for context
- **Realistic submission dates** (last 90 days)

---

## API Endpoints

### 1. Validate Demo Code

```typescript
POST /api/demo/validate-code
Body: { code: string }
Response: { valid: boolean, codeId?: string, label?: string }

// Implementation
app.post('/api/demo/validate-code', async (req, res) => {
  const { code } = req.body;

  const demoCode = await storage.getDemoCodeByCode(code);

  if (!demoCode) {
    return res.json({ valid: false });
  }

  // Check if active
  if (!demoCode.isActive) {
    return res.json({ valid: false });
  }

  // Check date range
  const now = new Date();
  if (now < new Date(demoCode.validFrom) || now > new Date(demoCode.validUntil)) {
    return res.json({ valid: false });
  }

  // Check usage limit
  if (demoCode.maxUses && demoCode.currentUses >= demoCode.maxUses) {
    return res.json({ valid: false });
  }

  res.json({
    valid: true,
    codeId: demoCode.id,
    label: demoCode.label
  });
});
```

### 2. Start Demo Session

```typescript
POST /api/demo/start-session
Body: { codeId: string, persona: 'manager' | 'board' | 'resident' | 'contributor' }
Response: { success: boolean, user: User, sessionId: string }

// Implementation
app.post('/api/demo/start-session', async (req, res) => {
  const { codeId, persona } = req.body;

  // Get demo code and validate again
  const demoCode = await storage.getDemoCode(codeId);
  if (!demoCode || !demoCode.isActive) {
    return res.status(400).json({ error: 'Invalid demo code' });
  }

  // Get demo user for persona
  const demoUser = await storage.getDemoUserByPersona(persona);
  if (!demoUser) {
    return res.status(400).json({ error: 'Invalid persona' });
  }

  // Create demo session record
  const demoSession = await storage.createDemoSession({
    demoCodeId: codeId,
    demoUserId: demoUser.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Increment demo code usage
  await storage.incrementDemoCodeUsage(codeId);

  // Create session (same as Replit auth)
  req.session.userId = demoUser.id;
  req.session.isDemoMode = true;
  req.session.demoSessionId = demoSession.id;

  res.json({
    success: true,
    user: demoUser,
    sessionId: demoSession.id
  });
});
```

### 3. End Demo Session

```typescript
POST /api/demo/end-session
Response: { success: boolean }

// Implementation
app.post('/api/demo/end-session', isAuthenticated, async (req, res) => {
  if (!req.session.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  // Update demo session end time
  await storage.endDemoSession(req.session.demoSessionId);

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to end session' });
    }
    res.json({ success: true });
  });
});
```

### 4. Get Current User (Updated)

```typescript
GET /api/auth/user

// Updated to handle demo users
app.get('/api/auth/user', async (req, res) => {
  // Demo mode
  if (req.session.isDemoMode && req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    return res.json({
      ...user,
      isDemoMode: true,
      demoSessionId: req.session.demoSessionId,
    });
  }

  // Regular Replit auth
  if (!req.user?.claims?.sub) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  res.json(user);
});
```

### 5. Admin: Manage Demo Codes

```typescript
// List all demo codes
GET /api/admin/demo-codes
Middleware: isAuthenticated, requireRole(['super_admin'])

// Create demo code
POST /api/admin/demo-codes
Body: { code, label, validFrom, validUntil, maxUses? }
Middleware: isAuthenticated, requireRole(['super_admin'])

// Update demo code
PATCH /api/admin/demo-codes/:id
Body: { isActive?, maxUses?, validUntil? }
Middleware: isAuthenticated, requireRole(['super_admin'])

// Delete demo code
DELETE /api/admin/demo-codes/:id
Middleware: isAuthenticated, requireRole(['super_admin'])

// Get demo code usage stats
GET /api/admin/demo-codes/:id/stats
Response: { code, currentUses, maxUses, activeSessions, totalSessions }
```

---

## Frontend Components

### 1. DemoCodeEntry.tsx

**Route:** `/demo`
**Purpose:** Splash page with demo code entry

```typescript
// client/src/pages/DemoCodeEntry.tsx
import { useState } from 'react';
import { useNavigate } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

export default function DemoCodeEntry() {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast({ title: 'Please enter a demo code', variant: 'destructive' });
      return;
    }

    setIsValidating(true);
    try {
      const result = await api.validateDemoCode(code.trim().toUpperCase());

      if (result.valid) {
        // Store code ID in sessionStorage
        sessionStorage.setItem('demoCodeId', result.codeId);
        sessionStorage.setItem('demoLabel', result.label);
        navigate('/demo/personas');
      } else {
        toast({
          title: 'Invalid Demo Code',
          description: 'Please check your code and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <img src={logoImage} className="w-20 h-20 rounded-lg" alt="POA Association" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">
            Welcome to POA Association
          </CardTitle>
          <CardDescription className="text-lg">
            Experience the future of community management
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Marketing Content */}
          <div className="bg-primary/5 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Smart Application Management</h3>
                <p className="text-sm text-muted-foreground">
                  Streamline architectural reviews with AI-powered forms and inline bylaw guidance
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Multi-Tenant Architecture</h3>
                <p className="text-sm text-muted-foreground">
                  Manage multiple communities with role-based access and isolated data
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Complete Workflow</h3>
                <p className="text-sm text-muted-foreground">
                  From submission to approval, track every step of your community's processes
                </p>
              </div>
            </div>
          </div>

          {/* Demo Code Entry */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter Demo Access Code</label>
              <Input
                type="text"
                placeholder="DEMO-CODE-HERE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground text-center">
                Demo codes are provided during conferences, webinars, and trial periods
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isValidating || !code.trim()}
            >
              {isValidating ? (
                'Validating...'
              ) : (
                <>
                  Access Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Looking for a full account?
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. DemoPersonaSelect.tsx

**Route:** `/demo/personas`
**Purpose:** Select which demo persona to experience

```typescript
// client/src/pages/DemoPersonaSelect.tsx
import { useState } from 'react';
import { useNavigate } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, ShieldCheck, Home, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

const PERSONAS = [
  {
    id: 'manager',
    name: 'Emily Foster',
    title: 'Management Company Manager',
    icon: Building,
    description: 'Oversee multiple communities, manage form templates, and coordinate with board members',
    features: [
      'Multi-community dashboard',
      'Form template creation',
      'User role management',
      'Analytics and reporting',
    ],
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    id: 'board',
    name: 'Sarah Chen',
    title: 'POA Board Member',
    icon: ShieldCheck,
    description: 'Review applications, approve modifications, and maintain community standards',
    features: [
      'Application review queue',
      'Approve/reject workflows',
      'Inline bylaw guidance',
      'Comment and request changes',
    ],
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    id: 'resident',
    name: 'James Martinez',
    title: 'Homeowner / Resident',
    icon: Home,
    description: 'Submit applications for property modifications and track approval status',
    features: [
      'Submit modification requests',
      'Track application status',
      'View community guidelines',
      'Upload supporting documents',
    ],
    gradient: 'from-green-500 to-green-600',
  },
  {
    id: 'contributor',
    name: 'Alex Rivera',
    title: 'ARC Committee Member',
    icon: Users,
    description: 'Participate in reviews, add comments, but without voting rights',
    features: [
      'View pending applications',
      'Add review comments',
      'Provide feedback',
      'Collaborate with board',
    ],
    gradient: 'from-orange-500 to-orange-600',
  },
];

export default function DemoPersonaSelect() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePersonaClick = async (personaId: string) => {
    const codeId = sessionStorage.getItem('demoCodeId');
    const demoLabel = sessionStorage.getItem('demoLabel');

    if (!codeId) {
      toast({
        title: 'Session Expired',
        description: 'Please enter your demo code again.',
        variant: 'destructive',
      });
      navigate('/demo');
      return;
    }

    setSelectedPersona(personaId);
    setIsLoading(true);

    try {
      const result = await api.startDemoSession(codeId, personaId);

      if (result.success) {
        toast({
          title: `Welcome, ${result.user.firstName}!`,
          description: `Logged in as ${PERSONAS.find(p => p.id === personaId)?.title}`,
        });

        // Clear demo code from storage
        sessionStorage.removeItem('demoCodeId');
        sessionStorage.removeItem('demoLabel');

        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start demo session. Please try again.',
        variant: 'destructive',
      });
      setSelectedPersona(null);
    } finally {
      setIsLoading(false);
    }
  };

  const demoLabel = sessionStorage.getItem('demoLabel');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} className="w-16 h-16 rounded-lg" alt="POA Association" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Choose Your Perspective</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience POA Association from different roles. Each persona shows unique features and workflows.
          </p>
          {demoLabel && (
            <p className="text-sm text-primary font-medium">
              Demo Access: {demoLabel}
            </p>
          )}
        </div>

        {/* Persona Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isSelected = selectedPersona === persona.id;
            const isDisabled = isLoading && !isSelected;

            return (
              <Card
                key={persona.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isDisabled ? 'opacity-50' : ''}`}
                onClick={() => !isLoading && handlePersonaClick(persona.id)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${persona.gradient} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{persona.name}</CardTitle>
                      <CardDescription className="text-base">
                        {persona.title}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {persona.description}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      What You'll Experience:
                    </p>
                    <ul className="space-y-1">
                      {persona.features.map((feature, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className="w-full"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={isLoading}
                  >
                    {isLoading && isSelected ? 'Loading...' : `Login as ${persona.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <Button variant="ghost" onClick={() => navigate('/demo')}>
            ← Back to Demo Code Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Update Landing.tsx

Add "View Demo" button:

```typescript
// client/src/pages/Landing.tsx
// Add to existing landing page

<div className="flex gap-4 justify-center">
  <Button size="lg" onClick={() => window.location.href = '/api/login'}>
    Login with Replit
  </Button>
  <Button size="lg" variant="outline" onClick={() => navigate('/demo')}>
    View Demo
  </Button>
</div>
```

### 4. DemoBanner Component

Show banner when in demo mode:

```typescript
// client/src/components/DemoBanner.tsx
import { AlertCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useNavigate } from 'wouter';

export function DemoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.isDemoMode) return null;

  const handleExitDemo = async () => {
    await api.endDemoSession();
    navigate('/');
  };

  const personaName = {
    manager: 'Management Manager',
    board: 'Board Member',
    resident: 'Homeowner',
    contributor: 'ARC Committee Member',
  }[user.demoPersona || ''] || 'Demo User';

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>
          Demo Mode Active • Viewing as: {user.firstName} {user.lastName} ({personaName})
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExitDemo}
        className="h-auto py-1 hover:bg-amber-600"
      >
        Exit Demo
        <X className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
```

Add to DashboardLayout:

```typescript
// client/src/components/layout/DashboardLayout.tsx
import { DemoBanner } from '@/components/DemoBanner';

return (
  <div className="flex min-h-screen w-full flex-col">
    <DemoBanner />
    {/* ... rest of layout */}
  </div>
);
```

---

## Storage Layer Methods

```typescript
// server/storage.ts - Add these methods to IStorage and DbStorage

interface IStorage {
  // ... existing methods

  // Demo Codes
  getDemoCode(id: string): Promise<DemoCode | undefined>;
  getDemoCodeByCode(code: string): Promise<DemoCode | undefined>;
  listDemoCodes(): Promise<DemoCode[]>;
  createDemoCode(code: InsertDemoCode): Promise<DemoCode>;
  updateDemoCode(id: string, updates: Partial<InsertDemoCode>): Promise<DemoCode>;
  deleteDemoCode(id: string): Promise<void>;
  incrementDemoCodeUsage(id: string): Promise<void>;

  // Demo Users
  getDemoUserByPersona(persona: string): Promise<User | undefined>;

  // Demo Sessions
  createDemoSession(session: InsertDemoSession): Promise<DemoSession>;
  endDemoSession(id: string): Promise<void>;
  getDemoSessionStats(codeId: string): Promise<any>;
}
```

---

## API Client Methods

```typescript
// client/src/lib/api.ts

class ApiClient {
  // ... existing methods

  async validateDemoCode(code: string): Promise<{ valid: boolean; codeId?: string; label?: string }> {
    const response = await fetch(`${this.baseUrl}/demo/validate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error('Failed to validate demo code');
    return response.json();
  }

  async startDemoSession(codeId: string, persona: string): Promise<{ success: boolean; user: any; sessionId: string }> {
    const response = await fetch(`${this.baseUrl}/demo/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, persona }),
    });
    if (!response.ok) throw new Error('Failed to start demo session');
    return response.json();
  }

  async endDemoSession(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/demo/end-session`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to end demo session');
    return response.json();
  }
}
```

---

## Routing Updates

```typescript
// client/src/App.tsx

<Switch>
  {/* Demo routes - accessible without auth */}
  <Route path="/demo" component={DemoCodeEntry} />
  <Route path="/demo/personas" component={DemoPersonaSelect} />

  {/* Regular auth flow */}
  {isLoading || !isAuthenticated ? (
    <Route path="/" component={Landing} />
  ) : (
    <>
      {/* ... authenticated routes */}
    </>
  )}
</Switch>
```

---

## Implementation Phases

### Phase 1: Database & Backend (Day 1-2)
- [ ] Add demoCodes table to schema
- [ ] Add demoSessions table to schema
- [ ] Add isDemo/demoPersona to users table
- [ ] Run db:push to apply schema
- [ ] Implement storage layer methods
- [ ] Create demo validation endpoint
- [ ] Create demo session endpoints
- [ ] Update auth endpoint to handle demo users

### Phase 2: Demo Seed Data (Day 2)
- [ ] Create seedDemo.ts script
- [ ] Seed 4 demo users
- [ ] Assign demo user roles
- [ ] Create 30+ sample applications
- [ ] Create realistic dates and statuses
- [ ] Test demo user login manually

### Phase 3: Frontend Pages (Day 3-4)
- [ ] Create DemoCodeEntry component
- [ ] Create DemoPersonaSelect component
- [ ] Update Landing page with "View Demo" button
- [ ] Add routing for /demo and /demo/personas
- [ ] Create DemoBanner component
- [ ] Test full demo flow

### Phase 4: Admin UI (Day 4-5)
- [ ] Create AdminDemoCodes page
- [ ] Create DemoCodeForm for add/edit
- [ ] Show demo code usage stats
- [ ] Add to admin navigation
- [ ] Test creating/deleting codes

### Phase 5: Polish & Testing (Day 5)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test expiring codes
- [ ] Test max usage limits
- [ ] Test multiple active codes
- [ ] Add analytics tracking

---

## Security Considerations

### Demo User Data Isolation
**Problem:** Multiple people using same demo accounts will overwrite each other's data

**Solutions:**

**Option 1: Read-Only Demo (Recommended)**
- Demo users can view everything
- Form submissions show success toast but don't save
- "In demo mode, changes are simulated" message
- Periodic data reset (nightly)

**Option 2: Ephemeral Demo Data**
- Each demo session creates temporary copy of data
- Shown only to that session
- Deleted after session ends
- More complex but more realistic

**Option 3: Demo Data Reset**
- Demo users have real write access
- Cron job resets demo data every night
- Each morning, fresh demo environment
- Simple but requires cleanup logic

**Recommendation:** Start with Option 1, upgrade to Option 3 if needed.

### Session Security
- Demo sessions expire after 2 hours of inactivity
- IP address logged for abuse prevention
- Rate limit demo code validation (10 attempts per IP per hour)
- Monitor for suspicious usage patterns

### Demo Code Security
- Codes should be non-guessable (e.g., UUID or strong random string)
- Codes shown only to authorized admins
- Usage tracking to detect sharing/leaks
- Ability to deactivate code immediately

---

## Analytics & Monitoring

### Track Demo Usage
- Code redemptions over time
- Which personas are most popular
- Average demo session duration
- Drop-off points in demo flow
- Conversion from demo to signup

### Admin Dashboard
- Active demo sessions count
- Most used demo codes
- Demo code effectiveness
- Demo user activity heatmap

---

## Next Steps

1. **Review this design** - Any changes needed?
2. **Start with Phase 1** - Database schema and backend
3. **Seed demo data** - Create realistic demo ecosystem
4. **Build frontend** - Demo code entry and persona selection
5. **Add admin UI** - Demo code management

Should we proceed with Phase 1?
