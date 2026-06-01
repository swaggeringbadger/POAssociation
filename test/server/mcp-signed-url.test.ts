/**
 * Unit tests for the MCP signed-document-URL helper.
 *
 * The signature gates access to PRIVATE application documents for external MCP
 * clients, so it must fail closed on tamper, expiry, document-swap, and missing
 * params. The secret is read at call time, so we set it before the calls.
 */
import { describe, it, expect, beforeAll } from "vitest";

process.env.SESSION_SECRET = "test-signing-secret";

import { signDocumentUrl, verifyDocumentToken, signBlobUrl, verifyBlobToken } from "../../server/mcp/urls";

const DOC = "doc-123";
const NOW = 1_700_000_000_000; // fixed clock (ms)

function parse(url: string) {
  const u = new URL(url);
  return {
    path: u.pathname,
    exp: u.searchParams.get("exp") ?? undefined,
    sig: u.searchParams.get("sig") ?? undefined,
  };
}

describe("signDocumentUrl / verifyDocumentToken", () => {
  it("mints a URL that verifies within the TTL", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    expect(verifyDocumentToken(DOC, exp, sig, NOW)).toBe(true);
  });

  it("embeds the document id in the path", () => {
    expect(parse(signDocumentUrl(DOC, NOW)).path).toBe(
      `/api/mcp/documents/${DOC}/view`,
    );
  });

  it("rejects an expired token (past the 15-minute TTL)", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    const later = NOW + 16 * 60 * 1000;
    expect(verifyDocumentToken(DOC, exp, sig, later)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    expect(verifyDocumentToken(DOC, exp, `${sig}x`, NOW)).toBe(false);
    expect(verifyDocumentToken(DOC, exp, "deadbeef", NOW)).toBe(false);
  });

  it("rejects a token minted for a different document (no replay)", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    expect(verifyDocumentToken("other-doc", exp, sig, NOW)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    const bumped = String(Number(exp) + 3600);
    expect(verifyDocumentToken(DOC, bumped, sig, NOW)).toBe(false);
  });

  it("rejects missing or malformed params", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    expect(verifyDocumentToken(DOC, undefined, sig, NOW)).toBe(false);
    expect(verifyDocumentToken(DOC, exp, undefined, NOW)).toBe(false);
    expect(verifyDocumentToken(DOC, "not-a-number", sig, NOW)).toBe(false);
  });
});

describe("signBlobUrl / verifyBlobToken — kind namespacing", () => {
  it("verifies a dossier-item token and routes to the dossier-items path", () => {
    const { path, exp, sig } = parse(signBlobUrl("dossier-item", DOC, NOW));
    expect(path).toBe(`/api/mcp/dossier-items/${DOC}/view`);
    expect(verifyBlobToken("dossier-item", DOC, exp, sig, NOW)).toBe(true);
  });

  it("does NOT accept a document token as a dossier-item token (no cross-kind replay)", () => {
    const { exp, sig } = parse(signDocumentUrl(DOC, NOW));
    expect(verifyBlobToken("document", DOC, exp, sig, NOW)).toBe(true);
    expect(verifyBlobToken("dossier-item", DOC, exp, sig, NOW)).toBe(false);
  });

  it("does NOT accept a dossier-item token as a document token", () => {
    const { exp, sig } = parse(signBlobUrl("dossier-item", DOC, NOW));
    expect(verifyBlobToken("document", DOC, exp, sig, NOW)).toBe(false);
  });
});
