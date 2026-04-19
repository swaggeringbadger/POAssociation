import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Per-IP floor — defense-in-depth cap applied to every /mcp request before
 * any auth work. Lenient enough that legitimate clients never see it.
 */
export const perIpLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

/**
 * Auth-failure limiter — applied BEFORE bearer lookup to prevent token
 * enumeration. Counts every request; legitimate traffic stays well under it.
 * Separate counter from the per-token limiter so a successful client's quota
 * isn't poisoned by another agent on the same NAT.
 */
export const authFailureLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many auth attempts" },
});

/**
 * Per-token minute limiter — 60 tool calls / minute / token. Falls back to
 * `ipKeyGenerator` when no token context is present (IPv6-safe).
 */
export const perTokenMinuteLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => req.mcpCtx?.tokenId ?? ipKeyGenerator(req.ip ?? "", res),
  message: { error: "Rate limit exceeded (60/min)" },
});

/**
 * Per-token hourly limiter — 500 tool calls / hour / token.
 */
export const perTokenHourLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => req.mcpCtx?.tokenId ?? ipKeyGenerator(req.ip ?? "", res),
  message: { error: "Rate limit exceeded (500/hour)" },
});
