# Subscription Features Test Specification

**Purpose:** This document outlines all subscription features, which plans have access to them, and how to test them with Playwright.

**Last Updated:** 2025-11-28

---

## Overview

The POA Association Portal has **3 implemented and gated features**:
1. Custom Branding
2. AI Form Generation
3. Custom Workflows

All features are properly gated by subscription tier and return HTTP 403 when accessed without proper subscription.

---

## Subscription Plans

### Management Company Plans

| Plan | Price/Month | Custom Branding | AI Form Generation | Custom Workflows |
|------|------------|-----------------|-------------------|------------------|
| **Free** | $0 | ❌ | ❌ | ❌ |
| **Starter** | $49 | ✅ | ✅ | ✅ |
| **Professional** | $149 | ✅ | ✅ | ✅ |
| **Enterprise** | $499 | ✅ | ✅ | ✅ |

### Community Plans

| Plan | Price/Month | Custom Branding | AI Form Generation | Custom Workflows |
|------|------------|-----------------|-------------------|------------------|
| **Free** | $0 | ❌ | ❌ | ❌ |
| **Basic** | $29 | ✅ | ❌ | ❌ |
| **Premium** | $99 | ✅ | ✅ | ✅ |
| **Enterprise** | $299 | ✅ | ✅ | ✅ |

---

## Feature 1: Custom Branding

### Description
Allows management companies to upload their own logo and customize company settings (name, colors, etc.).

### Implementation Details
- **UI Component:** `/client/src/components/ManagementSettingsModal.tsx`
- **API Endpoint:** `PUT /api/management-company/:id/settings`
- **Feature Check:** Line 250-258 in `/server/routes.ts`
- **Database Column:** `custom_branding` in `subscription_plans` table

### Access Matrix
- ✅ Management Starter and above
- ✅ Community Basic and above
- ❌ Free plans (both types)

### Test Scenarios

#### Test 1: Free Plan - Access Denied
```typescript
test('Custom Branding - Free plan cannot upload logo', async ({ page }) => {
  // Login as management company with Free plan
  await loginAs(page, 'management_free_user');

  // Navigate to settings
  await page.goto('/settings');

  // Attempt to open branding settings (should fail or be disabled)
  // Verify error message or disabled state

  // Attempt API call directly
  const response = await page.request.put('/api/management-company/TENANT_ID/settings', {
    data: { name: 'Test', settings: { logo: 'data:image/...' } }
  });

  expect(response.status()).toBe(403);
  const error = await response.json();
  expect(error.error).toContain('Custom Branding is not available');
});
```

#### Test 2: Starter Plan - Access Granted
```typescript
test('Custom Branding - Starter plan can upload logo', async ({ page }) => {
  // Login as management company with Starter plan
  await loginAs(page, 'management_starter_user');

  // Navigate to settings
  await page.goto('/settings');

  // Upload logo successfully
  await page.click('[data-testid="upload-logo-button"]');
  await page.setInputFiles('input[type="file"]', 'test-logo.png');

  // Verify success
  await expect(page.locator('[data-testid="logo-preview"]')).toBeVisible();
});
```

---

## Feature 2: AI Form Generation

### Description
Automatically generates application forms using AI based on the property's design guidelines URL.

### Implementation Details
- **UI Component:** `/client/src/pages/FormWizard.tsx` (line 208)
- **Service:** `/server/aiFormGenerationService.ts`
- **API Endpoint:** `POST /api/ai/generate-form`
- **Feature Check:** Line 1821-1829 in `/server/routes.ts`
- **Database Column:** `ai_form_generation` in `subscription_plans` table

### Access Matrix
- ✅ Management Starter and above
- ✅ Community Premium and above
- ❌ Management Free
- ❌ Community Free and Basic

### Test Scenarios

#### Test 1: Free Plan - Access Denied
```typescript
test('AI Form Generation - Free plan returns 403', async ({ page }) => {
  // Login as community with Free plan
  await loginAs(page, 'community_free_user');

  // Attempt to generate form via API
  const response = await page.request.post('/api/ai/generate-form', {
    data: {
      tenantId: 'TENANT_ID',
      applicationType: 'Deck Addition'
    }
  });

  expect(response.status()).toBe(403);
  const error = await response.json();
  expect(error.error).toContain('AI Form Generation is not available');
  expect(error.requiredPlan).toBeDefined();
  expect(error.currentPlan).toBeDefined();
});
```

