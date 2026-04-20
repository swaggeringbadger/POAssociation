/**
 * Unit tests for the MCP reviewer auth module.
 *
 * Covers:
 * - bearerAuthMiddleware: token lookup, active/expired checks, role gate,
 *   attaches mcpCtx on success.
 * - assertReviewerAccess: re-verifies role each call, cross-tenant application
 *   ID must fail closed.
 *
 * The storage module is mocked so tests are pure unit tests (no DB).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../server/storage", () => ({
  storage: {
    getMcpTokenByValue: vi.fn(),
    getUserRolesForTenant: vi.fn(),
    getApplication: vi.fn(),
  },
}));

// Import after mock so modules resolve to the mocked storage
const { storage } = await import("../../server/storage");
const { bearerAuthMiddleware, assertReviewerAccess, REVIEWER_ROLES } =
  await import("../../server/mcp/auth");

type StorageMock = {
  getMcpTokenByValue: ReturnType<typeof vi.fn>;
  getUserRolesForTenant: ReturnType<typeof vi.fn>;
  getApplication: ReturnType<typeof vi.fn>;
};
const s = storage as unknown as StorageMock;

function mockReqRes(headers: Record<string, string> = {}) {
  const req = {
    get: (name: string) => headers[name.toLowerCase()],
    mcpCtx: undefined,
  } as unknown as Request;
  const json = vi.fn();
  const res = {
    status: vi.fn().mockReturnThis(),
    json,
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next, json };
}

function activeToken(overrides: Partial<any> = {}) {
  return {
    id: "tok-1",
    userId: "user-1",
    tenantId: "tenant-1",
    token: "mcpr_secret",
    label: null,
    isActive: true,
    createdAt: new Date(),
    lastUsedAt: null,
    accessCount: 0,
    expiresAt: null,
    ...overrides,
  };
}

describe("bearerAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { req, res, next } = mockReqRes();
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const { req, res, next } = mockReqRes({ authorization: "NotBearer foo" });
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is not found", async () => {
    s.getMcpTokenByValue.mockResolvedValue(undefined);
    const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_unknown" });
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is revoked (isActive=false)", async () => {
    s.getMcpTokenByValue.mockResolvedValue(activeToken({ isActive: false }));
    const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_secret" });
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", async () => {
    s.getMcpTokenByValue.mockResolvedValue(
      activeToken({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_secret" });
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when user no longer has a reviewer role", async () => {
    s.getMcpTokenByValue.mockResolvedValue(activeToken());
    s.getUserRolesForTenant.mockResolvedValue([{ role: "homeowner" }]);
    const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_secret" });
    await bearerAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches mcpCtx and calls next() for a valid reviewer token", async () => {
    s.getMcpTokenByValue.mockResolvedValue(activeToken());
    s.getUserRolesForTenant.mockResolvedValue([
      { role: "poa_board_member" },
      { role: "homeowner" },
    ]);
    const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_secret" });
    await bearerAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect((req as any).mcpCtx).toEqual({
      tokenId: "tok-1",
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["poa_board_member", "homeowner"],
    });
  });

  it("recognizes every role in REVIEWER_ROLES", async () => {
    for (const role of REVIEWER_ROLES) {
      vi.clearAllMocks();
      s.getMcpTokenByValue.mockResolvedValue(activeToken());
      s.getUserRolesForTenant.mockResolvedValue([{ role }]);
      const { req, res, next } = mockReqRes({ authorization: "Bearer mcpr_secret" });
      await bearerAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  });
});

describe("assertReviewerAccess", () => {
  const ctx = {
    tokenId: "tok-1",
    userId: "user-1",
    tenantId: "tenant-1",
    roles: ["poa_board_member"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows access when the user still holds a reviewer role", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "management_manager" }]);
    const result = await assertReviewerAccess(ctx);
    expect(result).toEqual({ ok: true });
  });

  it("fails closed when the role has been revoked between calls", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "homeowner" }]);
    const result = await assertReviewerAccess(ctx);
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("fails closed when the application belongs to a different tenant", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "poa_board_member" }]);
    s.getApplication.mockResolvedValue({ id: "app-1", tenantId: "other-tenant" });
    const result = await assertReviewerAccess(ctx, "app-1");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("fails closed when the application ID does not exist", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "poa_board_member" }]);
    s.getApplication.mockResolvedValue(undefined);
    const result = await assertReviewerAccess(ctx, "missing-app");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("allows access when the application belongs to the token's tenant", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "poa_board_member" }]);
    s.getApplication.mockResolvedValue({ id: "app-1", tenantId: "tenant-1" });
    const result = await assertReviewerAccess(ctx, "app-1");
    expect(result).toEqual({ ok: true });
  });
});
