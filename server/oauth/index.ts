import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { isReviewerRole } from "../mcp/auth";

// Session-stashed pending authorization request — survives the GET /authorize
// → consent-page → POST /approve hop without needing a DB table for it.
interface PendingAuthz {
  nonce: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope?: string;
  state?: string;
  resource?: string;
  expiresAt: number; // ms epoch
}

declare module "express-session" {
  interface SessionData {
    pendingOauthAuthz?: PendingAuthz;
  }
}

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
  // Session-only auth (self-hosted email+password / demo flow). The previous
  // Passport `req.user.claims.sub` fallback is dead since the Replit OIDC
  // migration — identity lives entirely in the session.
  return (req as any).session?.userId ?? null;
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

  // Step 2: eligible tenants. Must hold a reviewer role in at least one.
  const memberships = await storage.getUserTenants(userId);
  const reviewerMemberships = memberships.filter((m) => isReviewerRole(m.role));
  if (reviewerMemberships.length === 0) {
    const redirect = new URL(q.redirect_uri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "User has no reviewer role in any tenant");
    if (q.state) redirect.searchParams.set("state", q.state);
    res.redirect(redirect.toString());
    return;
  }

  // Step 3: stash pending request in session so POST /approve can complete it.
  const pending: PendingAuthz = {
    nonce: base64url(crypto.randomBytes(16)),
    clientId: client.id,
    redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge,
    codeChallengeMethod: q.code_challenge_method,
    scope: q.scope,
    state: q.state,
    resource: q.resource,
    expiresAt: Date.now() + AUTH_CODE_TTL_MS,
  };
  req.session.pendingOauthAuthz = pending;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  // Step 4: render the consent page.
  //
  // The global app CSP sets `form-action 'self'`, which blocks the browser from
  // following the post-approve 302 redirect out to the OAuth client's callback
  // (e.g. https://claude.ai/api/mcp/auth_callback) — the flow silently stalls
  // on the consent page. Override the CSP for *this* response so the consent
  // form may submit to ourselves and redirect to the registered client origin.
  const clientOrigin = new URL(q.redirect_uri).origin;
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      `form-action 'self' ${clientOrigin}`,
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  );
  res.type("html").send(renderConsentPage({
    clientName: client.clientName,
    nonce: pending.nonce,
    tenants: reviewerMemberships.map((m) => ({
      id: m.tenantId,
      name: m.tenant.name,
      role: m.role,
    })),
    scope: q.scope,
  }));
}

// ---------- POST /oauth/authorize/approve ----------
const approveBodySchema = z.object({
  nonce: z.string().min(1),
  action: z.enum(["approve", "deny"]),
  tenant_id: z.string().min(1).optional(),
});

async function handleAuthorizeApprove(req: Request, res: Response) {
  const parsed = approveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).type("text/plain").send(`invalid_request: ${parsed.error.message}`);
    return;
  }
  const b = parsed.data;

  const userId = resolveUserId(req);
  const pending = req.session.pendingOauthAuthz;
  if (!userId || !pending) {
    res.status(400).type("text/plain").send("No pending authorization");
    return;
  }
  if (pending.nonce !== b.nonce) {
    res.status(400).type("text/plain").send("Nonce mismatch");
    return;
  }
  if (pending.expiresAt < Date.now()) {
    delete req.session.pendingOauthAuthz;
    res.status(400).type("text/plain").send("Authorization request expired — please restart");
    return;
  }

  // Always clear the pending request after this handler — either the user
  // finished or denied, and we don't want stale nonces lingering.
  const clearPending = () => {
    delete req.session.pendingOauthAuthz;
    return new Promise<void>((resolve) => req.session.save(() => resolve()));
  };

  if (b.action === "deny") {
    await clearPending();
    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "User denied the authorization request");
    if (pending.state) redirect.searchParams.set("state", pending.state);
    res.redirect(redirect.toString());
    return;
  }

  if (!b.tenant_id) {
    res.status(400).type("text/plain").send("tenant_id required for approve");
    return;
  }

  // Verify the selected tenant is one where the user currently holds a
  // reviewer role — fail closed against tampered form submissions.
  const roles = await storage.getUserRolesForTenant(userId, b.tenant_id);
  if (!roles.some((r) => isReviewerRole(r.role))) {
    res.status(403).type("text/plain").send("No reviewer role in selected tenant");
    return;
  }

  const code = base64url(crypto.randomBytes(32));
  await storage.createAuthorizationCode({
    code,
    clientId: pending.clientId,
    userId,
    tenantId: b.tenant_id,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    codeChallengeMethod: pending.codeChallengeMethod,
    scope: pending.scope ?? null,
    resource: pending.resource ?? null,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });

  await clearPending();

  const redirect = new URL(pending.redirectUri);
  redirect.searchParams.set("code", code);
  if (pending.state) redirect.searchParams.set("state", pending.state);
  res.redirect(redirect.toString());
}