#### Test 2: Basic Plan - Access Denied (Community Only)
```typescript
test('AI Form Generation - Community Basic plan returns 403', async ({ page }) => {
  // Login as community with Basic plan
  await loginAs(page, 'community_basic_user');

  // Navigate to form wizard
  await page.goto('/form-wizard');

  // Verify AI generation button is disabled or shows upgrade prompt
  const aiButton = page.locator('[data-testid="ai-generate-button"]');
  await expect(aiButton).toBeDisabled();

  // Or verify upgrade message
  await expect(page.locator('text=/upgrade.*premium/i')).toBeVisible();
});
```

#### Test 3: Premium Plan - Access Granted
```typescript
test('AI Form Generation - Premium plan can generate forms', async ({ page }) => {
  // Login as community with Premium plan
  await loginAs(page, 'community_premium_user');

  // Ensure design guidelines URL is set
  await setDesignGuidelinesUrl(page, 'https://example.com/guidelines.pdf');

  // Navigate to form wizard
  await page.goto('/form-wizard');

  // Generate form with AI
  await page.click('[data-testid="ai-generate-button"]');
  await page.fill('[name="applicationType"]', 'Fence Installation');
  await page.click('[data-testid="generate-submit"]');

  // Wait for generation (may take time)
  await page.waitForResponse(resp =>
    resp.url().includes('/api/ai/generate-form') && resp.status() === 200
  );

  // Verify form was created
  await expect(page.locator('[data-testid="generated-form"]')).toBeVisible();
});
```

---

## Feature 3: Custom Workflows

### Description
Custom approval workflows for applications with multi-step approval processes and role-based access.

### Implementation Details
- **Database:** `workflow_templates`, `application_workflows`, `workflow_step_actions` tables
- **Seed Data:** `/server/seed-workflows.ts`
- **API Endpoints:** 5 endpoints (routes.ts:1609-1783)
  1. `GET /api/workflows/templates`
  2. `POST /api/applications/:id/workflow`
  3. `GET /api/applications/:id/workflow`
  4. `POST /api/applications/:id/workflow/action`
  5. `GET /api/applications/:id/workflow/history`
- **Feature Check:** Each endpoint checks `custom_workflows` feature access
- **Database Column:** `custom_workflows` in `subscription_plans` table

### Access Matrix
- ✅ Management Starter and above
- ✅ Community Premium and above
- ❌ Management Free
- ❌ Community Free and Basic

### Test Scenarios

#### Test 1: Free Plan - Cannot List Workflow Templates
```typescript
test('Custom Workflows - Free plan cannot list templates', async ({ page }) => {
  // Login as management company with Free plan
  await loginAs(page, 'management_free_user');

  // Attempt to fetch workflow templates
  const response = await page.request.get('/api/workflows/templates');

  expect(response.status()).toBe(403);
  const error = await response.json();
  expect(error.error).toContain('Custom Workflows are not available');
});
```

#### Test 2: Free Plan - Cannot Create Workflow for Application
```typescript
test('Custom Workflows - Free plan cannot create workflow', async ({ page }) => {
  // Login as community with Free plan
  await loginAs(page, 'community_free_user');

  // Create a test application first
  const appId = await createTestApplication(page);

  // Attempt to initialize workflow
  const response = await page.request.post(`/api/applications/${appId}/workflow`, {
    data: { workflowTemplateId: 'TEMPLATE_ID' }
  });

  expect(response.status()).toBe(403);
  const error = await response.json();
  expect(error.error).toContain('Custom Workflows are not available');
});
```

#### Test 3: Starter Plan - Can Create and Use Workflows
```typescript
test('Custom Workflows - Starter plan can create and advance workflow', async ({ page }) => {
  // Login as management company with Starter plan
  await loginAs(page, 'management_starter_user');

  // Create application
  const appId = await createTestApplication(page);

  // Get available workflow templates
  const templatesResp = await page.request.get('/api/workflows/templates');
  expect(templatesResp.status()).toBe(200);
  const templates = await templatesResp.json();
  expect(templates.length).toBeGreaterThan(0);

  // Initialize workflow for application
  const createResp = await page.request.post(`/api/applications/${appId}/workflow`, {
    data: { workflowTemplateId: templates[0].id }
  });
  expect(createResp.status()).toBe(201);

  // Get workflow details
  const workflowResp = await page.request.get(`/api/applications/${appId}/workflow`);
  expect(workflowResp.status()).toBe(200);
  const workflow = await workflowResp.json();
  expect(workflow.currentStepIndex).toBe(0);

  // Perform workflow action
  const actionResp = await page.request.post(`/api/applications/${appId}/workflow/action`, {
    data: {
      action: 'approve',
      stepIndex: 0,
      notes: 'Test approval'
    }
  });
  expect(actionResp.status()).toBe(200);

  // Verify workflow advanced
  const updatedWorkflow = await actionResp.json();
  expect(updatedWorkflow.currentStepIndex).toBe(1);
});
```

