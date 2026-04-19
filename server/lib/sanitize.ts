/**
 * Input sanitization utilities.
 *
 * Strips HTML tags from user-submitted text fields to prevent stored XSS.
 * Used at API boundaries before data is persisted.
 */

import sanitizeHtml from "sanitize-html";

/** Strip all HTML — plain text only. */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/** Allow minimal formatting (bold, italic, line breaks). */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input, {
    allowedTags: ["b", "i", "em", "strong", "br", "p", "ul", "ol", "li"],
    allowedAttributes: {},
  }).trim();
}

/**
 * Recursively sanitize all string values in a plain object / array.
 * Used for JSONB form data where field structure is dynamic.
 */
export function sanitizeFormData(data: unknown): unknown {
  if (typeof data === "string") return sanitizeText(data);
  if (Array.isArray(data)) return data.map(sanitizeFormData);
  if (data !== null && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      out[key] = sanitizeFormData(value);
    }
    return out;
  }
  return data; // numbers, booleans, null — pass through
}
