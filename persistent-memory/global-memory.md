# Global Memory - POA Association Application

**Purpose:** This document captures reusable patterns, conventions, testing requirements, and general application knowledge that should be referenced across all sessions.

---

## Application Overview

**Name:** POA Association
**Domain:** poassociation.com
**Type:** Multi-tenant SaaS platform for community management, architectural review boards (ARB), and homeowner associations (HOA)
**Architecture:** Full-stack TypeScript monorepo with client/server/shared separation

### Core Value Proposition
- Dynamic form builder with AI-powered generation
- Multi-tenant architecture with subdomain-based isolation
- Role-based access control for community management
- Architectural review board application workflows
- Inline compliance guidance with bylaws and regulations

---

## Tech Stack Reference

### Frontend
- **Framework:** React 19.2.0 with TypeScript 5.6.3
- **Build Tool:** Vite 7.1.9
- **Routing:** Wouter 3.3.5 (lightweight React Router alternative)
- **State Management:**
  - Server state: TanStack React Query 5.60.5
  - Client state: Zustand 5.0.8 with localStorage persistence
  - Form state: React Hook Form 7.66.0
- **Styling:** Tailwind CSS 4.1.14 + shadcn/ui (New York variant)
- **UI Components:** Radix UI (20+ packages) + 55 shadcn/ui components
- **Validation:** Zod 3.25.76
- **Icons:** Lucide React
- **Animations:** Framer Motion 12.23.24

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express 4.21.2 with TypeScript
- **Database:** Neon Serverless PostgreSQL 16
- **ORM:** Drizzle ORM 0.39.1 with drizzle-kit 0.31.4
- **Session:** Express Session + connect-pg-simple (PostgreSQL store)
- **Auth (configured but not active):** Passport.js + Passport Local

### Development
- **Execution:** tsx 4.20.5 (TypeScript execution)
- **Bundling:** esbuild 0.25.0
- **Platform:** Replit with autoscale deployment

---

## Code Patterns & Conventions

### 1. Import Aliases
Always use configured path aliases for cleaner imports:

```typescript
import { Button } from '@/components/ui/button';        // client/src/
import { users } from '@shared/schema';                  // shared/
import logo from '@assets/generated_images/logo.png';   // attached_assets/
```

**Configuration locations:** `vite.config.ts`, `tsconfig.json`, `components.json`

### 2. Shared Schema Pattern
**CRITICAL:** Database schema is the single source of truth.

```typescript
// ✅ CORRECT: Define schema once in shared/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ✅ Use inferred types everywhere
import { users } from '@shared/schema';
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;

// ❌ WRONG: Don't duplicate types
type User = { id: string; email: string; name: string }; // NO!
```

**Benefits:**
- No type drift between client/server
- Automatic Zod schema generation
- Type-safe queries with Drizzle
- Single location for schema changes

### 3. Repository Pattern
All database access goes through the `IStorage` interface.

```typescript
// ✅ CORRECT: Use storage layer
import { storage } from '@/storage';
const user = await storage.getUserById(userId);

// ❌ WRONG: Don't query database directly from routes
const user = await db.select().from(users).where(eq(users.id, userId));
```

**Storage class location:** `server/storage.ts` (189 lines)
**Interface:** `IStorage` defines all data operations

**Benefits:**
- Easy to mock for testing
- Consistent error handling
- Abstraction from ORM details
- Swappable implementations

### 4. API Client Pattern
Frontend always uses the API client, never direct fetch.

```typescript
// ✅ CORRECT: Use API client
import { api } from '@/lib/api';
const forms = await api.getFormsByTenant(tenantId);

// ❌ WRONG: Don't use fetch directly
const response = await fetch(`/api/tenants/${tenantId}/forms`);
```

**API client location:** `client/src/lib/api.ts` (110 lines)
**Class:** `ApiClient` with typed methods

**Benefits:**
- Type safety for requests/responses
- Centralized error handling
- Easy to mock for testing
- Single place to add auth headers

### 5. Form Schema as Data
Forms are JSON schemas stored in database, not code.

