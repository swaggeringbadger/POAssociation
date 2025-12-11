import { SyncPayload } from "./protocol";
import { db } from "../storage";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

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

interface DevInstructionData {
  type: string;
  priority?: string;
  title: string;
  message: string;
  context?: Record<string, any>;
  relatedAction?: string;
}

interface DevInstructionAckData {
  instructionId: string;
  status: string;
  responseNotes?: string;
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
    case "dev.instruction":
      return handleDevInstruction(payload.data as DevInstructionData, payload.sourceApp);
    case "dev.instruction.ack":
      return handleDevInstructionAck(payload.data as DevInstructionAckData);
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

/**
 * Handle dev instruction from another Claude
 * Stores the instruction for the local Claude to process
 */
async function handleDevInstruction(
  data: DevInstructionData,
  sourceApp: string
): Promise<{ received: boolean; instructionId: string }> {
  console.log(`[Sync] Dev instruction from ${sourceApp}: ${data.title}`);
  console.log(`[Sync] Priority: ${data.priority || "normal"}, Type: ${data.type}`);
  console.log(`[Sync] Message: ${data.message}`);

  const [instruction] = await db
    .insert(schema.devInstructions)
    .values({
      fromApp: sourceApp,
      toApp: "poassociation",
      type: data.type,
      priority: data.priority || "normal",
      title: data.title,
      message: data.message,
      context: data.context,
      relatedAction: data.relatedAction,
      status: "pending",
    })
    .returning();

  return {
    received: true,
    instructionId: instruction.id,
  };
}

/**
 * Handle acknowledgment of a dev instruction we sent
 */
async function handleDevInstructionAck(
  data: DevInstructionAckData
): Promise<{ updated: boolean }> {
  console.log(`[Sync] Dev instruction ${data.instructionId} acknowledged with status: ${data.status}`);
  if (data.responseNotes) {
    console.log(`[Sync] Response notes: ${data.responseNotes}`);
  }

  await db
    .update(schema.devInstructions)
    .set({
      status: data.status,
      responseNotes: data.responseNotes,
      ...(data.status === "acknowledged"
        ? { acknowledgedAt: new Date() }
        : { implementedAt: new Date() }),
    })
    .where(eq(schema.devInstructions.id, data.instructionId));

  return { updated: true };
}
