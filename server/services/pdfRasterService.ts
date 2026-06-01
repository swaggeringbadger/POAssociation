/**
 * PDF Rasterization Service
 *
 * Renders selected PDF pages to PNG images for MCP image content blocks — the
 * read path for SCANNED / image-only governing documents and surveys (no text
 * layer, but the connector forwards image blocks).
 *
 * Supports two selection modes so callers can reach content past page 1 while a
 * protective per-response ceiling always holds:
 *  - window:  pageOffset (1-based) + pageLimit  → walk a long doc in batches
 *  - range:   pages: number[]                   → fetch only known sections (TOC-driven)
 * Every result reports totalPages + hasMore so the caller knows how far to walk.
 *
 * Uses pdfjs-dist for an accurate page count (no render) and pdf-to-png-converter
 * (pdfjs-dist + @napi-rs/canvas, prebuilt — no node-gyp) to render. Results are
 * cached in-memory by content hash + selection.
 */

import { createHash } from "crypto";
import { pdfToPng } from "pdf-to-png-converter";

// 1.5x of a 612x792pt page ≈ 918x1188px — under Anthropic's ~1568px long-edge
// cap (so it isn't re-downscaled) yet sharp enough to read setback text.
const VIEWPORT_SCALE = 1.5;
const DEFAULT_PAGE_LIMIT = 8;
// Absolute ceiling per single call — a caller can lower it, never raise above it.
const HARD_MAX_PAGES = 12;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface RasterPage {
  page: number; // 1-based page number
  base64: string;
  mimeType: "image/png";
}

export interface RasterResult {
  pages: RasterPage[];
  totalPages: number;
  pageOffset: number; // 1-based first page returned (window mode); min requested (range)
  pagesReturned: number;
  hasMore: boolean; // pages beyond this batch remain (window mode) / more than hardMax requested (range)
  mode: "window" | "range";
}

export interface RasterOptions {
  pageOffset?: number; // 1-based window start (default 1)
  pageLimit?: number; // window size (default 8)
  pages?: number[]; // explicit 1-based page list — overrides window
  hardMax?: number; // per-call ceiling (clamped to HARD_MAX_PAGES)
}

const resultCache = new Map<string, { result: RasterResult; ts: number }>();
const countCache = new Map<string, { count: number; ts: number }>();

function sha1(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex");
}

/** Accurate page count via pdfjs (parses structure, does NOT render). */
async function getPageCount(buffer: Buffer): Promise<number> {
  const key = sha1(buffer);
  const hit = countCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.count;
  try {
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await task.promise;
    const count = doc.numPages as number;
    await doc.destroy();
    countCache.set(key, { count, ts: Date.now() });
    return count;
  } catch {
    return 0; // unknown — caller treats 0 totalPages as "couldn't parse"
  }
}

/**
 * Render a selected set of PDF pages to PNG (base64). Selection is either a
 * window (pageOffset+pageLimit) or an explicit page list (pages). The number of
 * pages rendered is always ≤ HARD_MAX_PAGES.
 */
export async function rasterizePdf(
  buffer: Buffer,
  opts: RasterOptions = {},
): Promise<RasterResult> {
  const hardMax = Math.min(Math.max(opts.hardMax ?? HARD_MAX_PAGES, 1), HARD_MAX_PAGES);
  const totalPages = await getPageCount(buffer);

  let targetPages: number[];
  let mode: "window" | "range";
  let pageOffset: number;
  let hasMore = false;

  if (opts.pages && opts.pages.length > 0) {
    mode = "range";
    const valid = Array.from(new Set(opts.pages))
      .filter((p) => Number.isInteger(p) && p >= 1 && (totalPages === 0 || p <= totalPages))
      .sort((a, b) => a - b);
    targetPages = valid.slice(0, hardMax);
    hasMore = valid.length > targetPages.length;
    pageOffset = targetPages[0] ?? 0;
  } else {
    mode = "window";
    pageOffset = Math.max(1, Math.floor(opts.pageOffset ?? 1));
    const limit = Math.min(Math.max(1, Math.floor(opts.pageLimit ?? DEFAULT_PAGE_LIMIT)), hardMax);
    // If we know totalPages, clamp the window end to it; otherwise over-request
    // by `limit` and rely on strictPagesToProcess:false to drop out-of-range.
    const end = totalPages > 0 ? Math.min(pageOffset + limit - 1, totalPages) : pageOffset + limit - 1;
    targetPages = [];
    for (let p = pageOffset; p <= end; p++) targetPages.push(p);
    hasMore = totalPages > 0 ? end < totalPages : false;
  }

  if (targetPages.length === 0) {
    return { pages: [], totalPages, pageOffset, pagesReturned: 0, hasMore, mode };
  }

  const cacheKey = `${sha1(buffer)}:${mode}:${targetPages.join(",")}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.result;

  const rendered = await pdfToPng(buffer, {
    viewportScale: VIEWPORT_SCALE,
    pagesToProcess: targetPages,
    strictPagesToProcess: false,
  });

  const pages: RasterPage[] = rendered.map((p, i) => ({
    page: p.pageNumber ?? targetPages[i] ?? i + 1,
    base64: p.content.toString("base64"),
    mimeType: "image/png" as const,
  }));

  const result: RasterResult = {
    pages,
    totalPages,
    pageOffset,
    pagesReturned: pages.length,
    hasMore,
    mode,
  };
  resultCache.set(cacheKey, { result, ts: Date.now() });
  return result;
}

/** Clear caches (test/maintenance helper). */
export function clearRasterCache(): void {
  resultCache.clear();
  countCache.clear();
}
