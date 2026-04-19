import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { storage } from "../storage";
import { azureBlobStorage } from "../azureBlobStorage";
import { assertReviewerAccess, type McpRequestContext } from "./auth";

const BYLAW_URI_SCHEME = "mcp-poa";
const BYLAW_URI_HOST = "bylaw";

/**
 * Registers MCP resources for bylaw/covenant PDFs. Exposing them as resources
 * (rather than embedding base64 in tool responses) lets Claude Desktop cache
 * them natively and keeps tool responses small.
 *
 * URI format: `mcp-poa://bylaw/{aiContextSourceId}`
 */
export function registerResources(
  server: McpServer,
  getCtx: () => McpRequestContext | undefined,
): void {
  server.registerResource(
    "bylaw",
    new ResourceTemplate(`${BYLAW_URI_SCHEME}://${BYLAW_URI_HOST}/{sourceId}`, {
      list: async () => {
        const ctx = getCtx();
        if (!ctx) return { resources: [] };
        const access = await assertReviewerAccess(ctx);
        if (!access.ok) return { resources: [] };
        const sources = await storage.getActiveAiContextSourcesForForm(ctx.tenantId);
        const pdfSources = sources.filter(
          (s) =>
            s.sourceType === "uploaded_document" &&
            s.mimeType === "application/pdf" &&
            !!s.blobPath &&
            !!s.containerName,
        );
        return {
          resources: pdfSources.map((s) => ({
            uri: `${BYLAW_URI_SCHEME}://${BYLAW_URI_HOST}/${s.id}`,
            name: s.name,
            description: s.description ?? undefined,
            mimeType: "application/pdf",
          })),
        };
      },
    }),
    {
      title: "Community Bylaws & Covenants",
      description:
        "PDF bylaws, covenants, and design guidelines for the community scoped by your token.",
      mimeType: "application/pdf",
    },
    async (uri, variables) => {
      const ctx = getCtx();
      if (!ctx) {
        throw new Error("No authenticated MCP context");
      }
      const access = await assertReviewerAccess(ctx);
      if (!access.ok) {
        throw new Error(access.reason);
      }
      const sourceId = String(variables.sourceId);
      const sources = await storage.getActiveAiContextSourcesForForm(ctx.tenantId);
      const source = sources.find((s) => s.id === sourceId);
      if (
        !source ||
        source.sourceType !== "uploaded_document" ||
        !source.blobPath ||
        !source.containerName
      ) {
        throw new Error("Resource not found");
      }

      const buffer = await azureBlobStorage.downloadFile(
        source.containerName,
        source.blobPath,
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: source.mimeType ?? "application/pdf",
            blob: buffer.toString("base64"),
          },
        ],
      };
    },
  );
}
