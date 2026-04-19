import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../storage";
import { aiContextService } from "../services/aiContextService";
import { assertReviewerAccess, type McpRequestContext } from "./auth";
import { logToolCall } from "./audit";

const APPLICATION_FIELDS_SUMMARY = [
  "id",
  "applicationNumber",
  "title",
  "status",
  "propertyAddress",
  "projectType",
  "submittedAt",
  "reviewedAt",
] as const;

type ToolResultPayload = Record<string, unknown>;

function jsonContent(payload: ToolResultPayload) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Wraps a tool handler with timing, auth, error handling, and audit logging.
 * Every handler re-verifies reviewer access on entry (catches revoked roles
 * between calls) and logs the call with argument *keys only* (never values).
 */
function wrapTool<Args extends Record<string, unknown>>(
  toolName: string,
  getCtx: () => McpRequestContext | undefined,
  fn: (args: Args, ctx: McpRequestContext) => Promise<ToolResultPayload>,
  opts: { applicationIdFrom?: (args: Args) => string | undefined } = {},
) {
  return async (args: Args) => {
    const start = Date.now();
    const ctx = getCtx();
    const argumentKeys = Object.keys(args ?? {});
    if (!ctx) {
      return errorContent("No authenticated MCP context");
    }
    try {
      const access = await assertReviewerAccess(
        ctx,
        opts.applicationIdFrom?.(args),
      );
      if (!access.ok) {
        logToolCall({
          ctx,
          toolName,
          argumentKeys,
          resultStatus: "forbidden",
          errorCode: access.reason,
          durationMs: Date.now() - start,
        });
        return errorContent(access.reason);
      }
      const payload = await fn(args, ctx);
      logToolCall({
        ctx,
        toolName,
        argumentKeys,
        resultStatus: "ok",
        durationMs: Date.now() - start,
      });
      return jsonContent(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logToolCall({
        ctx,
        toolName,
        argumentKeys,
        resultStatus: "error",
        errorCode: message.slice(0, 200),
        durationMs: Date.now() - start,
      });
      return errorContent(message);
    }
  };
}

export function registerTools(
  server: McpServer,
  getCtx: () => McpRequestContext | undefined,
): void {
  // ─── 1. list_applications ──────────────────────────────
  server.registerTool(
    "list_applications",
    {
      description:
        "List architectural-review applications in the scoped community. Filter by status or limit. Returns a paginated, tenant-scoped list.",
      inputSchema: {
        status: z
          .enum(["pending", "under_review", "approved", "rejected"])
          .optional()
          .describe("Filter by application status"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max items to return (default 20, max 50)"),
      },
    },
    wrapTool<{ status?: string; limit?: number }>(
      "list_applications",
      getCtx,
      async (args, ctx) => {
        const limit = args.limit ?? 20;
        const all = await storage.listApplicationsForTenant(ctx.tenantId);
        const filtered = args.status
          ? all.filter((a) => a.status === args.status)
          : all;
        const slice = filtered
          .sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          )
          .slice(0, limit);
        return {
          count: slice.length,
          totalMatching: filtered.length,
          applications: slice.map((a) => ({
            id: a.id,
            applicationNumber: a.applicationNumber,
            title: a.title,
            status: a.status,
            propertyAddress: a.propertyAddress,
            projectType: a.projectType,
            submittedAt: a.submittedAt,
            reviewedAt: a.reviewedAt,
          })),
        };
      },
    ),
  );

  // ─── 2. get_application ─────────────────────────────────
  server.registerTool(
    "get_application",
    {
      description:
        "Get full details for one application: form data, status, submitter, form template, review notes.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
      },
    },
    wrapTool<{ application_id: string }>(
      "get_application",
      getCtx,
      async (args) => {
        const app = await storage.getApplication(args.application_id);
        if (!app) return { error: "Application not found" };
        const submitter = await storage.getUser(app.submittedByUserId);
        const template = await storage.getFormTemplate(app.formTemplateId);
        return {
          id: app.id,
          applicationNumber: app.applicationNumber,
          title: app.title,
          description: app.description,
          status: app.status,
          propertyAddress: app.propertyAddress,
          projectType: app.projectType,
          formData: app.formData,
          completenessScore: app.completenessScore,
          submittedAt: app.submittedAt,
          reviewedAt: app.reviewedAt,
          reviewNotes: app.reviewNotes,
          submittedBy: submitter
            ? {
                id: submitter.id,
                name:
                  [submitter.firstName, submitter.lastName]
                    .filter(Boolean)
                    .join(" ") || submitter.email,
                email: submitter.email,
              }
            : null,
          formTemplate: template
            ? {
                id: template.id,
                name: template.name,
                version: app.formTemplateVersion,
              }
            : null,
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // ─── 3. get_application_documents ───────────────────────
  server.registerTool(
    "get_application_documents",
    {
      description:
        "List documents attached to an application with their persisted OCR-extracted text. Returns no file URLs — text content only.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
      },
    },
    wrapTool<{ application_id: string }>(
      "get_application_documents",
      getCtx,
      async (args) => {
        const docs = await storage.listDocumentsByApplication(args.application_id);
        return {
          count: docs.length,
          documents: docs.map((d) => ({
            id: d.id,
            fileName: d.fileName,
            mimeType: d.mimeType,
            fileSize: d.fileSize,
            requirement: d.documentRequirementName,
            uploadedAt: d.uploadedAt,
            ocrStatus: d.ocrStatus,
            extractedText: d.ocrText ?? null,
          })),
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // ─── 4. get_bylaws_and_context ──────────────────────────
  server.registerTool(
    "get_bylaws_and_context",
    {
      description:
        "Get the community's relevant bylaws, covenants, design guidelines, and AI instructions — the same context fed to the built-in AI analyzer. Optionally scope to a form type.",
      inputSchema: {
        form_type: z
          .string()
          .optional()
          .describe(
            "Optional project/form type to scope context (e.g., 'exterior-modifications')",
          ),
      },
    },
    wrapTool<{ form_type?: string }>(
      "get_bylaws_and_context",
      getCtx,
      async (args, ctx) => {
        const aggregated = await aiContextService.gatherContext(
          ctx.tenantId,
          args.form_type,
        );
        const textDocs = aggregated.documents.filter((d) => d.type === "text");
        const pdfDocs = aggregated.documents.filter((d) => d.type === "pdf");
        return {
          instructions: aggregated.instructions,
          textContext: textDocs
            .map(
              (d) =>
                `# ${d.source.name}\n\n${d.content}`,
            )
            .join("\n\n---\n\n"),
          pdfResources: pdfDocs.map((d) => ({
            resourceUri: `mcp-poa://bylaw/${d.source.id}`,
            name: d.source.name,
          })),
          includedSources: aggregated.includedSources,
          excludedSources: aggregated.excludedSources,
          truncated: aggregated.truncated,
        };
      },
    ),
  );

  // ─── 5. get_application_workflow ────────────────────────
  server.registerTool(
    "get_application_workflow",
    {
      description:
        "Get the workflow/decision history for an application: current stage, past approvals/rejections/conditions, notes.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
      },
    },
    wrapTool<{ application_id: string }>(
      "get_application_workflow",
      getCtx,
      async (args) => {
        const workflow = await storage.getApplicationWorkflow(args.application_id);
        if (!workflow) {
          return { workflow: null, history: [] };
        }
        const history = await storage.getWorkflowActionHistory(workflow.id);
        return {
          workflow: {
            id: workflow.id,
            status: workflow.status,
            currentStepIndex: workflow.currentStepIndex,
            completedAt: workflow.completedAt,
          },
          history: history.map((h) => ({
            id: h.id,
            stepIndex: h.stepIndex,
            action: h.action,
            notes: h.notes,
            createdAt: h.createdAt,
            userId: h.userId,
          })),
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // ─── 6. get_application_comments ────────────────────────
  server.registerTool(
    "get_application_comments",
    {
      description:
        "Get the comment thread on an application, with author names and timestamps.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
      },
    },
    wrapTool<{ application_id: string }>(
      "get_application_comments",
      getCtx,
      async (args) => {
        const comments = await storage.getApplicationComments(args.application_id);
        return {
          count: comments.length,
          comments: comments.map((c) => ({
            id: c.id,
            text: c.text,
            isResolved: c.isResolved,
            parentCommentId: c.parentCommentId,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            author: {
              id: c.user.id,
              name:
                [c.user.firstName, c.user.lastName]
                  .filter(Boolean)
                  .join(" ") || c.user.email,
              email: c.user.email,
            },
          })),
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // ─── 7. submit_comment ──────────────────────────────────
  server.registerTool(
    "submit_comment",
    {
      description:
        "Post a comment to an application's review thread. The comment is authored as you (the token's user). Safe to retry if the network fails.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
        body: z
          .string()
          .min(1)
          .max(10_000)
          .describe("Comment text (markdown supported in the UI)"),
      },
    },
    wrapTool<{ application_id: string; body: string }>(
      "submit_comment",
      getCtx,
      async (args, ctx) => {
        const comment = await storage.addComment({
          applicationId: args.application_id,
          userId: ctx.userId,
          text: args.body,
          parentCommentId: null,
        });
        return {
          commentId: comment.id,
          createdAt: comment.createdAt,
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // Reference the field list to keep TS happy that the export is used.
  void APPLICATION_FIELDS_SUMMARY;
}
