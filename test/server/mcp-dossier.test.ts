/**
 * Unit tests for the add_research_dossier_entry / get_research_dossier MCP tools.
 *
 * Exercises: happy path (authored as the token user, source 'mcp'), binary
 * upload → Azure + signed URL, mime allowlist rejection, cross-tenant fail-closed,
 * and audit logging of argument KEYS only (never the base64 payload).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

process.env.SESSION_SECRET = "test-signing-secret";
process.env.APP_URL = "https://portal.example.com";

vi.mock("../../server/storage", () => ({
  storage: {
    getUserRolesForTenant: vi.fn(),
    getApplication: vi.fn(),
    createDossierEntry: vi.fn(),
    addDossierItem: vi.fn(),
    getDossierForApplication: vi.fn(),
    logMcpToolCall: vi.fn(),
    touchMcpToken: vi.fn(),
  },
}));

vi.mock("../../server/azureBlobStorage", () => ({
  azureBlobStorage: {
    isAvailable: vi.fn(() => true),
    uploadFile: vi.fn(),
  },
}));

const { storage } = await import("../../server/storage");
const { azureBlobStorage } = await import("../../server/azureBlobStorage");
const { registerTools } = await import("../../server/mcp/tools");

type Mock = Record<string, ReturnType<typeof vi.fn>>;
const s = storage as unknown as Mock;
const blob = azureBlobStorage as unknown as Mock;

const REVIEWER_CTX = {
  tokenId: "tok-1",
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["poa_board_member"],
};

async function buildClient(ctx: typeof REVIEWER_CTX | undefined = REVIEWER_CTX) {
  const server = new McpServer({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
  registerTools(server, () => ctx);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1.0.0" }, { capabilities: {} });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return { client };
}

const toolText = (r: any): string => (typeof r?.content?.[0]?.text === "string" ? r.content[0].text : "");
const isToolError = (r: any): boolean => r?.isError === true;
const parse = (r: any) => JSON.parse(toolText(r));

async function drain() {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
}
function lastLogged(toolName: string) {
  const call = [...s.logMcpToolCall.mock.calls].reverse().find((c: any[]) => c[0]?.toolName === toolName);
  if (!call) throw new Error(`no audit for ${toolName}`);
  return call[0];
}

beforeEach(async () => {
  await drain();
  vi.clearAllMocks();
  s.getUserRolesForTenant.mockResolvedValue([{ role: "poa_board_member" }]);
  s.getApplication.mockResolvedValue({ id: "app-1", tenantId: "tenant-1" });
  blob.isAvailable.mockReturnValue(true);
});

describe("add_research_dossier_entry", () => {
  it("creates an entry as the token user with source 'mcp' and inserts items", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-1", title: "Tax research" });
    s.addDossierItem.mockImplementation(async (item: any) => ({ id: `item-${item.position}`, type: item.type }));

    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: {
        application_id: "app-1",
        title: "Tax research",
        items: [
          { type: "link", label: "Tax record", url: "https://county.gov/parcel/123" },
          { type: "text", label: "Summary", content: "Owner of record matches applicant." },
        ],
      },
    });

    expect(s.createDossierEntry).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "app-1", tenantId: "tenant-1", source: "mcp", createdByUserId: "user-1" }),
    );
    expect(s.addDossierItem).toHaveBeenCalledTimes(2);
    const payload = parse(result);
    expect(payload.entryId).toBe("entry-1");
    expect(payload.itemCount).toBe(2);
  });

  it("uploads an image item to blob storage and returns a signed URL", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-2", title: "Plat" });
    blob.uploadFile.mockResolvedValue({ blobName: "tenant-1/app-1/dossier/x.png", containerName: "application-documents", contentType: "image/png", size: 12 });
    s.addDossierItem.mockImplementation(async (item: any) => ({ id: item.id ?? "item-img", type: item.type }));

    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: {
        application_id: "app-1",
        title: "Plat",
        items: [{ type: "image", label: "Plat map", fileName: "plat.png", mimeType: "image/png", contentBase64: Buffer.from("hi").toString("base64") }],
      },
    });

    expect(blob.uploadFile).toHaveBeenCalledTimes(1);
    const payload = parse(result);
    expect(payload.items[0].signedUrl).toContain("/api/mcp/dossier-items/");
    expect(payload.items[0].signedUrl).toContain("sig=");
  });

  it("fetches a url-based image item, stores it, and preserves the source url", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-url", title: "Remote" });
    blob.uploadFile.mockResolvedValue({ blobName: "tenant-1/app-1/dossier/y.png", containerName: "application-documents", contentType: "image/png", size: 4 });
    s.addDossierItem.mockImplementation(async (item: any) => ({ id: item.id ?? "item-url", type: item.type }));
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === "content-length" ? "4" : "image/png") },
      arrayBuffer: async () => Buffer.from("abcd"),
    }));
    vi.stubGlobal("fetch", fakeFetch);

    try {
      const { client } = await buildClient();
      const result = await client.callTool({
        name: "add_research_dossier_entry",
        arguments: {
          application_id: "app-1",
          title: "Remote",
          items: [{ type: "image", label: "Survey", fileName: "survey.png", mimeType: "image/png", url: "https://cdn.example.com/survey.png" }],
        },
      });
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(blob.uploadFile).toHaveBeenCalledTimes(1);
      // Source url is preserved on the row for provenance.
      expect(s.addDossierItem).toHaveBeenCalledWith(expect.objectContaining({ url: "https://cdn.example.com/survey.png" }));
      const payload = parse(result);
      expect(payload.items[0].signedUrl).toContain("/api/mcp/dossier-items/");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects a binary item that supplies BOTH contentBase64 and url", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-both", title: "Both" });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: {
        application_id: "app-1",
        title: "Both",
        items: [{ type: "image", label: "x", fileName: "x.png", mimeType: "image/png", contentBase64: "AAAA", url: "https://cdn.example.com/x.png" }],
      },
    });
    const payload = parse(result);
    expect(payload.error).toContain("exactly one");
    expect(blob.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a binary item that supplies NEITHER contentBase64 nor url", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-neither", title: "Neither" });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: {
        application_id: "app-1",
        title: "Neither",
        items: [{ type: "file", label: "x", fileName: "x.pdf", mimeType: "application/pdf" }],
      },
    });
    const payload = parse(result);
    expect(payload.error).toContain("exactly one");
    expect(blob.uploadFile).not.toHaveBeenCalled();
  });

  it("refuses to fetch an internal/private address (SSRF guard)", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-ssrf", title: "SSRF" });
    const fakeFetch = vi.fn();
    vi.stubGlobal("fetch", fakeFetch);
    try {
      const { client } = await buildClient();
      const result = await client.callTool({
        name: "add_research_dossier_entry",
        arguments: {
          application_id: "app-1",
          title: "SSRF",
          items: [{ type: "image", label: "x", fileName: "x.png", mimeType: "image/png", url: "http://169.254.169.254/latest/meta-data/" }],
        },
      });
      expect(isToolError(result)).toBe(true);
      expect(fakeFetch).not.toHaveBeenCalled();
      expect(blob.uploadFile).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects a disallowed binary mime type", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-3", title: "Bad" });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: {
        application_id: "app-1",
        title: "Bad",
        items: [{ type: "file", label: "exe", fileName: "x.exe", mimeType: "application/x-msdownload", contentBase64: "AAAA" }],
      },
    });
    const payload = parse(result);
    expect(payload.error).toContain("Unsupported mimeType");
    expect(blob.uploadFile).not.toHaveBeenCalled();
  });

  it("fails closed on a cross-tenant application id", async () => {
    s.getApplication.mockResolvedValue({ id: "app-x", tenantId: "other-tenant" });
    const { client } = await buildClient();
    const result = await client.callTool({
      name: "add_research_dossier_entry",
      arguments: { application_id: "app-x", title: "x", items: [{ type: "text", label: "n", content: "c" }] },
    });
    expect(isToolError(result)).toBe(true);
    expect(s.createDossierEntry).not.toHaveBeenCalled();
  });

  it("audits argument keys only — never the base64 payload", async () => {
    s.createDossierEntry.mockResolvedValue({ id: "entry-4", title: "t" });
    blob.uploadFile.mockResolvedValue({ blobName: "b", containerName: "application-documents", contentType: "image/png", size: 1 });
    s.addDossierItem.mockResolvedValue({ id: "i", type: "image" });
    const secret = Buffer.from("TOP_SECRET_IMAGE_BYTES").toString("base64");
    const { client } = await buildClient();
    await client.callTool({
      name: "add_research_dossier_entry",
      arguments: { application_id: "app-1", title: "t", items: [{ type: "image", label: "l", fileName: "f.png", mimeType: "image/png", contentBase64: secret }] },
    });
    await drain();
    const call = lastLogged("add_research_dossier_entry");
    expect(call.argumentKeys).toEqual(["application_id", "title", "items"]);
    expect(JSON.stringify(call)).not.toContain(secret);
  });
});

describe("get_research_dossier", () => {
  it("returns entries with signed URLs for image/file items only", async () => {
    s.getDossierForApplication.mockResolvedValue([
      {
        id: "e1", title: "T", summary: null, source: "mcp", mcpClientName: null, verifiedAt: null, createdAt: new Date(),
        items: [
          { id: "li", type: "link", label: "L", caption: null, url: "https://x", content: null, fileName: null, mimeType: null },
          { id: "im", type: "image", label: "I", caption: null, url: null, content: null, fileName: "i.png", mimeType: "image/png" },
        ],
      },
    ]);
    const { client } = await buildClient();
    const result = await client.callTool({ name: "get_research_dossier", arguments: { application_id: "app-1" } });
    const payload = parse(result);
    expect(payload.count).toBe(1);
    const items = payload.entries[0].items;
    expect(items.find((i: any) => i.type === "link").signedUrl).toBeUndefined();
    expect(items.find((i: any) => i.type === "image").signedUrl).toContain("/api/mcp/dossier-items/");
  });
});
