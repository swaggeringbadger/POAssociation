// Self-hosted email + password authentication.
//
// Replaces the previous Replit OIDC integration. Identity lives entirely in the
// express-session record as `session.userId` (+ `session.currentUserRole`) —
// the same mechanism the demo-code flow already uses. There is no Passport and
// no external identity provider.
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Express, RequestHandler } from "express";

const BCRYPT_COST = 12;

/**
 * Builds the express-session middleware backed by the existing `sessions`
 * table (connect-pg-simple). Reused verbatim from the prior Replit Auth setup
 * so existing sessions and the demo flow keep working.
 */
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only require HTTPS in production
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Compatibility shim: the MCP OAuth authorization server redirects unauthed
  // users to /api/login?returnTo=... (server/oauth/index.ts). Bounce them to
  // the self-hosted login page, preserving returnTo.
  app.get("/api/login", (req, res) => {
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
    res.redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo)}`);
  });
}

/**
 * Session-only auth guard. Both real users (email+password login) and demo
 * users populate `session.userId`, so a single check covers everyone.
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if ((req as any).session?.userId) return next();
  return res.status(401).json({ message: "Unauthorized" });
};

// --- Password hashing ---
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// --- Single-use token helpers (password reset, email verification) ---
// The raw token is emailed to the user; only its SHA-256 hash is stored.
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