```typescript
// Form schema structure
{
  title: string;
  description: string;
  relevantBylaws?: string[];
  sections: [
    {
      id: string;
      title: string;
      description?: string;
      fields: [
        {
          id: string;
          type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'file';
          label: string;
          options?: string[];        // For select/radio/checkbox
          placeholder?: string;
          description?: string;
          required?: boolean;
          relevantBylaws?: string[]; // Inline compliance guidance
        }
      ]
    }
  ]
}
```

**Key component:** `DynamicForm` (`client/src/components/DynamicForm.tsx`)
**Storage:** `formTemplates` table with JSONB schema column

**Benefits:**
- Runtime form creation without deployments
- Versioning via updatedAt timestamp
- Soft deletes via isActive flag
- Inline bylaws/regulations guidance

### 6. Multi-Tenant Context
Current tenant stored in Zustand with localStorage persistence.

```typescript
// ✅ CORRECT: Access current tenant via store
import { useStore } from '@/lib/store';

function MyComponent() {
  const currentTenant = useStore((state) => state.currentTenant);
  const setCurrentTenant = useStore((state) => state.setCurrentTenant);
  // Use tenant context...
}
```

**Store location:** `client/src/lib/store.ts`
**Persistence key:** `civicflow-state`
**State includes:** currentTenant, currentRole

**Pattern notes:**
- Subdomain switching is currently simulated (UI only)
- Future: implement actual subdomain routing
- Tenant context passed to all API calls

### 7. Validation Pattern
Zod schemas validate at API boundaries.

```typescript
// ✅ CORRECT: Validate with Zod at route entry
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const createFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  schema: z.object({}).passthrough(),
});

app.post('/api/forms', async (req, res) => {
  try {
    const validated = createFormSchema.parse(req.body);
    // Proceed with validated data...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: fromZodError(error).toString()
      });
    }
    throw error;
  }
});
```

**Benefits:**
- User-friendly error messages via `fromZodError`
- Runtime type safety
- Self-documenting API contracts

### 8. Component Patterns

#### Page Components
```typescript
// Default export, functional component, proper layout wrapping
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function MyPage() {
  return (
    <DashboardLayout title="Page Title">
      {/* Page content */}
    </DashboardLayout>
  );
}
```

#### UI Components (shadcn/ui convention)
```typescript
// Named export, forwardRef for Radix compatibility, CVA for variants
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('base-classes', {
  variants: {
    variant: { default: '...', destructive: '...' },
    size: { default: '...', sm: '...', lg: '...' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
```

#### Custom Hooks
```typescript
// Use prefix, return object or array based on convention
export function useFormSubmission(formId: string) {
  const { mutate, isPending } = useMutation({
    mutationFn: (data) => api.submitApplication(data),
    onSuccess: () => {
      toast.success('Application submitted!');
    },
  });

  return { submit: mutate, isSubmitting: isPending };
}
```

### 9. Styling Conventions

#### Tailwind Utility Classes
```typescript
// ✅ CORRECT: Use utility classes, not custom CSS
<div className="flex items-center gap-4 p-6 bg-background text-foreground">

// ✅ Use cn() for conditional classes
import { cn } from '@/lib/utils';
<div className={cn('base-classes', isActive && 'active-classes')}>

// ❌ WRONG: Don't write custom CSS for things Tailwind can do
<div style={{ display: 'flex', padding: '24px' }}> // NO!
```

#### CSS Variables for Theming
```typescript
// ✅ CORRECT: Use CSS variable classes
<div className="bg-primary text-primary-foreground">

// These map to CSS variables in index.css:
// --primary: 222.2 47.4% 11.2%;
// --primary-foreground: 210 40% 98%;
```

**Theme colors available:**
- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `border`, `input`, `ring`
- `sidebar-*` variants (9 total)
- `chart-*` variants (5 colors)

### 10. Error Handling Pattern

