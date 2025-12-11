# POAssociation: Inter-App Sync Implementation

Copy-paste these instructions to your POAssociation Claude session to implement the sync protocol.

---

## Context for Claude

I need to implement a secure inter-app sync protocol to communicate with my HomeHub app. This enables features like:
- Seeding HomeHub projects when HOA applications are approved
- Syncing user profile data between apps
- Sending community announcements to HomeHub
- Notifying about violations, dues, etc.

The protocol uses HMAC-SHA256 signed payloads (same pattern as SSO) over REST APIs.

---

## Step 1: Environment Variables

Add these to your Replit Secrets:

```env
# HomeHub integration
HOMEHUB_APP_URL=https://your-homehub-url.replit.app
SYNC_SECRET_HOMEHUB=<generate-64-char-secret>
```

Generate the secret (share this exact value with HomeHub):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 2: Create Sync Module

Create these files:

### server/sync/protocol.ts

```typescript
import crypto from "crypto";

const SYNC_SECRETS: Record<string, string> = {
  homehub: process.env.SYNC_SECRET_HOMEHUB!,
};

export interface SyncPayload {
  action: string;
  sourceApp: string;
  targetApp: string;
  timestamp: number;
  nonce: string;
  data: Record<string, any>;
  replyTo?: string;
}

export interface SignedRequest {
  payload: SyncPayload;
  signature: string;
}

export function signPayload(payload: SyncPayload, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function verifyRequest(
  request: SignedRequest,
  sourceApp: string
): { valid: boolean; error?: string } {
  const secret = SYNC_SECRETS[sourceApp];
  if (!secret) {
    return { valid: false, error: `Unknown source app: ${sourceApp}` };
  }

  // Check timestamp (5 minute window)
  const age = Date.now() - request.payload.timestamp;
  if (age > 5 * 60 * 1000 || age < -30 * 1000) {
    return { valid: false, error: "Request expired or clock skew too large" };
  }

  // Verify signature
  const expected = signPayload(request.payload, secret);
  const valid = crypto.timingSafeEqual(
    Buffer.from(request.signature),
    Buffer.from(expected)
  );

  if (!valid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}
```

### server/sync/client.ts

```typescript
import crypto from "crypto";
import { signPayload, SyncPayload } from "./protocol";

const PARTNER_APPS: Record<string, { url: string; secret: string }> = {
  homehub: {
    url: process.env.HOMEHUB_APP_URL || "https://homehub.replit.app",
    secret: process.env.SYNC_SECRET_HOMEHUB!,
  },
};

export async function sendSyncRequest<T = any>(
  targetApp: string,
  action: string,
  data: Record<string, any>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const partner = PARTNER_APPS[targetApp];
  if (!partner) {
    return { success: false, error: `Unknown target app: ${targetApp}` };
  }

  const payload: SyncPayload = {
    action,
    sourceApp: "poassociation",
    targetApp,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    data,
  };

  const signature = signPayload(payload, partner.secret);

  try {
    const response = await fetch(`${partner.url}/api/sync/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, signature }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || "Request failed" };
    }

    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: `Network error: ${err}` };
  }
}

// Convenience functions for common actions
export async function seedHomeHubProject(data: {
  applicationId: number;
  projectName: string;
  description: string;
  homeId: number;
  userId: number;
}) {
  return sendSyncRequest<{ projectId: number; url: string }>(
    "homehub",
    "project.seed",
    data
  );
}

export async function syncUserToHomeHub(data: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}) {
  return sendSyncRequest("homehub", "user.sync", data);
}

