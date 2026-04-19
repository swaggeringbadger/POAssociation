import { storage } from "../storage";
import type { McpRequestContext } from "./auth";

export interface ToolCallAuditEntry {
  ctx: McpRequestContext;
  toolName: string;
  argumentKeys: string[];
  resultStatus: "ok" | "error" | "forbidden";
  errorCode?: string;
  durationMs: number;
}

/**
 * Fire-and-forget audit writer. Also bumps the token's `lastUsedAt` +
 * `accessCount`. Runs on the microtask queue via `setImmediate` so a slow
 * insert never blocks a tool response. Errors are logged but swallowed.
 */
export function logToolCall(entry: ToolCallAuditEntry): void {
  setImmediate(() => {
    void (async () => {
      try {
        await Promise.all([
          storage.logMcpToolCall({
            tokenId: entry.ctx.tokenId,
            userId: entry.ctx.userId,
            tenantId: entry.ctx.tenantId,
            toolName: entry.toolName,
            argumentKeys: entry.argumentKeys,
            resultStatus: entry.resultStatus,
            errorCode: entry.errorCode ?? null,
            durationMs: entry.durationMs,
          }),
          storage.touchMcpToken(entry.ctx.tokenId),
        ]);
      } catch (err) {
        console.error("[mcp-audit] write failed", err);
      }
    })();
  });
}