#### API Routes
```typescript
// ✅ CORRECT: Consistent error handling in routes
app.post('/api/resource', async (req, res, next) => {
  try {
    // Validation
    const validated = schema.parse(req.body);

    // Business logic
    const result = await storage.createResource(validated);

    // Success response
    res.json(result);
  } catch (error) {
    // Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: fromZodError(error).toString()
      });
    }
    // Pass to global error handler
    next(error);
  }
});
```

#### Frontend
```typescript
// ✅ CORRECT: Use toast for user-facing errors
import { toast } from 'sonner';

const { mutate } = useMutation({
  mutationFn: api.submitForm,
  onSuccess: () => {
    toast.success('Form submitted successfully!');
  },
  onError: (error) => {
    toast.error(error.message || 'Something went wrong');
  },
});
```

---

## Testing Requirements

### Current State
**Status:** ⚠️ No tests currently implemented

**Test Infrastructure:**
- ❌ No testing framework installed
- ❌ No test scripts in package.json
- ✅ Test IDs present in components (`data-testid`)
- ✅ Mock data available in `client/src/lib/mock-data.ts`

### Testing Strategy (When Implementing)

#### Recommended Stack
```json
{
  "unit/integration": "Vitest (Vite-native, fast)",
  "component": "React Testing Library + Vitest",
  "e2e": "Playwright",
  "api": "Supertest"
}
```

#### Priority Testing Areas
1. **Critical Path:**
   - Form submission flow (DynamicForm component)
   - Application status updates
   - Multi-tenant context switching

2. **Data Layer:**
   - Storage layer methods (easy to test with IStorage interface)
   - API route validation (Zod schemas)
   - Database queries (Drizzle)

3. **UI Components:**
   - DynamicForm rendering all field types
   - Inline bylaws hover cards
   - Form validation feedback

4. **Integration:**
   - API client methods
   - React Query mutations
   - Form submission to database

#### Test Data Strategy
- Use existing mock data from `client/src/lib/mock-data.ts`
- Create test database seeding script based on `server/seed.ts`
- Use IStorage interface to inject mock storage for unit tests
- Playwright fixtures for e2e test data

#### Test ID Conventions
Components already have test IDs:
```typescript
// Existing test IDs in DynamicForm
data-testid="button-save-draft"
data-testid="button-submit"
data-testid="button-back"
```

**Convention to follow:**
```typescript
data-testid="component-action"  // e.g., "form-submit", "modal-close"
data-testid="section-name"      // e.g., "applications-list"
data-testid="field-{fieldId}"   // e.g., "field-homeowner-name"
```

#### LocalStorage Keys
When persisting state, use the `poassociation-` prefix:
- `poassociation-state` - Main Zustand store persistence key

**Note:** After rebranding from CivicFlow, users may have old `civicflow-state` data in localStorage. Consider adding migration logic or instructions to clear localStorage if issues arise.

---

## Database Schema Reference

### Tables Overview
```
users (4 columns)
├─ id: UUID (PK)
├─ email: TEXT (unique)
├─ name: TEXT
└─ passwordHash: TEXT (nullable)

tenants (6 columns)
├─ id: UUID (PK)
├─ name: TEXT
├─ type: TEXT (management_company | community)
├─ subdomain: TEXT (unique)
├─ managementCompanyId: UUID (FK → tenants.id, nullable)
└─ isActive: BOOLEAN

userTenantRoles (4 columns)
├─ id: UUID (PK)
├─ userId: UUID (FK → users.id)
├─ tenantId: UUID (FK → tenants.id)
└─ role: TEXT

formTemplates (7 columns)
├─ id: UUID (PK)
├─ tenantId: UUID (FK → tenants.id)
├─ name: TEXT
├─ description: TEXT (nullable)
├─ schema: JSONB
├─ isActive: BOOLEAN
└─ updatedAt: TIMESTAMP

applications (9 columns)
├─ id: UUID (PK)
├─ tenantId: UUID (FK → tenants.id)
├─ formTemplateId: UUID (FK → formTemplates.id)
├─ submittedByUserId: UUID (FK → users.id)
├─ formData: JSONB
├─ status: TEXT (pending | under_review | approved | rejected)
├─ submittedAt: TIMESTAMP
├─ reviewedAt: TIMESTAMP (nullable)
├─ reviewedByUserId: UUID (FK → users.id, nullable)
└─ reviewNotes: TEXT (nullable)
```