#### Test 4: Basic Plan - Access Denied (Community Only)
```typescript
test('Custom Workflows - Community Basic cannot use workflows', async ({ page }) => {
  // Login as community with Basic plan
  await loginAs(page, 'community_basic_user');

  // Verify workflows are not available
  const response = await page.request.get('/api/workflows/templates');
  expect(response.status()).toBe(403);
});
```

---

## Feature Access Testing Matrix

### Quick Reference Table

| Feature | Free (Mgmt) | Starter (Mgmt) | Professional (Mgmt) | Enterprise (Mgmt) | Free (Comm) | Basic (Comm) | Premium (Comm) | Enterprise (Comm) |
|---------|------------|----------------|---------------------|-------------------|------------|--------------|----------------|-------------------|
| Custom Branding | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 |
| AI Form Generation | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 403 | ✅ 200 | ✅ 200 |
| Custom Workflows | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 | ❌ 403 | ❌ 403 | ✅ 200 | ✅ 200 |

---

## Test Helper Functions

### Login Helper
```typescript
async function loginAs(page: Page, userRole: string) {
  // Implementation depends on auth system
  // For demo users, might use demo code entry
  await page.goto('/demo');
  await page.fill('[name="demoCode"]', 'DEMO_CODE');
  await page.click('[data-testid="submit-demo-code"]');
  await page.click(`[data-testid="persona-${userRole}"]`);
}
```

### Tenant Setup Helper
```typescript
async function setDesignGuidelinesUrl(page: Page, url: string) {
  const tenantId = await getCurrentTenantId(page);
  await page.request.put(`/api/tenants/${tenantId}`, {
    data: { designGuidelinesUrl: url }
  });
}
```

### Application Helper
```typescript
async function createTestApplication(page: Page): Promise<string> {
  const response = await page.request.post('/api/applications', {
    data: {
      applicantName: 'Test Applicant',
      applicationType: 'Test Type',
      // ... other required fields
    }
  });
  const app = await response.json();
  return app.id;
}
```

---

## Database Seed Data (for reference)

All plans are seeded in `/db/migrations/007_add_subscriptions.sql` lines 120-159.

### Management Company Plans
- **Free:** 1 community, 5 users, 1GB storage, 5 forms
- **Starter:** 5 communities, 25 users, 10GB storage, 25 forms
- **Professional:** 25 communities, 100 users, 50GB storage, 100 forms
- **Enterprise:** Unlimited

### Community Plans
- **Free:** 10 users, 1GB storage, 3 forms
- **Basic:** 50 users, 10GB storage, 10 forms
- **Premium:** 200 users, 50GB storage, 50 forms
- **Enterprise:** Unlimited

---

## Expected Error Responses

When a feature is accessed without proper subscription:

```json
{
  "error": "<Feature Name> is not available in your subscription plan",
  "requiredPlan": "management_starter",
  "currentPlan": "management_free"
}
```

HTTP Status: `403 Forbidden`

---

## Notes for Playwright Test Development

1. **Test Isolation:** Each test should create its own tenant/user or use dedicated test accounts
2. **Cleanup:** Tests should clean up created resources (applications, workflows, etc.)
3. **Parallel Execution:** Tests can run in parallel as long as they use different tenants
4. **API vs UI:** Test both API-level access (HTTP status codes) and UI-level access (button states, error messages)
5. **Upgrade Flow:** Consider testing the upgrade flow (Free → Starter) and verifying features become available
6. **Downgrade Flow:** Test downgrade scenarios to ensure features become restricted

---

## Coverage Checklist

- [ ] All 3 features tested for each plan type (8 plans × 3 features = 24 tests minimum)
- [ ] HTTP 403 responses verified for unauthorized access
- [ ] HTTP 200 responses verified for authorized access
- [ ] Error messages include plan information (requiredPlan, currentPlan)
- [ ] UI properly shows/hides features based on subscription
- [ ] Upgrade flow enables previously restricted features
- [ ] All 5 workflow endpoints tested for access control
- [ ] Custom Branding tested for management companies specifically
