import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { McpToken } from "@shared/schema";

export const REVIEWER_ROLES = [
  "poa_board_member",
  "poa_board_contributor",
  "management_manager",
  "management_rep",
  "account_admin",
  "super_admin",
] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

export function isReviewerRole(role: string): role is ReviewerRole {
  return (REVIEWER_ROLES as readonly string[]).includes(role);
}

export interface McpRequestContext {
  tokenId: string;
  userId: string;
  tenantId: string;
  roles: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      mcpCtx?: McpRequestContext;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.get("authorization") || req.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// RFC 9728 §5.1 — 401 responses from a protected resource MUST point clients
// at the resource-metadata URL so they can discover the authorization server.
function setWwwAuthenticate(req: Request, res: Response, error: string, description?: string) {
  const base = `${req.protocol}://${req.get("host")}`;
  const parts = [
    `Bearer realm="poa-mcp"`,
    `resource_metadata="${base}/.well-known/oauth-protected-resource"`,
    `error="${error}"`,
  ];
  if (description) parts.push(`error_description="${description.replace(/"/g, "\\\"")}"`);
  res.setHeader("WWW-Authenticate", parts.join(", "));
}

/**
 * Bearer-token auth middleware for /mcp routes. Looks up the presented token,
 * validates its state, verifies the user still holds a reviewer role in the
 * scoped tenant, and attaches `req.mcpCtx` for downstream tool handlers.
 *
 * Fully disjoint from Passport/Replit session auth — never calls req.login().
 */
export async function bearerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tokenValue = extractBearerToken(req);
  if (!tokenValue) {
    setWwwAuthenticate(req, res, "invalid_request", "Missing bearer token");
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  let tokenRow: McpToken | undefined;
  try {
    tokenRow = await storage.getMcpTokenByValue(tokenValue);
  } catch (err) {
    console.error("[mcp-auth] token lookup failed", err);
    res.status(500).json({ error: "Auth error" });
    return;
  }

  if (!tokenRow || !tokenRow.isActive) {
    setWwwAuthenticate(req, res, "invalid_token", "Invalid or revoked token");
    res.status(401).json({ error: "Invalid or revoked token" });
    return;
  }

  if (tokenRow.expiresAt && tokenRow.expiresAt.getTime() < Date.now()) {
    setWwwAuthenticate(req, res, "invalid_token", "Token expired");
    res.status(401).json({ error: "Token expired" });
    return;
  }

  let userRoles: { role: string }[] = [];
  try {
    userRoles = await storage.getUserRolesForTenant(tokenRow.userId, tokenRow.tenantId);
  } catch (err) {
    console.error("[mcp-auth] role lookup failed", err);
    res.status(500).json({ error: "Auth error" });
    return;
  }

  const roles = userRoles.map((r) => r.role);
  const hasReviewerRole = roles.some(isReviewerRole);
  if (!hasReviewerRole) {
    res.status(403).json({ error: "No reviewer role in scoped tenant" });
    return;
  }

  req.mcpCtx = {
    tokenId: tokenRow.id,
    userId: tokenRow.userId,
    tenantId: tokenRow.tenantId,
    roles,
  };

  // First successful MCP auth from an LLM client → stamp the user's profile so
  // the dashboard can flip from "connect your AI" to "what to ask it". Idempotent
  // (no-op once set) and fire-and-forget so it never adds latency or fails auth.
  void storage
    .markUserMcpConnected(tokenRow.userId)
    .catch((err) => console.error("[mcp-auth] markUserMcpConnected failed", err));

  next();
}

/**
 * Tool-level authorization helper. Re-verifies reviewer access every call so
 * that revoked roles between calls fail closed. When `applicationId` is
 * provided, also confirms the application belongs to the token's tenant —
 * cross-tenant ID lookups return `"forbidden"` to avoid leaking existence.
 */
export async function assertReviewerAccess(
  ctx: McpRequestContext,
  applicationId?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const currentRoles = await storage.getUserRolesForTenant(ctx.userId, ctx.tenantId);
  if (!currentRoles.some((r) => isReviewerRole(r.role))) {
    return { ok: false, reason: "forbidden" };
  }

  if (applicationId) {
    const application = await storage.getApplication(applicationId);
    if (!application || application.tenantId !== ctx.tenantId) {
      return { ok: false, reason: "forbidden" };
    }
  }

  return { ok: true };
}