### Relationships
- Tenants can have parent-child relationships (communities → management companies)
- Users ↔ Tenants: many-to-many via userTenantRoles
- Form templates belong to specific tenants
- Applications reference tenants, form templates, and users
- All foreign keys have cascade delete behavior

### Migration Strategy
- **Schema changes:** Edit `shared/schema.ts`
- **Push to database:** `npm run db:push` (Drizzle Kit)
- **Migrations folder:** Not created yet (future: `drizzle-kit generate`)

---

## API Endpoint Reference

### RESTful Conventions
- Resource-based URLs (`/api/tenants`, not `/api/getTenants`)
- Standard HTTP methods (GET, POST, PATCH, DELETE)
- Consistent response format: JSON object or `{ error: string }`
- Validation errors: 400 status with user-friendly message
- Server errors: 500 status (handled by global error handler)

### Endpoint List
```
Tenants:
  GET    /api/tenants                           → List all tenants
  GET    /api/tenants/subdomain/:subdomain      → Get tenant by subdomain
  POST   /api/tenants                           → Create new tenant

Forms:
  GET    /api/tenants/:tenantId/forms           → List forms for tenant
  POST   /api/tenants/:tenantId/forms           → Create form template
  GET    /api/forms/:id                         → Get form by ID
  PATCH  /api/forms/:id                         → Update form template

Applications:
  GET    /api/applications/:id                  → Get application by ID
  POST   /api/applications                      → Submit new application
  GET    /api/tenants/:tenantId/applications    → List tenant applications
  PATCH  /api/applications/:id/status           → Update application status

Users:
  GET    /api/users/:userId/tenants             → Get user's tenants with roles
```

### Request/Response Examples

#### Create Form Template
```typescript
POST /api/tenants/:tenantId/forms
Content-Type: application/json

{
  "name": "Structural Changes Application",
  "description": "For major modifications...",
  "schema": {
    "title": "Structural Changes",
    "sections": [...]
  }
}

Response 200:
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "Structural Changes Application",
  "schema": {...},
  "isActive": true,
  "createdAt": "2025-11-21T...",
  "updatedAt": "2025-11-21T..."
}
```

#### Submit Application
```typescript
POST /api/applications
Content-Type: application/json

{
  "tenantId": "uuid",
  "formTemplateId": "uuid",
  "submittedByUserId": "uuid",
  "formData": {
    "homeowner_name": "John Doe",
    "property_address": "123 Main St",
    ...
  }
}

Response 200:
{
  "id": "uuid",
  "status": "pending",
  "submittedAt": "2025-11-21T...",
  ...
}
```

---

## Role-Based Access Control

### Available Roles
1. `super_admin` - Platform-wide administration
2. `account_admin` - Tenant-level administration
3. `management_representative` - Management company representative
4. `management_manager` - Management company manager
5. `poa_board_member` - Community board member with voting rights
6. `poa_board_contributor` - Community board contributor (non-voting)
7. `homeowner` - Property owner
8. `delegated_representative` - Acting on behalf of homeowner

### Role Assignment Pattern
- Users can have multiple roles across multiple tenants
- Stored in `userTenantRoles` junction table
- UI role switcher demonstrates role-based UI adaptation
- Current role stored in Zustand state

### Future RBAC Implementation
When implementing actual permission checks:

```typescript
// Example permission mapping
const permissions = {
  super_admin: ['*'],
  account_admin: ['tenant:*', 'form:*', 'application:*'],
  poa_board_member: ['application:review', 'application:approve'],
  homeowner: ['application:submit', 'application:view_own'],
};

// Middleware pattern
function requireRole(roles: string[]) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

app.patch('/api/applications/:id/status',
  requireRole(['poa_board_member', 'account_admin']),
  async (req, res) => { ... }
);
```

---

## Development Workflow

### Common Tasks

