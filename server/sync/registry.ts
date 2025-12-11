/**
 * Sync Feature Registry
 *
 * Documents what actions POAssociation can receive and send.
 * This is exposed via /api/sync/features for partner apps to discover capabilities.
 */

export const syncFeatures = {
  // What POAssociation can RECEIVE from partner apps
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
        completedAt: "string (ISO 8601)",
      },
    },
    "home.updated": {
      description: "Home profile updated in HomeHub",
      schema: {
        homeId: "number",
        address: "string (optional)",
        postalCode: "string (optional)",
      },
    },
    "health.check": {
      description: "Health check request",
      schema: {},
    },
  } as Record<string, { description: string; schema: Record<string, string> }>,

  // What POAssociation can SEND to partner apps
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
        avatarUrl: "string (optional)",
      },
    },
    "project.statusFromPoa": {
      description: "POA application status change",
      schema: {
        applicationId: "number",
        homeHubProjectId: "number",
        status: "string",
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
  } as Record<string, { description: string; schema: Record<string, string> }>,

  // App metadata
  meta: {
    appId: "poassociation",
    appName: "POAssociation",
    version: "1.0.0",
    syncProtocolVersion: "1",
    baseUrl: process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined,
  },
};

/**
 * Check if an action is supported for receiving
 */
export function canReceive(action: string): boolean {
  return action in syncFeatures.receives;
}

/**
 * Check if an action is supported for sending
 */
export function canSend(action: string): boolean {
  return action in syncFeatures.sends;
}
