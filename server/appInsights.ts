/**
 * Application Insights — FULL telemetry, in-bundle (no preload, no NODE_OPTIONS).
 *
 * - dependencies (pg/http), exceptions, and console traces are AUTO-collected.
 *   These work fine from inside the esbuild ESM bundle (verified live).
 * - INCOMING requests are tracked EXPLICITLY via the exported requestTracker
 *   express middleware. We do NOT use setAutoCollectRequests: in an esbuild ESM
 *   bundle the SDK's http patch runs after express/http is already loaded, so
 *   auto request-collection silently captures nothing (verified: 0 AppRequests /
 *   458 deps over 2h). A manual middleware is order-independent and reliable.
 *
 * POA logs via raw console.* (953 sites) -> traces, no call-site changes.
 * Perf counters off. Cost backstop is the 50 MB/day cap on poassociation-logs.
 *
 * No connection string (e.g. Replit) -> silent no-op (client stays null,
 * requestTracker is pass-through).
 */
import appInsights from "applicationinsights";
import type { Request, Response, NextFunction } from "express";

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
let client: appInsights.TelemetryClient | null = null;

// Azure health/warmup PROBE user-agents — these requests are dropped so they
// don't consume the 50 MB/day cap. Filter by UA (not path) so real user hits
// to "/" are kept. Also covers favicon/robots/health noise (handled in the mw).
const PROBE_UA = /ReadyForRequest|AlwaysOn|HealthCheck|Edge Health Probe|AppServiceHealthCheck|AlwaysOnDetector/i;
const NOISE_PATH = /^\/(favicon\.ico|robots\.txt|health|healthz)(\?|$)/i;

if (conn) {
  appInsights
    .setup(conn)
    .setAutoCollectRequests(false) // tracked manually below (auto is unreliable in ESM bundle)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectConsole(true, true) // (loggers, AND raw console.*) -> traces
    .setAutoCollectPerformance(false, false) // perf counters off: volume, low value here
    .setAutoDependencyCorrelation(true)
    .setSendLiveMetrics(true) // Live Metrics stream is free (not ingested)
    .setInternalLogging(false, false)
    .start();

  client = appInsights.defaultClient;
  client.context.tags[client.context.keys.cloudRole] = "poassociation";
  console.log(
    "[AppInsights] enabled (manual requests + auto dependencies/exceptions/console traces; perf off; health probes filtered; 50 MB/day cap)"
  );
} else {
  console.log("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled");
}

/**
 * Express middleware: records one AppRequests row per request (duration, status,
 * url, method), skipping Azure health/warmup probes and favicon/robots noise.
 * Mount it as EARLY as possible so the timing spans the whole handler chain.
 * Pass-through when telemetry is disabled.
 */
export function requestTracker(req: Request, res: Response, next: NextFunction) {
  console.log(`[ai-req] ENTER ${req.method} ${req.path} client=${!!client}`); // TEMP DIAGNOSTIC
  if (!client) { console.log("[ai-req] bail: no client"); return next(); }
  const ua = String(req.headers["user-agent"] || "");
  if (PROBE_UA.test(ua) || NOISE_PATH.test(req.originalUrl || req.url)) { console.log(`[ai-req] bail: filtered (${req.path})`); return next(); }

  const start = Date.now();
  res.on("finish", () => {
    console.log(`[ai-req] FINISH ${req.method} ${req.path} ${res.statusCode}`);
    try {
      client!.trackRequest({
        name: `${req.method} ${(req.route && req.route.path) || req.path}`,
        url: req.originalUrl || req.url,
        duration: Date.now() - start,
        resultCode: String(res.statusCode),
        success: res.statusCode < 500,
        properties: { userAgent: ua },
      });
      console.log(`[ai-req] tracked ok ${req.method} ${req.path}`);
    } catch (e: any) {
      console.log(`[ai-req] trackRequest threw: ${e && e.message}`);
    }
  });
  next();
}