#### Start Development
```bash
npm run dev
# Runs: NODE_ENV=development tsx server/index.ts
# - Starts Express server on port 5000
# - Vite dev middleware with HMR
# - TypeScript execution via tsx
```

#### Database Operations
```bash
# Push schema changes
npm run db:push

# Seed database with sample data
tsx server/seed.ts

# Future: Generate migrations
npx drizzle-kit generate
```

#### Build for Production
```bash
npm run build
# 1. Client: vite build → dist/public
# 2. Server: esbuild → dist/index.js

npm run start
# Runs: NODE_ENV=production node dist/index.js
```

### Git Workflow
- **Main branch:** `main` (current development)
- **Agent branch:** `replit-agent` (Replit-managed)
- **Backup:** `gitsafe-backup/main`

**Commit message style:**
- Present tense action: "Add feature", "Improve process", "Fix bug"
- Concise but descriptive
- Saves progress at checkpoints: "Saved progress at the end of the loop"

### File Modification Checklist

#### When Adding a New Feature
1. [ ] Define types in `shared/schema.ts` if database changes needed
2. [ ] Add storage methods to `IStorage` interface and `DbStorage` class
3. [ ] Create API routes in `server/routes.ts` with Zod validation
4. [ ] Add API client methods in `client/src/lib/api.ts`
5. [ ] Create React Query hooks or Zustand state if needed
6. [ ] Build UI components following shadcn/ui conventions
7. [ ] Add page or integrate into existing pages
8. [ ] Test manually in development
9. [ ] Update this global-memory.md if new patterns introduced

#### When Modifying Database Schema
1. [ ] Edit `shared/schema.ts`
2. [ ] Run `npm run db:push` to apply changes
3. [ ] Update seed script if needed (`server/seed.ts`)
4. [ ] Update any affected storage methods
5. [ ] Update API validations if request/response changed
6. [ ] Update TypeScript types (auto-inferred from schema)

#### When Adding UI Components
1. [ ] Use `npx shadcn@latest add <component>` for new shadcn components
2. [ ] Place custom components in appropriate directory:
   - `components/ui/` for reusable UI components
   - `components/layout/` for layout components
   - `components/` for feature-specific components
3. [ ] Follow naming conventions: PascalCase, descriptive names
4. [ ] Use `cn()` utility for className merging
5. [ ] Add `forwardRef` if component wraps Radix UI primitives
6. [ ] Export properly (named export for UI, default for pages)

---

## Configuration Reference

### Environment Variables
Required in `.env` (not committed to git):
```bash
DATABASE_URL=postgresql://...   # Neon PostgreSQL connection string
NODE_ENV=development|production # Environment flag
PORT=5000                       # Server port (optional)
```

### Path Aliases
Configured in `vite.config.ts` and `tsconfig.json`:
```
@/         → client/src/
@shared/   → shared/
@assets/   → attached_assets/
```

### Vite Configuration Highlights
- React plugin with automatic JSX runtime
- Tailwind CSS via @tailwindcss/vite plugin
- Dev server: host 0.0.0.0, strict file serving
- Build output: dist/public
- Replit plugins (development only):
  - @replit/vite-plugin-cartographer
  - @replit/vite-plugin-dev-banner
  - @replit/vite-plugin-runtime-error-modal

### TypeScript Configuration
- Strict mode enabled
- Module: ESNext with bundler resolution
- Includes: client/src, shared, server
- Skip lib check for faster compilation
- Preserve JSX (Vite transforms)
- Allow importing .ts extensions

### Tailwind Configuration
- Version 4.1.14 (latest)
- Configured via Vite plugin (no tailwind.config.js needed)
- CSS variables for theming
- Plugins: tailwindcss-animate, tw-animate-css
- Base styles in client/src/index.css

### Drizzle Configuration
- Dialect: PostgreSQL
- Schema: ./shared/schema.ts
- Out: ./migrations (not created yet)
- Connection via DATABASE_URL env variable

---

## Special Features & Innovations

### 1. Inline Bylaws Guidance
**Unique feature:** Form fields can show relevant bylaws/regulations on hover.

