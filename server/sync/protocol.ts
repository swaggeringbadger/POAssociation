import crypto from "crypto";

const SYNC_SECRETS: Record<string, string | undefined> = {
  homehub: process.env.SYNC_SECRET_HOMEHUB,
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

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Sign a payload with HMAC-SHA256
 */
export function signPayload(payload: SyncPayload, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
}

/**
 * Verify a signed request from a partner app
 */
export function verifyRequest(
  request: SignedRequest,
  sourceApp: string
): VerificationResult {
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

  // Use timing-safe comparison
  if (request.signature.length !== expected.length) {
    return { valid: false, error: "Invalid signature" };
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(request.signature),
    Buffer.from(expected)
  );

  if (!valid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Check if sync is configured for a partner app
 */
export function isSyncConfigured(partnerApp: string): boolean {
  return !!SYNC_SECRETS[partnerApp];
}
