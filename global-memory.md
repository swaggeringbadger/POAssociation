# Global Memory - POA Association Portal

This file contains important architectural decisions and patterns that should be preserved across sessions.

## Feature Flag Management System

**Last Updated:** 2025-11-28 (Audit Completed & Fixed)

### Overview
The POA Association Portal uses a centralized feature flag system to manage subscription plan features. This prevents feature hallucination and ensures consistency between the database, types, and UI.

### Single Source of Truth
**File:** `/home/runner/workspace/shared/featureDefinitions.ts`

This is the ONLY place where subscription features should be defined. All other code references this file.

### How It Works

1. **Feature Definition Structure**
   ```typescript
   export interface FeatureDefinition {
     key: string;           // Database column name (snake_case)
     displayName: string;   // User-facing name
     description: string;   // Feature explanation
     icon: string;          // Lucide icon name
     iconColor: string;     // Tailwind color class
     category: 'core' | 'advanced' | 'enterprise';
   }
   ```

2. **Currently IMPLEMENTED Features** (as of 2025-11-28)

   **ONLY these 3 features are actually implemented and gated:**
   - ✅ **Custom Branding** - Logo upload and management company settings (GATED)
   - ✅ **AI Form Generation** - Automatic form generation from design guidelines (GATED)
   - ✅ **Custom Workflows** - Custom approval workflows for applications (GATED)

   **Removed from featureDefinitions.ts (not implemented):**
   - ❌ Advanced Reporting (removed - no implementation)
   - ❌ API Access (removed - no implementation)
   - ❌ White Label (removed - no implementation)
   - ❌ Priority Support (removed - no implementation)
   - ❌ SSO (removed - no implementation)
   - ❌ Audit Logs (removed - no implementation)

### Feature Gating Implementation

All implemented features now have proper subscription tier checks:

1. **AI Form Generation** - `POST /api/ai/generate-form` (routes.ts:1821-1829)
   - Checks `ai_form_generation` feature access before processing
   - Returns 403 if plan doesn't include feature

2. **Custom Workflows** - 5 endpoints (routes.ts:1617-1773)
   - `GET /api/workflows/templates` - List templates
   - `POST /api/applications/:id/workflow` - Create workflow
   - `GET /api/applications/:id/workflow` - Get workflow
   - `POST /api/applications/:id/workflow/action` - Perform action
   - `GET /api/applications/:id/workflow/history` - Get history
   - All check `custom_workflows` feature access

3. **Custom Branding** - `PUT /api/management-company/:id/settings` (routes.ts:250-258)
   - Checks `custom_branding` feature access before allowing settings update

3. **Usage in Components**
   - Import `SUBSCRIPTION_FEATURES` from `@shared/featureDefinitions`
   - Map over features dynamically to render UI
   - Use `iconMap` to resolve icon components
   - Example in `/home/runner/workspace/client/src/components/SubscriptionManagement.tsx`

### Adding a New Feature

**CRITICAL:** Only add features that are actually implemented in the codebase.

1. Add feature definition to `shared/featureDefinitions.ts`:
   ```typescript
   newFeature: {
     key: 'new_feature',
     displayName: 'New Feature',
     description: 'What this feature does',
     icon: 'Check',
     iconColor: 'text-green-600',
     category: 'core',
   }
   ```

2. Add corresponding column to database table `subscription_plans`:
   ```sql
   ALTER TABLE subscription_plans ADD COLUMN new_feature BOOLEAN DEFAULT FALSE;
   ```

3. Update TypeScript types in `shared/subscriptionTypes.ts`:
   ```typescript
   export interface SubscriptionPlan {
     // ... existing fields
     newFeature: boolean;
   }
   ```

4. UI automatically updates - no additional changes needed!

### Removing a Feature

1. Remove from `shared/featureDefinitions.ts`
2. Remove database column (or deprecate with migration)
3. Remove from TypeScript types
4. UI automatically stops showing it

### Why This System Exists

**Problem Solved:** Previously, features were hardcoded in UI components. This led to:
- Feature hallucination (showing features that don't exist)
- Inconsistency between UI and database
- Difficulty managing features across multiple components

**Solution:** Single source of truth ensures:
- Features shown in UI exactly match database capabilities
- Easy to add/remove features globally
- Type safety across frontend and backend
- No duplicate feature definitions

### Files That Use This System

- `/home/runner/workspace/shared/featureDefinitions.ts` - Feature definitions
- `/home/runner/workspace/client/src/components/SubscriptionManagement.tsx` - Main UI consumer
- `/home/runner/workspace/shared/subscriptionTypes.ts` - TypeScript types
- Database table: `subscription_plans` - Feature columns

### Important Notes

1. **Never hardcode features** - Always reference `SUBSCRIPTION_FEATURES`
2. **Icon mapping** - Ensure any new icon is added to the `iconMap` in SubscriptionManagement
3. **Database sync** - Feature flag in code must match database column
4. **Snake_case vs camelCase** - Database uses snake_case, TypeScript uses camelCase. The `key` field in featureDefinitions.ts is snake_case.

## Development Workflow Conventions

### Server Restart After Code Changes

**IMPORTANT:** After making server-side code changes, always restart the Replit server to ensure changes take effect. The tsx hot-reload doesn't always work reliably for service files.

```bash
pkill -f "tsx server/index.ts"
```

Then click **Run** in Replit to restart. This prevents debugging inconsistencies from stale code.

**When to restart:**
- After modifying any file in `/server/` directory
- After modifying `/shared/` files that are used server-side
- When debugging unexpected behavior that doesn't match code changes
- After changing environment variables or configuration

### Helper Functions Available

```typescript
getAllFeatureKeys()                    // Get all feature keys
getFeaturesByCategory(category)        // Filter by category
isValidFeature(key)                    // Validate feature key
getFeatureDefinition(key)              // Get specific feature
```

## Subscription System Notes

### Known Issues
- **Subscription History Table:** The `subscription_history` table does not exist in the database. The history insertion code in `storage.ts:1049-1055` is commented out until this table is created.
- **Storage Method Fix:** `updateTenantSubscription` in `/home/runner/workspace/server/storage.ts:1040` has subscription history disabled to prevent 500 errors.

### Related Files
- `/home/runner/workspace/server/storage.ts` - Subscription data access methods
- `/home/runner/workspace/client/src/pages/TenantSettings.tsx` - Settings page at /settings route
- `/home/runner/workspace/client/src/pages/PropertySubscription.tsx` - Property-specific subscriptions
- `/home/runner/workspace/client/src/pages/Properties.tsx` - Properties list with subscription menu item