// ---------- Consent page (server-rendered HTML) ----------
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderConsentPage(opts: {
  clientName: string;
  nonce: string;
  tenants: Array<{ id: string; name: string; role: string }>;
  scope?: string;
}): string {
  const options = opts.tenants.map((t, i) => `
    <label class="tenant-option">
      <input type="radio" name="tenant_id" value="${escapeHtml(t.id)}"${i === 0 ? " checked" : ""} required>
      <div>
        <div class="tenant-name">${escapeHtml(t.name)}</div>
        <div class="tenant-role">Your role: ${escapeHtml(t.role.replace(/_/g, " "))}</div>
      </div>
    </label>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Authorize — POAssociation</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 2rem 1rem; background: #f6f6f8; color: #111;
    display: flex; justify-content: center; align-items: flex-start; min-height: 100vh;
  }
  .card {
    max-width: 480px; width: 100%; background: white; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.06); padding: 2rem;
  }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  .sub { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
  strong { color: #111; }
  fieldset { border: none; padding: 0; margin: 0 0 1.5rem; }
  legend { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem; padding: 0; }
  .tenant-option {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.75rem 1rem; border: 1px solid #e2e2e7; border-radius: 8px;
    margin-bottom: 0.5rem; cursor: pointer; transition: all 0.1s;
  }
  .tenant-option:hover { border-color: #888; background: #fafafc; }
  .tenant-option:has(input:checked) { border-color: #2563eb; background: #eff6ff; }
  .tenant-option input { margin: 0; }
  .tenant-name { font-weight: 500; }
  .tenant-role { color: #666; font-size: 0.85rem; margin-top: 0.1rem; }
  .scope {
    background: #f0f0f3; border-radius: 6px; padding: 0.75rem 1rem;
    font-size: 0.85rem; color: #333; margin-bottom: 1.5rem;
  }
  .scope ul { margin: 0.4rem 0 0; padding-left: 1.25rem; }
  .actions { display: flex; gap: 0.5rem; }
  button {
    flex: 1; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.95rem;
    font-weight: 500; cursor: pointer; border: 1px solid transparent;
  }
  button.approve { background: #2563eb; color: white; }
  button.approve:hover { background: #1d4ed8; }
  button.deny { background: white; color: #333; border-color: #d4d4d8; }
  button.deny:hover { background: #f4f4f7; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/oauth/authorize/approve">
    <h1>Authorize <strong>${escapeHtml(opts.clientName)}</strong></h1>
    <p class="sub">This application is requesting access to review applications on your behalf.</p>

    <div class="scope">
      <strong>What it can do:</strong>
      <ul>
        <li>Read applications, documents, and comments for the selected community</li>
        <li>Post review comments under your name</li>
      </ul>
      <em>Formal decisions (approve / reject / table) stay in the portal.</em>
    </div>

    <fieldset>
      <legend>Authorize for which community?</legend>
      ${options}
    </fieldset>

    <input type="hidden" name="nonce" value="${escapeHtml(opts.nonce)}">
    <div class="actions">
      <button type="submit" name="action" value="deny" class="deny">Deny</button>
      <button type="submit" name="action" value="approve" class="approve">Authorize</button>
    </div>
  </form>
</body>
</html>`;
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
  router.post("/authorize/approve", handleAuthorizeApprove);
  router.post("/token", handleToken);
  return router;
}
