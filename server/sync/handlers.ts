import { SyncPayload } from "./protocol";

// Type definitions for incoming sync data
interface ProjectStatusChangedData {
  projectId: number;
  status: string;
  homeId: number;
}

interface ProjectCompletedData {
  projectId: number;
  homeId: number;
  completedAt: string;
}

interface HomeUpdatedData {
  homeId: number;
  address?: string;
  postalCode?: string;
}

/**
 * Handle incoming sync actions from partner apps
 */
export async function handleSyncAction(payload: SyncPayload): Promise<any> {
  console.log(`[Sync] Handling action: ${payload.action} from ${payload.sourceApp}`);

  switch (payload.action) {
    case "project.statusChanged":
      return handleProjectStatusChanged(payload.data as ProjectStatusChangedData);
    case "project.completed":
      return handleProjectCompleted(payload.data as ProjectCompletedData);
    case "home.updated":
      return handleHomeUpdated(payload.data as HomeUpdatedData);
    case "health.check":
      return handleHealthCheck();
    default:
      throw new Error(`Unknown action: ${payload.action}`);
  }
}

/**
 * Handle project status changes from HomeHub
 * Called when a HomeHub project linked to a POA application changes status
 */
async function handleProjectStatusChanged(data: ProjectStatusChangedData): Promise<{ received: boolean }> {
  console.log(`[Sync] HomeHub project ${data.projectId} status changed to: ${data.status}`);

  // TODO: When application integration is added, update linked application status
  // Example:
  // await db.update(schema.applications)
  //   .set({ linkedProjectStatus: data.status, updatedAt: new Date() })
  //   .where(eq(schema.applications.homeHubProjectId, data.projectId));

  return { received: true };
}

/**
 * Handle project completion from HomeHub
 * Called when a HomeHub project is marked as completed
 */
async function handleProjectCompleted(data: ProjectCompletedData): Promise<{ received: boolean }> {
  console.log(`[Sync] HomeHub project ${data.projectId} completed at ${data.completedAt}`);

  // TODO: When application integration is added, auto-close linked application
  // Example:
  // await db.update(schema.applications)
  //   .set({
  //     status: "completed",
  //     completedAt: new Date(data.completedAt),
  //     updatedAt: new Date()
  //   })
  //   .where(eq(schema.applications.homeHubProjectId, data.projectId));

  return { received: true };
}

/**
 * Handle home profile updates from HomeHub
 * Called when a home's address or other details are updated in HomeHub
 */
async function handleHomeUpdated(data: HomeUpdatedData): Promise<{ received: boolean }> {
  console.log(`[Sync] Home ${data.homeId} updated in HomeHub`);

  // TODO: Sync home data to POA properties if we have a linked property
  // This would require a homeHubHomeId column on properties table

  return { received: true };
}

/**
 * Handle health check requests
 */
async function handleHealthCheck(): Promise<{
  healthy: boolean;
  app: string;
  timestamp: number;
}> {
  return {
    healthy: true,
    app: "poassociation",
    timestamp: Date.now(),
  };
}
