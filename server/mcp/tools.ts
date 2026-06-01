import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { storage } from "../storage";
import { aiContextService } from "../services/aiContextService";
import { azureBlobStorage } from "../azureBlobStorage";
import { assertReviewerAccess, type McpRequestContext } from "./auth";
import { logToolCall } from "./audit";
import { appBaseUrl, guidelineViewUrl, signBlobUrl, signDocumentUrl } from "./urls";
import { rasterizePdf } from "../services/pdfRasterService";

// Cap on PDF pages we rasterize into a single tool result (token budget).
const MAX_RASTER_PAGES_BYLAWS = 6;
const MAX_RASTER_PAGES_DOCUMENT = 8;

// Research-dossier upload guardrails.
const DOSSIER_MAX_ITEMS = 25;
const DOSSIER_MAX_ITEM_BYTES = 8 * 1024 * 1024; // 8 MB per binary item
const DOSSIER_BLOB_CONTAINER = "application-documents";
const DOSSIER_ALLOWED_BINARY_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * Fetch binary bytes from a client-supplied URL for a dossier item.
 *
 * SECURITY: the URL comes from an external MCP client, so this is an SSRF
 * surface. We restrict to http(s) and block obvious internal hosts/literal
 * private IPs, cap the size, and time out. NOTE: this does not resolve DNS to
 * defeat rebinding/hostnames that point at internal ranges — flagged for the
 * security review (Officer Allen) before this ships to prod.
 */
