/**
 * Unit tests for the MCP tool handlers.
 *
 * Builds a real McpServer, registers the tools against mocked storage, then
 * drives calls through the JSON-RPC protocol via an in-process
 * InMemoryTransport pair. This exercises:
 * - The wrapTool audit/auth wrapper
 * - Per-tool behavior (list_applications, get_application, submit_comment)
 * - Cross-tenant + missing-role enforcement at the tool boundary
 * - Fire-and-forget audit logging of argument KEYS only (no values)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("../../server/storage", () => ({
  storage: {
    getUserRolesForTenant: vi.fn(),
    getApplication: vi.fn(),
    getUser: vi.fn(),
    getFormTemplate: vi.fn(),
    listApplicationsForTenant: vi.fn(),
    listDocumentsByApplication: vi.fn(),
    getApplicationWorkflow: vi.fn(),
    getWorkflowActionHistory: vi.fn(),
    getApplicationComments: vi.fn(),
    addComment: vi.fn(),
    getActiveAiContextSourcesForForm: vi.fn(),
    logMcpToolCall: vi.fn(),
    touchMcpToken: vi.fn(),
  },
}));

vi.mock("../../server/services/aiContextService", () => ({
  aiContextService: {
    gatherContext: vi.fn(),
  },
}));

const { storage } = await import("../../server/storage");
const { aiContextService } = await import("../../server/services/aiContextService");
const { registerTools } = await import("../../server/mcp/tools");

type StorageMock = Record<string, ReturnType<typeof vi.fn>>;
const s = storage as unknown as StorageMock;

const REVIEWER_CTX = {
  tokenId: "tok-1",
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["poa_board_member"],
};

async function buildClient(ctx: typeof REVIEWER_CTX | undefined = REVIEWER_CTX) {
  const server = new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  registerTools(server, () => ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

function toolText(result: any): string {
  const block = result?.content?.[0];
  return typeof block?.text === "string" ? block.text : "";
}

function isToolError(result: any): boolean {
  return result?.isError === true;
}

function parseToolJson<T = any>(result: any): T {
  return JSON.parse(toolText(result));
}

// Audit writes are fire-and-forget via setImmediate. Drain pending ticks
// before each test so a prior test's audit entry can't leak into this one's
// mock.calls[0]. Helper: loop setImmediate a couple of times to flush.
async function drainSetImmediate() {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

beforeEach(async () => {
  await drainSetImmediate();
  vi.clearAllMocks();
  // Default: user retains reviewer role
  s.getUserRolesForTenant.mockResolvedValue([{ role: "poa_board_member" }]);
});

// Find the audit entry for a specific tool — robust against any cross-test
// leakage even if drain misses something.
function lastLoggedCall(toolName: string) {
  const call = [...s.logMcpToolCall.mock.calls]
    .reverse()
    .find((c: any[]) => c[0]?.toolName === toolName);
  if (!call) throw new Error(`No audit call found for ${toolName}`);
  return call[0];
}

describe("tools/list", () => {
  it("exposes the 7 reviewer tools", async () => {
    const { client } = await buildClient();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "get_application",
        "get_application_comments",
        "get_application_documents",
        "get_application_workflow",
        "get_bylaws_and_context",
        "list_applications",
        "submit_comment",
      ].sort(),
    );
  });
});

describe("list_applications", () => {
  it("filters by tenantId and returns tenant-scoped results", async () => {
    s.listApplicationsForTenant.mockResolvedValue([
      { id: "a1", applicationNumber: "X-1", title: "Fence", status: "pending", propertyAddress: "1 Oak", projectType: "exterior", submittedAt: new Date("2026-04-18"), reviewedAt: null },
      { id: "a2", applicationNumber: "X-2", title: "Roof", status: "approved", propertyAddress: "2 Oak", projectType: "exterior", submittedAt: new Date("2026-04-10"), reviewedAt: new Date("2026-04-15") },
    ]);

    const { client } = await buildClient();
    const result = await client.callTool({
      name: "list_applications",
      arguments: { limit: 10 },
    });

    expect(s.listApplicationsForTenant).toHaveBeenCalledWith("tenant-1");
    const payload = parseToolJson(result);
    expect(payload.count).toBe(2);
    // Sorted by submittedAt desc
    expect(payload.applications[0].id).toBe("a1");
  });

  it("applies the optional status filter", async () => {
    s.listApplicationsForTenant.mockResolvedValue([
      { id: "a1", status: "pending", submittedAt: new Date(), applicationNumber: "", title: "", propertyAddress: "", projectType: "" },
      { id: "a2", status: "approved", submittedAt: new Date(), applicationNumber: "", title: "", propertyAddress: "", projectType: "" },
    ]);
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "list_applications",
      arguments: { status: "approved" },
    });
    const payload = parseToolJson(result);
    expect(payload.applications).toHaveLength(1);
    expect(payload.applications[0].id).toBe("a2");
  });

  it("fails closed when the user lost their reviewer role between calls", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "homeowner" }]);
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "list_applications",
      arguments: {},
    });
    expect(isToolError(result)).toBe(true);
    expect(toolText(result)).toContain("forbidden");
    expect(s.listApplicationsForTenant).not.toHaveBeenCalled();
  });
});

describe("get_application", () => {
  it("returns details when the application is in the scoped tenant", async () => {
    s.getApplication.mockResolvedValue({
      id: "app-1",
      tenantId: "tenant-1",
      applicationNumber: "ABCD-2026-XYZW",
      title: "Deck rebuild",
      description: "Replace rotten deck",
      status: "pending",
      propertyAddress: "42 Elm",
      projectType: "exterior",
      formData: { color: "white" },
      completenessScore: 80,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewNotes: null,
      submittedByUserId: "sub-1",
      formTemplateId: "tmpl-1",
      formTemplateVersion: 3,
    });
    s.getUser.mockResolvedValue({
      id: "sub-1",
      firstName: "Sam",
      lastName: "Submitter",
      email: "sam@example.com",
    });
    s.getFormTemplate.mockResolvedValue({ id: "tmpl-1", name: "Exterior" });

    const { client } = await buildClient();
    const result = await client.callTool({
      name: "get_application",
      arguments: { application_id: "app-1" },
    });
    const payload = parseToolJson(result);
    expect(payload.id).toBe("app-1");
    expect(payload.submittedBy.name).toBe("Sam Submitter");
    expect(payload.formTemplate.version).toBe(3);
  });

  it("fails closed for a cross-tenant application ID", async () => {
    s.getApplication.mockResolvedValue({
      id: "app-2",
      tenantId: "other-tenant", // NOT the token's tenant
    });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "get_application",
      arguments: { application_id: "app-2" },
    });
    expect(isToolError(result)).toBe(true);
    expect(toolText(result)).toContain("forbidden");
    // Critical: we never leak submitter/template info for cross-tenant apps
    expect(s.getUser).not.toHaveBeenCalled();
    expect(s.getFormTemplate).not.toHaveBeenCalled();
  });
});

describe("submit_comment", () => {
  it("creates a comment authored as the token user", async () => {
    s.getApplication.mockResolvedValue({ id: "app-1", tenantId: "tenant-1" });
    s.addComment.mockResolvedValue({
      id: "c-1",
      createdAt: new Date("2026-04-19T12:00:00Z"),
    });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "submit_comment",
      arguments: { application_id: "app-1", body: "Looks good." },
    });
    expect(s.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        userId: "user-1", // from ctx, not from client
        text: "Looks good.",
      }),
    );
    const payload = parseToolJson(result);
    expect(payload.commentId).toBe("c-1");
  });

  it("rejects cross-tenant application IDs on write", async () => {
    s.getApplication.mockResolvedValue({ id: "app-x", tenantId: "other-tenant" });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "submit_comment",
      arguments: { application_id: "app-x", body: "malicious" },
    });
    expect(isToolError(result)).toBe(true);
    expect(s.addComment).not.toHaveBeenCalled();
  });
});

describe("audit logging", () => {
  it("records tool name + argument KEYS (never values) on success", async () => {
    s.listApplicationsForTenant.mockResolvedValue([]);
    const { client } = await buildClient();
    await client.callTool({
      name: "list_applications",
      arguments: { status: "pending", limit: 5 },
    });

    await drainSetImmediate();

    const call = lastLoggedCall("list_applications");
    expect(call.argumentKeys).toEqual(["status", "limit"]);
    expect(call.resultStatus).toBe("ok");
    // Values MUST NOT appear anywhere in the audit entry
    expect(JSON.stringify(call)).not.toContain("pending");
  });

  it("records submit_comment without the comment body", async () => {
    s.getApplication.mockResolvedValue({ id: "app-1", tenantId: "tenant-1" });
    s.addComment.mockResolvedValue({ id: "c-1", createdAt: new Date() });
    const { client } = await buildClient();
    await client.callTool({
      name: "submit_comment",
      arguments: { application_id: "app-1", body: "SECRET_NOTES_DO_NOT_LEAK" },
    });
    await drainSetImmediate();

    const call = lastLoggedCall("submit_comment");
    expect(call.argumentKeys).toEqual(["application_id", "body"]);
    expect(JSON.stringify(call)).not.toContain("SECRET_NOTES_DO_NOT_LEAK");
  });

  it("records forbidden result when access check fails", async () => {
    s.getUserRolesForTenant.mockResolvedValue([{ role: "homeowner" }]);
    const { client } = await buildClient();
    await client.callTool({
      name: "list_applications",
      arguments: {},
    });
    await drainSetImmediate();

    const call = lastLoggedCall("list_applications");
    expect(call.resultStatus).toBe("forbidden");
  });
});

describe("get_bylaws_and_context", () => {
  it("delegates to aiContextService.gatherContext with tenantId and form_type", async () => {
    (aiContextService.gatherContext as any).mockResolvedValue({
      documents: [],
      instructions: "Be thorough",
      totalEstimatedTokens: 100,
      truncated: false,
      includedSources: [],
      excludedSources: [],
    });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "get_bylaws_and_context",
      arguments: { form_type: "exterior-modifications" },
    });
    expect(aiContextService.gatherContext).toHaveBeenCalledWith(
      "tenant-1",
      "exterior-modifications",
    );
    const payload = parseToolJson(result);
    expect(payload.instructions).toBe("Be thorough");
  });
});
