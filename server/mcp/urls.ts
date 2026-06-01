import { createHmac, timingSafeEqual } from "crypto";

/**
 * URL helpers for the MCP server.
 *
 * Bylaws/guidelines are public, so they get a plain link to the existing
 * public proxy. Application documents are PRIVATE — we hand MCP clients a
 * short-lived, HMAC-signed, per-document URL instead so an external LLM can
 * fetch the file without a portal session, but only for a bounded window and
 * only for the exact document the reviewer was already authorized to read.
 */

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes

/** Base URL for building absolute links handed to external clients. */
export function appBaseUrl(): string {
  return process.env.APP_URL || "https://poassociation.com";
}

/** Public, no-auth link to a community's bylaw/guideline document. */
export function guidelineViewUrl(tenantId: string, sourceId: string): string {
  return `${appBaseUrl()}/api/public/tenants/${tenantId}/guidelines/${sourceId}/view`;
}

function signingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET not configured; cannot sign document URLs");
  }
  return secret;
}

/** Resource kinds that can be served via a signed URL. */
export type SignedBlobKind = "document" | "dossier-item";

/** Path segment (under /api/mcp) for each signed-blob kind. */
const KIND_PATH: Record<SignedBlobKind, string> = {
  document: "documents",
  "dossier-item": "dossier-items",
};

function computeSignature(kind: SignedBlobKind, id: string, exp: number): string {
  return createHmac("sha256", signingSecret())
    // `kind` is bound into the signature so a token minted for one resource
    // kind/id can never be replayed against another.
    .update(`mcp-blob:${kind}:${id}:${exp}`)
    .digest("base64url");
}

/**
 * Mint a short-lived signed URL an MCP client can GET to fetch a private blob
 * (application document or research-dossier item). Callers MUST have already
 * verified the caller is authorized for the owning application before minting.
 */
export function signBlobUrl(kind: SignedBlobKind, id: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + SIGNED_URL_TTL_SECONDS;
  const sig = computeSignature(kind, id, exp);
  const url = new URL(`/api/mcp/${KIND_PATH[kind]}/${id}/view`, appBaseUrl());
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", sig);
  return url.toString();
}

/**
 * Verify a signed blob token. Returns true only when the signature matches
 * (constant-time) and the link has not expired. Both `kind` and `id` are bound
 * into the signature, so a token cannot be replayed against another resource.
 */
export function verifyBlobToken(
  kind: SignedBlobKind,
  id: string,
  exp: string | undefined,
  sig: string | undefined,
  nowMs = Date.now(),
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum)) return false;
  if (expNum * 1000 < nowMs) return false; // expired

  const expected = Buffer.from(computeSignature(kind, id, expNum));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

// Backward-compatible thin wrappers for the document signed-URL route.
export function signDocumentUrl(documentId: string, nowMs = Date.now()): string {
  return signBlobUrl("document", documentId, nowMs);
}
export function verifyDocumentToken(
  documentId: string,
  exp: string | undefined,
  sig: string | undefined,
  nowMs = Date.now(),
): boolean {
  return verifyBlobToken("document", documentId, exp, sig, nowMs);
}
