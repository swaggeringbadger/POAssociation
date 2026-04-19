import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { bearerAuthMiddleware } from "./auth";
import {
  authFailureLimiter,
  perIpLimiter,
  perTokenHourLimiter,
  perTokenMinuteLimiter,
} from "./rateLimit";
import { registerTools } from "./tools";
import { registerResources } from "./resources";

/**
 * Builds a fresh MCP server + stateless Streamable HTTP transport for a single
 * request. Stateless mode means no in-memory session map to leak across
 * Replit redeploys. The same shape is recommended by the SDK docs for
 * "stateless" deployments.
 */
function buildServer(getCtx: () => ReturnType<() => Request["mcpCtx"]>) {
  const server = new McpServer(
    { name: "poa-reviewer", version: "1.0.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions: [
        "You are helping review architectural-review applications for a homeowners association.",
        "Use list_applications to browse, get_application for details, get_application_documents for uploaded attachments (OCR text),",
        "get_bylaws_and_context for the community's bylaws/covenants/design guidelines, get_application_workflow for decision history,",
        "get_application_comments for the existing review thread, and submit_comment to record your notes back to the app.",
        "",
        "Formal decisions (approve/reject/table) stay in the web UI — you cannot record those through this channel.",
      ].join("\n"),
    },
  );
  registerTools(server, getCtx);
  registerResources(server, getCtx);
  return server;
}

export function createMcpRouter(): Router {
  const router = Router();

  // Defense-in-depth per-IP cap before any auth work.
  router.use(perIpLimiter);

  // POST /mcp — the Streamable HTTP JSON-RPC endpoint. Everything else 405s.
  router.post(
    "/",
    authFailureLimiter,
    bearerAuthMiddleware,
    perTokenMinuteLimiter,
    perTokenHourLimiter,
    async (req: Request, res: Response) => {
      try {
        const ctx = req.mcpCtx;
        const server = buildServer(() => ctx);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless
        });

        res.on("close", () => {
          void transport.close();
          void server.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("[mcp] request handler error", err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    },
  );

  // Stateless mode doesn't support GET (SSE resume) or DELETE (session term).
  router.all("/", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. Use POST for JSON-RPC.",
      },
      id: null,
    });
  });

  return router;
}
