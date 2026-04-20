import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { isReviewerRole } from "../mcp/auth";

// ===================================================================
// MCP OAuth 2.1 authorization server
// ===================================================================
// Minimal spike implementation of the flow Claude Desktop / Cursor /
// claude.ai expect when they connect to a remote MCP server. Clients
// dynamically register (RFC 7591), run authorization-code + PKCE S256,
// and receive an opaque bearer token that plugs into the existing
// /mcp bearerAuthMiddleware.
//
// Federates identity to the existing Replit Auth session — /oauth/authorize
// redirects unauthed users through /api/login first.
// ===================================================================

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes per OAuth 2.1

function canonicalIssuer(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

function resolveUserId(req: Request): string | null {
  const sessionUserId = (req as any).session?.userId;
  if (sessionUserId) return sessionUserId;
  const passportUser = req.user as any;
  return passportUser?.claims?.sub ?? null;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sha256(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

// ---------- /.well-known/oauth-protected-resource (RFC 9728) ----------
export function protectedResourceMetadata(req: Request, res: Response) {
  const issuer = canonicalIssuer(req);
  res.json({
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:review"],
    resource_documentation: `${issuer}/`,
  });
}

// ---------- /.well-known/oauth-authorization-server (RFC 8414) ----------
export function authorizationServerMetadata(req: Request, res: Response) {
  const issuer = canonicalIssuer(req);
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"], // public PKCE clients
    scopes_supported: ["mcp:review"],
  });
}

// ---------- POST /oauth/register (RFC 7591) ----------
const registerBodySchema = z.object({
  client_name: z.string().min(1).max(200).default("MCP Client"),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
  scope: z.string().optional(),
});

async function handleRegister(req: Request, res: Response) {
  const parsed = registerBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_client_metadata", error_description: parsed.error.message });
    return;
  }

  // Accept http://localhost and http://127.0.0.1 for desktop app loopback flows;
  // require https everywhere else.
  for (const uri of parsed.data.redirect_uris) {
    try {
      const u = new URL(uri);
      const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
      if (u.protocol !== "https:" && !loopback) {
        res.status(400).json({
          error: "invalid_redirect_uri",
          error_description: `redirect_uri must be https (or loopback): ${uri}`,
        });
        return;
      }
    } catch {
      res.status(400).json({ error: "invalid_redirect_uri" });
      return;
    }
  }

  const client = await storage.createOauthClient({
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
    scope: parsed.data.scope ?? null,
  });

  res.status(201).json({
    client_id: client.id,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    scope: client.scope ?? undefined,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
  });
}

// ---------- GET /oauth/authorize ----------
const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  state: z.string().optional(),
  scope: z.string().optional(),
  resource: z.string().url().optional(),
});

async function handleAuthorize(req: Request, res: Response) {
  const parsed = authorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).type("text/plain").send(`invalid_request: ${parsed.error.message}`);
    return;
  }
  const q = parsed.data;

  const client = await storage.getOauthClient(q.client_id);
  if (!client) {
    res.status(400).type("text/plain").send("invalid_client");
    return;
  }
  if (!client.redirectUris.includes(q.redirect_uri)) {
    res.status(400).type("text/plain").send("invalid_redirect_uri");
    return;
  }

  // Step 1: authentication gate. Bounce through existing /api/login, which
  // supports returnTo and restores the session on callback.
  const userId = resolveUserId(req);
  if (!userId) {
    const returnTo = `${req.originalUrl}`; // /oauth/authorize?...
    const loginUrl = `/api/login?returnTo=${encodeURIComponent(returnTo)}`;
    res.redirect(loginUrl);
    return;
  }

  // Step 2: tenant selection. For the spike, auto-pick the first tenant where
  // the user holds a reviewer role. Phase 2 will render a consent page with a
  // tenant picker.
  const memberships = await storage.getUserTenants(userId);
  const reviewerMembership = memberships.find((m) => isReviewerRole(m.role));
  if (!reviewerMembership) {
    const redirect = new URL(q.redirect_uri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "User has no reviewer role in any tenant");
    if (q.state) redirect.searchParams.set("state", q.state);
    res.redirect(redirect.toString());
    return;
  }

  // Step 3: mint and persist the authorization code.
  const code = base64url(crypto.randomBytes(32));
  await storage.createAuthorizationCode({
    code,
    clientId: client.id,
    userId,
    tenantId: reviewerMembership.tenantId,
    redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge,
    codeChallengeMethod: q.code_challenge_method,
    scope: q.scope ?? null,
    resource: q.resource ?? null,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });

  const redirect = new URL(q.redirect_uri);
  redirect.searchParams.set("code", code);
  if (q.state) redirect.searchParams.set("state", q.state);
  res.redirect(redirect.toString());
}