**Implementation:**
- Field schema includes `relevantBylaws: string[]`
- DynamicForm component renders HoverCard with bylaw text
- Helps users comply while filling forms
- Example: Markland POA form has 50+ inline guidance references

**Usage pattern:**
```typescript
{
  id: 'building_height',
  type: 'number',
  label: 'Building Height (feet)',
  required: true,
  relevantBylaws: [
    'Maximum building height shall not exceed 35 feet...',
    'Height measurement starts from finished grade...'
  ]
}
```

### 2. Simulated Subdomain Multi-Tenancy
**Current:** UI dropdown simulates subdomain switching
**Future:** Actual subdomain routing (e.g., markland.poassociation.com)

**Implementation notes:**
- Dropdown in sidebar changes currentTenant in Zustand
- Console logs show "simulated navigation"
- Tenant context included in all API calls
- Ready for actual subdomain implementation
- Domain: poassociation.com

### 3. AI Form Generation UI
**Current:** UI mockup for AI-powered form builder
**Future:** Integration with AI model for actual generation

**Location:** `client/src/pages/FormBuilder.tsx`
**Flow:**
1. User provides natural language description
2. (Future) AI generates form schema JSON
3. Preview in DynamicForm component
4. Save to formTemplates table

### 4. Form Template Versioning
**Pattern:** Track changes without breaking existing applications

**Implementation:**
- `updatedAt` timestamp on form templates
- `isActive` flag for soft deletes
- Applications store snapshot of form data (JSONB)
- Applications link to form template but aren't affected by template changes

**Benefits:**
- Audit trail for form evolution
- Historical applications remain valid
- Can restore previous versions

---

## Anti-Patterns to Avoid

### ❌ Don't Do This

1. **Direct database queries in routes**
   ```typescript
   // ❌ WRONG
   app.get('/api/users/:id', async (req, res) => {
     const user = await db.select().from(users).where(...);
   });

   // ✅ CORRECT
   app.get('/api/users/:id', async (req, res) => {
     const user = await storage.getUserById(req.params.id);
   });
   ```

2. **Duplicate type definitions**
   ```typescript
   // ❌ WRONG - defining types separately
   type User = { id: string; email: string; name: string };

   // ✅ CORRECT - infer from schema
   type User = typeof users.$inferSelect;
   ```

3. **Fetch without API client**
   ```typescript
   // ❌ WRONG
   const data = await fetch('/api/forms').then(r => r.json());

   // ✅ CORRECT
   const data = await api.getFormsByTenant(tenantId);
   ```

4. **Custom CSS for Tailwind utilities**
   ```typescript
   // ❌ WRONG
   <div style={{ display: 'flex', gap: '16px' }}>

   // ✅ CORRECT
   <div className="flex gap-4">
   ```

5. **Hardcoded tenant/role values**
   ```typescript
   // ❌ WRONG
   if (userRole === 'board_member') { ... }

   // ✅ CORRECT
   const currentRole = useStore((state) => state.currentRole);
   if (currentRole === 'poa_board_member') { ... }
   ```

6. **Skipping validation on API routes**
   ```typescript
   // ❌ WRONG - trusting client input
   app.post('/api/forms', async (req, res) => {
     const result = await storage.createForm(req.body);
   });

   // ✅ CORRECT - validate first
   app.post('/api/forms', async (req, res) => {
     const validated = createFormSchema.parse(req.body);
     const result = await storage.createForm(validated);
   });
   ```

7. **Not using React Query for server state**
   ```typescript
   // ❌ WRONG - useState for server data
   const [forms, setForms] = useState([]);
   useEffect(() => {
     api.getFormsByTenant(tenantId).then(setForms);
   }, []);

   // ✅ CORRECT - useQuery
   const { data: forms } = useQuery({
     queryKey: ['forms', tenantId],
     queryFn: () => api.getFormsByTenant(tenantId),
   });
   ```

---

## Performance Considerations

### Frontend
- **Code splitting:** Wouter supports route-based splitting (not currently implemented)
- **React Query caching:** 5-minute stale time reduces API calls
- **Zustand persistence:** LocalStorage for client state reduces re-fetching
- **Uncontrolled forms:** React Hook Form uses refs for better performance
- **Lazy loading:** Consider for large form schemas

