# POA: Add the /receive endpoint

Copy this to your POA Claude session. This adds the missing `/api/sync/receive` endpoint.

---

## Instructions for Claude

Add the receive endpoint to `server/routes/sync.ts`. This handles signed requests from HomeHub.

**Add these imports at the top if not already present:**

```typescript
import crypto from "crypto";
```

**Add this helper function and route:**

```typescript
// ==============================================
// Signature Verification
// ==============================================

interface SyncPayload {
  action: string;
  sourceApp: string;
  targetApp: string;
  timestamp: number;
  nonce: string;
  data: Record<string, any>;
}

interface SignedRequest {
  payload: SyncPayload;
  signature: string;
}

function verifyRequest(request: SignedRequest, sourceApp: string): { valid: boolean; error?: string } {
  // Get the shared secret for HomeHub
  const secret = process.env.SYNC_SECRET_HOMEHUB;

  if (!secret) {
    return { valid: false, error: "No secret configured for HomeHub" };
  }

  if (sourceApp !== "homehub") {
    return { valid: false, error: `Unknown source app: ${sourceApp}` };
  }

  // Check timestamp (5 minute window)
  const age = Date.now() - request.payload.timestamp;
  if (age > 5 * 60 * 1000) {
    return { valid: false, error: "Request expired" };
  }
  if (age < -30 * 1000) {
    return { valid: false, error: "Request timestamp in future" };
  }

  // Verify signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(request.payload))
    .digest("hex");

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(request.signature),
      Buffer.from(expected)
    );
    if (!valid) {
      return { valid: false, error: "Invalid signature" };
    }
  } catch {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

// ==============================================
// Receive Endpoint
// ==============================================

/**
 * POST /api/sync/receive
 * Receive signed requests from HomeHub
 */
router.post("/receive", async (req, res) => {
  const request = req.body as SignedRequest;

  // Validate structure
  if (!request?.payload?.sourceApp || !request?.signature) {
    return res.status(400).json({ error: "Invalid request format" });
  }

  const { sourceApp, action } = request.payload;
  console.log(`[Sync] Inbound request from ${sourceApp}: ${action}`);

  // Verify signature
  const verification = verifyRequest(request, sourceApp);
  if (!verification.valid) {
    console.error(`[Sync] Verification failed: ${verification.error}`);
    return res.status(401).json({ error: verification.error });
  }

  // Handle the action
  try {
    const result = await handleSyncAction(request.payload);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Sync] Handler error:", err);
    res.status(500).json({ error: err.message || "Handler failed" });
  }
});

/**
 * POST /api/sync/health
 * Signed health check endpoint
 */
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

// ==============================================
// Action Handler
// ==============================================

async function handleSyncAction(payload: SyncPayload): Promise<any> {
  const { action, data } = payload;

  switch (action) {
    case "health.check":
      return {
        healthy: true,
        app: "poassociation",
        timestamp: Date.now(),
      };

    case "project.statusChanged":
      console.log(`[Sync] Project ${data.projectId} status: ${data.status}`);
      // TODO: Update linked HOA application status
      return { received: true };

    case "project.completed":
      console.log(`[Sync] Project ${data.projectId} completed`);
      // TODO: Auto-close linked HOA application
      return { received: true };

    case "home.updated":
      console.log(`[Sync] Home ${data.homeId} updated`);
      // TODO: Sync home data
      return { received: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
```

**Make sure `syncFeatures` is defined** (should already exist from features endpoint).

**Environment variable needed:**
```
SYNC_SECRET_HOMEHUB=<same-value-as-SYNC_SECRET_POA-in-homehub>
```

---

Once this is added and POA restarts, HomeHub can send signed requests to POA!