// ---------- POST /oauth/token ----------
const tokenBodySchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  client_id: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
});

function tokenError(res: Response, status: number, code: string, description?: string) {
  res.status(status).json({ error: code, ...(description ? { error_description: description } : {}) });
}

async function handleToken(req: Request, res: Response) {
  const parsed = tokenBodySchema.safeParse(req.body);
  if (!parsed.success) {
    tokenError(res, 400, "invalid_request", parsed.error.message);
    return;
  }
  const b = parsed.data;

  const client = await storage.getOauthClient(b.client_id);
  if (!client) {
    tokenError(res, 401, "invalid_client");
    return;
  }
  if (!client.redirectUris.includes(b.redirect_uri)) {
    tokenError(res, 400, "invalid_grant", "redirect_uri mismatch");
    return;
  }

  // Atomic one-shot consumption. If the code was already used, this returns
  // undefined and we fail closed.
  const authCode = await storage.consumeAuthorizationCode(b.code);
  if (!authCode) {
    tokenError(res, 400, "invalid_grant", "code already used or unknown");
    return;
  }
  if (authCode.clientId !== client.id) {
    tokenError(res, 400, "invalid_grant", "client_id mismatch");
    return;
  }
  if (authCode.redirectUri !== b.redirect_uri) {
    tokenError(res, 400, "invalid_grant", "redirect_uri mismatch");
    return;
  }
  if (authCode.expiresAt.getTime() < Date.now()) {
    tokenError(res, 400, "invalid_grant", "code expired");
    return;
  }

  // PKCE S256: base64url(SHA256(code_verifier)) must equal stored challenge.
  const computedChallenge = base64url(sha256(b.code_verifier));
  if (computedChallenge !== authCode.codeChallenge) {
    tokenError(res, 400, "invalid_grant", "PKCE verification failed");
    return;
  }

  // Re-verify reviewer role at token-mint time (role may have been revoked
  // between /authorize and /token).
  const roles = await storage.getUserRolesForTenant(authCode.userId, authCode.tenantId);
  if (!roles.some((r) => isReviewerRole(r.role))) {
    tokenError(res, 403, "access_denied", "User no longer has a reviewer role in this tenant");
    return;
  }

  // Revoke any previous OAuth token for this (user, tenant, client) before
  // minting the new one — keeps the partial unique index happy and makes
  // re-authorization a one-liner for the user.
  await storage.deactivateOauthTokensForClient(authCode.userId, authCode.tenantId, client.id);

  const tokenValue = crypto.randomBytes(32).toString("hex");
  const minted = await storage.createMcpToken({
    userId: authCode.userId,
    tenantId: authCode.tenantId,
    token: tokenValue,
    label: client.clientName,
    source: "oauth",
    oauthClientId: client.id,
    expiresAt: null,
  });

  await storage.touchOauthClient(client.id);

  // Security headers per RFC 6749 §5.1
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.json({
    access_token: minted.token,
    token_type: "Bearer",
    scope: authCode.scope ?? "mcp:review",
  });
}

export function createOauthRouter(): Router {
  const router = Router();
  router.post("/register", handleRegister);
  router.get("/authorize", handleAuthorize);
  router.post("/token", handleToken);
  return router;
}