export async function notifyProjectStatus(data: {
  applicationId: number;
  homeHubProjectId: number;
  status: string;
}) {
  return sendSyncRequest("homehub", "project.statusFromPoa", data);
}
```

### server/sync/registry.ts

```typescript
export const syncFeatures = {
  // What POAssociation can RECEIVE from HomeHub
  receives: {
    "project.statusChanged": {
      description: "HomeHub project status changed",
      schema: {
        projectId: "number",
        status: "string",
        homeId: "number",
      },
    },
    "project.completed": {
      description: "HomeHub project completed",
      schema: {
        projectId: "number",
        homeId: "number",
        completedAt: "string",
      },
    },
    "home.updated": {
      description: "Home profile updated in HomeHub",
      schema: {
        homeId: "number",
        address: "string?",
        postalCode: "string?",
      },
    },
  },

  // What POAssociation can SEND to HomeHub
  sends: {
    "project.seed": {
      description: "Create project from approved HOA application",
      schema: {
        applicationId: "number",
        projectName: "string",
        description: "string",
        homeId: "number",
        userId: "number",
      },
    },
    "user.sync": {
      description: "Sync user profile data",
      schema: {
        email: "string",
        displayName: "string",
        avatarUrl: "string?",
      },
    },
    "violation.created": {
      description: "New violation issued",
      schema: {
        violationId: "number",
        homeId: "number",
        type: "string",
        description: "string",
      },
    },
    "announcement.posted": {
      description: "Community announcement",
      schema: {
        announcementId: "number",
        title: "string",
        content: "string",
        priority: "string",
      },
    },
  },

  meta: {
    appId: "poassociation",
    version: "1.0.0",
    syncProtocolVersion: "1",
    baseUrl: process.env.APP_URL,
  },
};
```

### server/sync/handlers.ts

```typescript
import { SyncPayload } from "./protocol";
import { db } from "../db"; // Adjust import path

