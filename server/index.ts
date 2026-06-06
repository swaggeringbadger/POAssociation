import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { analysisWorker } from "./services/analysisWorker";
import { ocrWorker } from "./services/ocrWorker";
import { billingScheduler } from "./services/billingScheduler";
import { seedCommunityTiers } from "./seed-tiers";
import { seedAgendaSystem } from "./seed-agenda";

const app = express();

// --- Security: CSP + standard headers via helmet ---
const isDev = process.env.NODE_ENV !== "production";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Vite HMR + inline scripts in dev; production bundles are self-hosted
          ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
          "https://maps.googleapis.com",
          "https://js.stripe.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://maps.googleapis.com",
          "https://api.stripe.com",
          // Vite HMR websocket in dev
          ...(isDev ? ["ws:", "wss:"] : []),
        ],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // HSTS not needed — Replit/reverse proxy handles TLS termination
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false, // Stripe Elements requires cross-origin loading
  })
);

// --- Security: CSRF origin validation on mutation requests ---
app.use((req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  // MCP endpoint uses bearer-token auth, not session cookies — carve out first.
  if (req.path === "/mcp" || req.path.startsWith("/mcp/")) return next();

  // OAuth 2.1 endpoints — DCR, consent approval, and token exchange are driven
  // by external MCP clients (Claude Desktop, Cursor). Their embedded auth views
  // submit with a missing or "null" Origin header, so a same-origin check can't
  // apply. These flows are protected instead by a signed, session-bound consent
  // nonce (authorize/approve) and PKCE + client state (register/token), not by
  // CSRF origin checks.
  if (
    req.path === "/oauth/register" ||
    req.path === "/oauth/token" ||
    req.path === "/oauth/authorize/approve"
  ) {
    return next();
  }

  // Exclude webhook endpoints (they use signature-based auth)
  if (req.path.startsWith("/api/webhooks/")) return next();

  // Exclude public/unauthenticated endpoints
  if (req.path.startsWith("/api/public/")) return next();
  if (req.path === "/api/demo/validate-code" || req.path === "/api/demo/login") return next();
  if (req.path.match(/^\/api\/invitations\/[^/]+$/)) return next();
  if (req.path.match(/^\/api\/upload\/[^/]+$/)) return next();
  if (req.path.match(/^\/api\/residence-upload\/[^/]+$/)) return next();

  const origin = req.get("origin");
  const host = req.get("host");

  // If no origin header (same-origin requests, curl, etc.) — allow
  if (!origin || !host) return next();

  // Parse the origin hostname and compare against the Host header
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return next();
  } catch {
    // Malformed origin — reject
    return res.status(403).json({ error: "Invalid request origin" });
  }

  log(`CSRF blocked: origin=${origin} host=${host}`);
  return res.status(403).json({ error: "Cross-origin request blocked" });
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Redact MCP token bodies — POST response returns a plaintext bearer
      // token that must never appear in logs.
      const isMcpTokenCreate =
        req.method === "POST" && /\/mcp-tokens\/?$/.test(path);
      if (capturedJsonResponse && !isMcpTokenCreate) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (isMcpTokenCreate) {
        logLine += ` :: [redacted]`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure community tiers are seeded with correct values
  await seedCommunityTiers();

  // Seed agenda sections and meeting templates
  await seedAgendaSystem();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // NOTE: `reusePort: true` was removed for Azure App Service — SO_REUSEPORT is a
  // Replit-environment feature; on the Azure Linux container the socket fails to
  // bind, the startup warmup probe never gets a response, and the container
  // crash-loops (ContainerTimeout after 230s). 0.0.0.0 binding is what Azure needs.
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);

    // Start the AI analysis background worker
    if (process.env.ANTHROPIC_API_KEY) {
      analysisWorker.start();
      log('AI Analysis worker started');
    } else {
      log('AI Analysis worker not started (ANTHROPIC_API_KEY not set)');
    }

    // Start the OCR background worker
    if (process.env.GEMINI_API_KEY) {
      ocrWorker.start();
      log('OCR worker started');
    } else {
      log('OCR worker not started (GEMINI_API_KEY not set)');
    }

    // Start the billing scheduler
    billingScheduler.initialize();
    log('Billing scheduler started');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully...');
    analysisWorker.stop();
    ocrWorker.stop();
    billingScheduler.shutdown();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down gracefully...');
    analysisWorker.stop();
    ocrWorker.stop();
    billingScheduler.shutdown();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });
})();
