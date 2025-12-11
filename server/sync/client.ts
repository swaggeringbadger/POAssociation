import crypto from "crypto";
import { signPayload, SyncPayload } from "./protocol";

const PARTNER_APPS: Record<string, { url: string; secret: string | undefined }> = {
  homehub: {
    url: process.env.HOMEHUB_APP_URL || process.env.HOMEHUB_URL || "https://homehub.replit.app",
    secret: process.env.SYNC_SECRET_HOMEHUB,
  },
};

export interface SyncResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Send a signed sync request to a partner app
 */
export async function sendSyncRequest<T = any>(
  targetApp: string,
  action: string,
  data: Record<string, any>
): Promise<SyncResponse<T>> {
  const partner = PARTNER_APPS[targetApp];
  if (!partner) {
    return { success: false, error: `Unknown target app: ${targetApp}` };
  }

  if (!partner.secret) {
    return { success: false, error: `Sync secret not configured for: ${targetApp}` };
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
      return { success: false, error: result.error || `Request failed with status ${response.status}` };
    }

    return { success: true, data: result.data };
  } catch (err: any) {
    console.error(`[Sync] Network error sending to ${targetApp}:`, err.message);
    return { success: false, error: `Network error: ${err.message}` };
  }
}

/**
 * Check if sync is enabled for a partner app
 */
export function isSyncEnabled(targetApp: string): boolean {
  const partner = PARTNER_APPS[targetApp];
  return !!partner?.secret;
}

/**
 * Get the URL for a partner app
 */
export function getPartnerUrl(targetApp: string): string | undefined {
  return PARTNER_APPS[targetApp]?.url;
}

// ============================================
// Convenience functions for common sync actions
// ============================================

/**
 * Seed a HomeHub project from an approved POA application
 */
export async function seedHomeHubProject(data: {
  applicationId: number;
  projectName: string;
  description: string;
  homeId: number;
  userId: number;
}): Promise<SyncResponse<{ projectId: number; url: string }>> {
  return sendSyncRequest<{ projectId: number; url: string }>(
    "homehub",
    "project.seed",
    data
  );
}

/**
 * Sync user profile data to HomeHub
 */
export async function syncUserToHomeHub(data: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}): Promise<SyncResponse> {
  return sendSyncRequest("homehub", "user.sync", data);
}

/**
 * Notify HomeHub of a project status change from POA side
 */
export async function notifyProjectStatus(data: {
  applicationId: number;
  homeHubProjectId: number;
  status: string;
}): Promise<SyncResponse> {
  return sendSyncRequest("homehub", "project.statusFromPoa", data);
}

/**
 * Send a health check to verify connectivity
 */
export async function checkHomeHubHealth(): Promise<SyncResponse<{
  healthy: boolean;
  app: string;
  timestamp: number;
  features: string[];
}>> {
  return sendSyncRequest("homehub", "health.check", {});
}