export async function handleSyncAction(payload: SyncPayload): Promise<any> {
  switch (payload.action) {
    case "project.statusChanged":
      return handleProjectStatusChanged(payload.data);
    case "project.completed":
      return handleProjectCompleted(payload.data);
    case "home.updated":
      return handleHomeUpdated(payload.data);
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

async function handleProjectStatusChanged(data: {
  projectId: number;
  status: string;
  homeId: number;
}) {
  // Find linked HOA application and update its status
  // This depends on your schema - adjust accordingly
  console.log(`HomeHub project ${data.projectId} status: ${data.status}`);

  // Example: Update linked application
  // await db.update(hoaApplications)
  //   .set({ linkedProjectStatus: data.status })
  //   .where(eq(hoaApplications.homeHubProjectId, data.projectId));

  return { received: true };
}

async function handleProjectCompleted(data: {
  projectId: number;
  homeId: number;
  completedAt: string;
}) {
  // Auto-close linked HOA application when project completes
  console.log(`HomeHub project ${data.projectId} completed at ${data.completedAt}`);

  // Example: Close application
  // await db.update(hoaApplications)
  //   .set({ status: "completed", completedAt: new Date(data.completedAt) })
  //   .where(eq(hoaApplications.homeHubProjectId, data.projectId));

  return { received: true };
}

async function handleHomeUpdated(data: {
  homeId: number;
  address?: string;
  postalCode?: string;
}) {
  // Sync home data from HomeHub
  console.log(`Home ${data.homeId} updated in HomeHub`);
  return { received: true };
}
```

### server/sync/index.ts

```typescript
export * from "./protocol";
export * from "./client";
export * from "./registry";
export * from "./handlers";
```

---

## Step 3: Create Routes

### server/routes/sync.ts

```typescript
import { Router } from "express";
import { verifyRequest, SignedRequest } from "../sync/protocol";
import { syncFeatures } from "../sync/registry";
import { handleSyncAction } from "../sync/handlers";

const router = Router();

// Public feature registry - allows apps to discover capabilities
router.get("/features", (req, res) => {
  res.json(syncFeatures);
});

// Receive signed requests from partner apps
router.post("/receive", async (req, res) => {
  const request = req.body as SignedRequest;

  // Validate structure
  if (!request?.payload?.sourceApp || !request?.signature) {
    return res.status(400).json({ error: "Invalid request format" });
  }

  // Only accept from known apps
  if (request.payload.sourceApp !== "homehub") {
    return res.status(400).json({ error: "Unknown source app" });
  }

  // Verify signature
  const verification = verifyRequest(request, request.payload.sourceApp);
  if (!verification.valid) {
    console.error("Sync verification failed:", verification.error);
    return res.status(401).json({ error: verification.error });
  }

  // Check action is supported
  if (!syncFeatures.receives[request.payload.action]) {
    return res.status(400).json({
      error: `Unsupported action: ${request.payload.action}`
    });
  }

  // Route to handler
  try {
    const result = await handleSyncAction(request.payload);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Sync handler error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint (signed)
router.post("/health", (req, res) => {
  const request = req.body as SignedRequest;

  if (!request?.payload?.sourceApp) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const verification = verifyRequest(request, request.payload.sourceApp);
  if (!verification.valid) {
    return res.status(401).json({ error: verification.error });
  }

  res.json({
    healthy: true,
    app: "poassociation",
    timestamp: Date.now(),
    features: Object.keys(syncFeatures.receives),
  });
});

export default router;
```

### Register the routes (in your main routes file):

```typescript
import syncRoutes from "./routes/sync";

// Add this with your other route registrations
app.use("/api/sync", syncRoutes);
```

---

## Step 4: Add Database Table (Optional but Recommended)

Track sync events for debugging:

```typescript
// In your schema file
export const syncEvents = pgTable("sync_events", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull(), // "inbound" | "outbound"
  partnerApp: text("partner_app").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  response: jsonb("response"),
  status: text("status").notNull(), // "success" | "failed" | "pending"
  errorMessage: text("error_message"),
  correlationId: text("correlation_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

Run migration:
```bash
npm run db:push
```

---

## Step 5: Usage Examples

### Seed HomeHub Project on Application Approval

```typescript
// In your application approval handler
import { seedHomeHubProject } from "../sync/client";

async function approveApplication(applicationId: number) {
  // Your existing approval logic...
  const application = await getApplication(applicationId);

  // Sync to HomeHub
  const syncResult = await seedHomeHubProject({
    applicationId: application.id,
    projectName: `${application.type} - ${application.address}`,
    description: application.description,
    homeId: application.homeId,
    userId: application.userId,
  });

  if (syncResult.success) {
    // Store the link
    await db.update(hoaApplications)
      .set({
        homeHubProjectId: syncResult.data.projectId,
        homeHubProjectUrl: syncResult.data.url,
      })
      .where(eq(hoaApplications.id, applicationId));

    console.log(`Created HomeHub project: ${syncResult.data.url}`);
  } else {
    console.error(`Failed to sync to HomeHub: ${syncResult.error}`);
    // Don't fail the approval - just log the sync failure
  }
}
```

### Add Column to Track Link

```typescript
// In your applications table schema
homeHubProjectId: integer("home_hub_project_id"),
homeHubProjectUrl: text("home_hub_project_url"),
```

---

## Step 6: Testing

### Test Script

Create `scripts/test-homehub-sync.ts`:

```typescript
import { sendSyncRequest } from "../server/sync/client";

async function main() {
  const action = process.argv[2];

  switch (action) {
    case "health":
      console.log("Testing HomeHub connectivity...");
      const health = await sendSyncRequest("homehub", "health.check", {});
      console.log("Result:", JSON.stringify(health, null, 2));
      break;

    case "features":
      console.log("Fetching HomeHub features...");
      const url = process.env.HOMEHUB_APP_URL || "https://homehub.replit.app";
      const response = await fetch(`${url}/api/sync/features`);
      const features = await response.json();
      console.log("HomeHub features:", JSON.stringify(features, null, 2));
      break;

    case "test-seed":
      console.log("Testing project seed...");
      const result = await sendSyncRequest("homehub", "project.seed", {
        applicationId: 999,
        projectName: "Test Project from POA",
        description: "This is a test sync",
        homeId: 1,
        userId: 1,
      });
      console.log("Result:", JSON.stringify(result, null, 2));
      break;

    default:
      console.log(`
Usage: npx tsx scripts/test-homehub-sync.ts <command>

Commands:
  health    - Test connectivity to HomeHub
  features  - Fetch HomeHub's feature registry
  test-seed - Test project seeding (dev only)
      `);
  }
}

main().catch(console.error);
```

Run with:
```bash
npx tsx scripts/test-homehub-sync.ts health
```

---

## Coordination Checklist

- [ ] Generate shared secret and add to both apps
- [ ] Implement sync module in POAssociation (this doc)
- [ ] Implement sync module in HomeHub (tell Claude to implement from INTER_APP_SYNC_DESIGN.md)
- [ ] Test /api/sync/features endpoint on both apps
- [ ] Test signed health check
- [ ] Implement first real sync (project.seed)
- [ ] Test end-to-end flow

---

## Security Notes

1. **Never log the full payload** in production - it may contain sensitive data
2. **Validate all incoming data** with Zod schemas before processing
3. **Store nonces** to prevent replay attacks
4. **Rate limit** the /api/sync/receive endpoint
5. **Monitor** sync failures for security anomalies