### Backend
- **Database connection:** Neon serverless with WebSocket (efficient)
- **Query optimization:** Use Drizzle joins instead of N+1 queries
- **Session store:** PostgreSQL-backed (scales better than memory)
- **Static files:** Served directly by Express in production (Vite in dev)

### Database
- **Indexes:** Add on frequently queried columns (subdomain, email, status)
- **JSONB:** Efficient storage for form schemas, supports GIN indexes
- **UUIDs:** Distributed ID generation, no auto-increment bottleneck

---

## Security Considerations

### Current State
- ⚠️ Authentication configured but not enforced
- ⚠️ No authorization checks on API routes
- ⚠️ Password hashing not implemented (passwordHash column exists)
- ✅ Session configured with PostgreSQL store
- ✅ Input validation with Zod
- ✅ SQL injection prevention via Drizzle ORM

### Future Security Checklist
When implementing authentication/authorization:

1. [ ] Implement password hashing (bcrypt or argon2)
2. [ ] Add authentication middleware to all protected routes
3. [ ] Implement RBAC checks based on userTenantRoles
4. [ ] Add CSRF protection for state-changing operations
5. [ ] Implement rate limiting (express-rate-limit)
6. [ ] Add helmet.js for security headers
7. [ ] Validate file uploads if implementing actual file storage
8. [ ] Add Content Security Policy
9. [ ] Implement proper session expiration
10. [ ] Add audit logging for sensitive operations

### Input Validation
- ✅ All API routes should validate with Zod schemas
- ✅ Use `fromZodError` for user-friendly messages
- ✅ Sanitize user input displayed in UI (React does this automatically)
- ✅ Validate JSONB schema structure before saving

---

## Deployment Notes

### Replit Deployment
Configured in `.replit` file:

**Modules:**
- nodejs-20
- web
- postgresql-16

**Build process:**
```bash
npm run build
# 1. Vite build → dist/public
# 2. esbuild server → dist/index.js
```

**Run command:**
```bash
npm run start
# Runs: NODE_ENV=production node dist/index.js
```

**Port mapping:**
- Internal: 5000
- External: 80 (mapped by Replit)

**Autoscale configuration:**
- Target: autoscale
- Workflow: parallel

### Environment Setup
Required environment variables in Replit Secrets:
- `DATABASE_URL` - Neon PostgreSQL connection string

### Post-Deployment Tasks
1. [ ] Run database migrations (when implemented)
2. [ ] Seed database with initial data (tsx server/seed.ts)
3. [ ] Verify DATABASE_URL environment variable
4. [ ] Test subdomain routing (when implemented)
5. [ ] Configure custom domain (if applicable)

---

## Useful Resources

### Documentation Links
- React Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- shadcn/ui: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/
- Tailwind CSS: https://tailwindcss.com/docs
- Wouter: https://github.com/molefrog/wouter
- Zustand: https://docs.pmnd.rs/zustand/getting-started/introduction

### Code Examples
- **Markland POA Form:** Comprehensive real-world example in `client/src/pages/MarklandExample.tsx`
- **Mock Data:** Form schemas in `client/src/lib/mock-data.ts`
- **API Client:** Complete example in `client/src/lib/api.ts`
- **Storage Layer:** Repository pattern in `server/storage.ts`

### shadcn/ui Components Available (55 total)
accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip, use-mobile, use-toast

---

## Changelog

### Version History
- **2025-11-21:** Initial global-memory document created
  - Documented all patterns and conventions
  - Added testing requirements (not yet implemented)
  - Catalogued database schema and API endpoints
  - Documented special features (inline bylaws, multi-tenancy)
  - Added security considerations for future implementation

---

## Notes

This document should be updated whenever:
- New architectural patterns are introduced
- Testing framework is implemented
- Security features are added
- Database schema significantly changes
- New conventions are established
- Major features are added

Keep this document as a reference for maintaining consistency across development sessions.