async function fetchBinaryFromUrl(
  rawUrl: string,
  maxBytes: number,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid url: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs may be fetched");
  }
  const host = parsed.hostname.toLowerCase();
  const blockedHost =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fd") ||
    host.startsWith("fe80");
  if (blockedHost) {
    throw new Error("Refusing to fetch an internal/private address");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(rawUrl, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Fetch failed (HTTP ${res.status}) for ${rawUrl}`);
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > maxBytes) {
      throw new Error(`Remote file exceeds the ${maxBytes} byte limit`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`Remote file exceeds the ${maxBytes} byte limit`);
    }
    return { buffer, contentType: res.headers.get("content-type") };
  } finally {
    clearTimeout(timeout);
  }
}

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

// A handler may attach extra MCP content blocks (labels + images) to append
// after the JSON text block by setting `__appendBlocks` on its return payload.
// Used to return rasterized PDF pages / image documents as image content blocks
// — the only reliable way to get visual docs to the claude.ai connector.
type AppendBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const APPEND_BLOCKS_KEY = "__appendBlocks";

function jsonContent(payload: ToolResultPayload) {
  const appendBlocks = (payload as Record<string, unknown>)[APPEND_BLOCKS_KEY] as
    | AppendBlock[]
    | undefined;
  if (appendBlocks) {
    delete (payload as Record<string, unknown>)[APPEND_BLOCKS_KEY];
  }
  const content: Array<AppendBlock> = [
    { type: "text", text: JSON.stringify(payload, null, 2) },
  ];
  if (appendBlocks?.length) {
    content.push(...appendBlocks);
  }
  return { content };
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
        "List documents attached to an application with their persisted OCR-extracted text. Image documents and PDF pages (surveys, site plans, photos) are ALSO returned inline as image content blocks below the JSON — read them directly; do not fetch a URL. By default the first pages of each PDF are rendered; `documents[].totalPages` + `hasMorePages` tell you how far to walk. To read a specific multi-page plan, call again with `document_id` + `page_offset`/`page_limit` (window) or `pages` (e.g. [3,4]) to target sheets. A `viewUrl`/`signedUrl` are included for human/back-compat use only.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
        document_id: z
          .string()
          .optional()
          .describe(
            "Scope image rendering to ONE document (its `documents[].id`). Other docs still return metadata/OCR text but no new images.",
          ),
        page_offset: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-based first PDF page to rasterize (default 1)."),
        page_limit: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe("Pages to rasterize per PDF this call (default 8, hard max 12)."),
        pages: z
          .array(z.number().int().min(1))
          .max(24)
          .optional()
          .describe(
            "Explicit 1-based PDF page numbers to rasterize — overrides page_offset/page_limit. Use with document_id to target specific sheets.",
          ),
      },
    },
    wrapTool<{
      application_id: string;
      document_id?: string;
      page_offset?: number;
      page_limit?: number;
      pages?: number[];
    }>(
      "get_application_documents",
      getCtx,
      async (args) => {
        const docs = await storage.listDocumentsByApplication(args.application_id);
        const appendBlocks: AppendBlock[] = [];
        const MAX_TOTAL_IMAGES = 20; // overall token-budget guard for one result
        let imageCount = 0;

        const out = [];
        for (const d of docs) {
          const mime = d.mimeType ?? "";
          const targeted = !args.document_id || args.document_id === d.id;
          let inlineImages = 0;
          let totalPages: number | null = null;
          let pageOffset: number | null = null;
          let hasMorePages = false;
          try {
            if (
              targeted &&
              azureBlobStorage.isAvailable() &&
              d.blobPath &&
              d.containerName &&
              imageCount < MAX_TOTAL_IMAGES
            ) {
              if (mime.startsWith("image/")) {
                // The document IS an image — return it directly.
                const buf = await azureBlobStorage.downloadFile(d.containerName, d.blobPath);
                appendBlocks.push({ type: "text", text: `Document "${d.fileName}":` });
                appendBlocks.push({ type: "image", data: buf.toString("base64"), mimeType: mime });
                inlineImages = 1;
                imageCount += 1;
              } else if (mime === "application/pdf") {
                // Rasterize the selected window/pages so plans can be read visually.
                const buf = await azureBlobStorage.downloadFile(d.containerName, d.blobPath);
                const remaining = MAX_TOTAL_IMAGES - imageCount;
                const raster = await rasterizePdf(buf, {
                  pageOffset: args.page_offset,
                  pageLimit: args.page_limit ?? MAX_RASTER_PAGES_DOCUMENT,
                  pages: args.pages,
                  hardMax: remaining,
                });
                totalPages = raster.totalPages;
                pageOffset = raster.pageOffset;
                hasMorePages = raster.hasMore;
                if (raster.pages.length > 0) {
                  const pageList = raster.pages.map((p) => p.page).join(", ");
                  appendBlocks.push({
                    type: "text",
                    text: `Document "${d.fileName}" — page(s) ${pageList} of ${raster.totalPages}${raster.hasMore ? ` (more — call again with document_id "${d.id}" + page_offset/pages)` : ""}:`,
                  });
                  for (const pg of raster.pages) {
                    appendBlocks.push({ type: "text", text: `${d.fileName} — page ${pg.page}:` });
                    appendBlocks.push({ type: "image", data: pg.base64, mimeType: pg.mimeType });
                  }
                  inlineImages = raster.pages.length;
                  imageCount += raster.pages.length;
                }
              }
            }
          } catch (err) {
            console.error(`[MCP documents] image render failed for "${d.fileName}":`, err);
          }

          out.push({
            id: d.id,
            fileName: d.fileName,
            mimeType: d.mimeType,
            fileSize: d.fileSize,
            requirement: d.documentRequirementName,
            uploadedAt: d.uploadedAt,
            ocrStatus: d.ocrStatus,
            extractedText: d.ocrText ?? null,
            // Count of image blocks for this doc appended below the JSON + walking metadata.
            inlineImages,
            totalPages,
            pageOffset,
            hasMorePages,
            // Browser link for the human reviewer (requires a portal session).
            viewUrl: `${appBaseUrl()}/api/documents/${d.id}/preview`,
            // Short-lived signed link (human/back-compat; not Claude-fetchable on the connector).
            signedUrl: signDocumentUrl(d.id),
          });
        }

        return {
          count: docs.length,
          imagesAttached: imageCount,
          imagesCapped: imageCount >= MAX_TOTAL_IMAGES,
          documents: out,
          [APPEND_BLOCKS_KEY]: appendBlocks,
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
        "Get the community's relevant bylaws, covenants, design guidelines, and AI instructions. FULL text of digital docs is INLINE in `documents[].text`. SCANNED/image-only docs (text empty) have their pages rasterized to image blocks appended after the JSON — read those directly; do not fetch any URL. For long docs, the first pages (cover/TOC) come back by default and `documents[].totalPages` + `hasMorePages` tell you how far to walk: call again with `document_id` + `page_offset`/`page_limit` to window deeper, or `pages` (e.g. [24,25,40]) to jump to known sections from the TOC.",
      inputSchema: {
        form_type: z
          .string()
          .optional()
          .describe(
            "Optional project/form type to scope context (e.g., 'pool', 'exterior-modifications').",
          ),
        document_id: z
          .string()
          .optional()
          .describe(
            "Scope page-image rendering to ONE governing document (its `documents[].id` from a prior call). Other docs still return their text but no new images.",
          ),
        page_offset: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "1-based first page to rasterize for scanned docs (default 1). Use to walk past cover/TOC into later sections.",
          ),
        page_limit: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe("Pages to rasterize this call (default 6, hard max 12)."),
        pages: z
          .array(z.number().int().min(1))
          .max(24)
          .optional()
          .describe(
            "Explicit 1-based page numbers to rasterize (e.g. [24,25,40]) — overrides page_offset/page_limit. Most token-efficient once you know section pages from the TOC.",
          ),
      },
    },
    wrapTool<{
      form_type?: string;
      document_id?: string;
      page_offset?: number;
      page_limit?: number;
      pages?: number[];
    }>(
      "get_bylaws_and_context",
      getCtx,
      async (args, ctx) => {
        const review = await aiContextService.gatherReviewText(
          ctx.tenantId,
          args.form_type,
        );

        // Scanned/image-only PDFs (no native text layer) get a selected window
        // (or explicit pages) rasterized and appended as image content blocks.
        // Digital PDFs / text docs keep their inline text.
        const appendBlocks: AppendBlock[] = [];
        const docs = [] as Array<Record<string, unknown>>;
        for (const d of review.documents) {
          const hasText = d.text.trim().length > 0;
          const targeted = !args.document_id || args.document_id === d.id;
          let pageImages = 0;
          let totalPages: number | null = null;
          let pageOffset: number | null = null;
          let hasMorePages = false;
          if (!hasText && d.type === "pdf" && d.pdfBase64 && targeted) {
            try {
              const raster = await rasterizePdf(Buffer.from(d.pdfBase64, "base64"), {
                pageOffset: args.page_offset,
                pageLimit: args.page_limit ?? MAX_RASTER_PAGES_BYLAWS,
                pages: args.pages,
              });
              totalPages = raster.totalPages;
              pageOffset = raster.pageOffset;
              pageImages = raster.pagesReturned;
              hasMorePages = raster.hasMore;
              if (raster.pages.length > 0) {
                const pageList = raster.pages.map((p) => p.page).join(", ");
                appendBlocks.push({
                  type: "text",
                  text: `=== "${d.name}" — page(s) ${pageList} of ${raster.totalPages}. No extractable text layer; read the rules from these images.${raster.hasMore ? ` More pages exist — call again with document_id "${d.id}" and page_offset/pages to read further.` : ""} ===`,
                });
                for (const pg of raster.pages) {
                  appendBlocks.push({ type: "text", text: `${d.name} — page ${pg.page}:` });
                  appendBlocks.push({ type: "image", data: pg.base64, mimeType: pg.mimeType });
                }
              }
            } catch (err) {
              console.error(`[MCP bylaws] rasterize failed for "${d.name}":`, err);
            }
          }
          docs.push({
            id: d.id,
            name: d.name,
            description: d.description,
            type: d.type,
            text: d.text,
            // Page-image walking metadata (scanned docs). Read appended image blocks below.
            pageImages,
            totalPages,
            pageOffset,
            hasMorePages,
            // Browser link for a human reading the raw result; NOT fetchable by Claude.
            viewUrl: guidelineViewUrl(ctx.tenantId, d.id),
            truncated: d.truncated,
          });
        }

        return {
          instructions: review.instructions,
          // Full inline text per governing document — the primary, Claude-readable surface.
          documents: docs,
          // Back-compat: a single concatenated blob of all document text.
          textContext: review.documents
            .map((d) => `# ${d.name}\n\n${d.text}`)
            .join("\n\n---\n\n"),
          includedSources: review.documents.map((d) => d.name),
          // Sources whose content could not be fetched/extracted (errors), not size drops.
          failedSources: review.failedSources,
          formTypeScope: args.form_type ?? null,
          documentIdScope: args.document_id ?? null,
          // True only if an individual document's text was capped (chunked), never source-dropped.
          truncated: review.documents.some((d) => d.truncated),
          imagePagesAttached: appendBlocks.filter((b) => b.type === "image").length,
          [APPEND_BLOCKS_KEY]: appendBlocks,
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

  // ─── 8. add_research_dossier_entry ──────────────────────
  const dossierItemSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("link"),
      label: z.string().min(1).max(300),
      url: z.string().url(),
      note: z.string().max(2_000).optional(),
    }),
    z.object({
      type: z.literal("text"),
      label: z.string().min(1).max(300),
      content: z.string().min(1).max(50_000).describe("Markdown supported"),
    }),
    z.object({
      type: z.enum(["image", "file"]),
      label: z.string().min(1).max(300),
      fileName: z.string().min(1).max(300),
      mimeType: z.string().min(1).max(120),
      contentBase64: z
        .string()
        .min(1)
        .optional()
        .describe(
          "Base64-encoded file bytes (≤8MB). Provide EITHER contentBase64 OR url (exactly one). Use this for small artifacts you generated yourself.",
        ),
      url: z
        .string()
        .url()
        .optional()
        .describe(
          "Public http(s) URL the server will fetch and store. Provide EITHER url OR contentBase64 (exactly one). Use this for files hosted somewhere public.",
        ),
      caption: z.string().max(2_000).optional(),
    }),
  ]);

  server.registerTool(
    "add_research_dossier_entry",
    {
      description:
        "Contribute external research about the property to the application's Research Dossier (a new entry). Use this to record findings you gathered (e.g. county tax records, plat/plot lines, permits) as a mix of items: links, markdown text, images, and files. Findings are reviewer reference material — clearly labeled as AI-gathered and unverified until a board member reviews them. Always cite sources via link items or the `url` of file items.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
        title: z.string().min(1).max(300).describe("Short title for this research entry"),
        summary: z.string().max(5_000).optional().describe("Optional 1-2 sentence abstract"),
        items: z
          .array(dossierItemSchema)
          .min(1)
          .max(DOSSIER_MAX_ITEMS)
          .describe("Research items: link | text | image | file"),
      },
    },
    wrapTool<{
      application_id: string;
      title: string;
      summary?: string;
      items: z.infer<typeof dossierItemSchema>[];
    }>(
      "add_research_dossier_entry",
      getCtx,
      async (args, ctx) => {
        if (args.items.length > DOSSIER_MAX_ITEMS) {
          return { error: `Too many items (max ${DOSSIER_MAX_ITEMS})` };
        }

        const entry = await storage.createDossierEntry({
          applicationId: args.application_id,
          tenantId: ctx.tenantId,
          title: args.title,
          summary: args.summary ?? null,
          source: "mcp",
          mcpClientName: null,
          createdByUserId: ctx.userId,
          verifiedByUserId: null,
          verifiedAt: null,
        });

        const created: Array<Record<string, unknown>> = [];
        for (let i = 0; i < args.items.length; i++) {
          const item = args.items[i];
          if (item.type === "link") {
            const row = await storage.addDossierItem({
              entryId: entry.id,
              tenantId: ctx.tenantId,
              type: "link",
              label: item.label,
              caption: item.note ?? null,
              url: item.url,
              content: null,
              blobPath: null,
              containerName: null,
              fileName: null,
              mimeType: null,
              fileSize: null,
              position: i,
            });
            created.push({ id: row.id, type: row.type });
          } else if (item.type === "text") {
            const row = await storage.addDossierItem({
              entryId: entry.id,
              tenantId: ctx.tenantId,
              type: "text",
              label: item.label,
              caption: null,
              url: null,
              content: item.content,
              blobPath: null,
              containerName: null,
              fileName: null,
              mimeType: null,
              fileSize: null,
              position: i,
            });
            created.push({ id: row.id, type: row.type });
          } else {
            // image | file — obtain bytes from inline base64 OR a fetched
            // url (exactly one), validate, upload to Azure.
            if (!DOSSIER_ALLOWED_BINARY_MIME.has(item.mimeType)) {
              return { error: `Unsupported mimeType "${item.mimeType}" for item "${item.label}"` };
            }
            const hasBase64 = !!item.contentBase64;
            const hasUrl = !!item.url;
            if (hasBase64 === hasUrl) {
              return {
                error: `Item "${item.label}" must include exactly one of contentBase64 or url`,
              };
            }
            if (!azureBlobStorage.isAvailable()) {
              return { error: "Document storage is not configured" };
            }
            let buffer: Buffer;
            if (hasBase64) {
              buffer = Buffer.from(item.contentBase64!, "base64");
              if (buffer.length === 0) {
                return { error: `Item "${item.label}" has empty or invalid base64 content` };
              }
            } else {
              const fetched = await fetchBinaryFromUrl(item.url!, DOSSIER_MAX_ITEM_BYTES);
              buffer = fetched.buffer;
              if (buffer.length === 0) {
                return { error: `Fetched url for item "${item.label}" returned no content` };
              }
            }
            if (buffer.length > DOSSIER_MAX_ITEM_BYTES) {
              return { error: `Item "${item.label}" exceeds the ${DOSSIER_MAX_ITEM_BYTES} byte limit` };
            }
            const itemId = randomUUID();
            const ext = item.fileName.includes(".") ? item.fileName.split(".").pop() : "bin";
            const blobPath = `${ctx.tenantId}/${args.application_id}/dossier/${itemId}.${ext}`;
            const upload = await azureBlobStorage.uploadFile(
              DOSSIER_BLOB_CONTAINER,
              buffer,
              item.fileName,
              item.mimeType,
              blobPath,
            );
            const row = await storage.addDossierItem({
              id: itemId,
              entryId: entry.id,
              tenantId: ctx.tenantId,
              type: item.type,
              label: item.label,
              caption: item.caption ?? null,
              // Preserve the source URL for provenance when we fetched it.
              url: item.url ?? null,
              content: null,
              blobPath: upload.blobName,
              containerName: upload.containerName,
              fileName: item.fileName,
              mimeType: upload.contentType,
              fileSize: upload.size,
              position: i,
            } as any);
            created.push({
              id: row.id,
              type: row.type,
              signedUrl: signBlobUrl("dossier-item", row.id),
            });
          }
        }

        return {
          entryId: entry.id,
          title: entry.title,
          itemCount: created.length,
          items: created,
          note: "Recorded as AI-gathered, unverified research. A board member can mark it reviewed in the portal.",
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // ─── 9. get_research_dossier ────────────────────────────
  server.registerTool(
    "get_research_dossier",
    {
      description:
        "Get the application's existing Research Dossier — prior research entries and their items (links, text, images, files). Image/file items include a short-lived `signedUrl` you can fetch. Useful to review what's already been gathered before adding more.",
      inputSchema: {
        application_id: z.string().describe("Application ID (UUID)"),
      },
    },
    wrapTool<{ application_id: string }>(
      "get_research_dossier",
      getCtx,
      async (args) => {
        const entries = await storage.getDossierForApplication(args.application_id);
        return {
          count: entries.length,
          entries: entries.map((e) => ({
            id: e.id,
            title: e.title,
            summary: e.summary,
            source: e.source,
            mcpClientName: e.mcpClientName,
            verified: !!e.verifiedAt,
            createdAt: e.createdAt,
            items: e.items.map((it) => ({
              id: it.id,
              type: it.type,
              label: it.label,
              caption: it.caption,
              url: it.url,
              content: it.content,
              fileName: it.fileName,
              mimeType: it.mimeType,
              signedUrl:
                it.type === "image" || it.type === "file"
                  ? signBlobUrl("dossier-item", it.id)
                  : undefined,
            })),
          })),
        };
      },
      { applicationIdFrom: (args) => args.application_id },
    ),
  );

  // Reference the field list to keep TS happy that the export is used.
  void APPLICATION_FIELDS_SUMMARY;
}
