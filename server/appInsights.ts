/**
 * Application Insights — FULL telemetry, cost-bounded.
 *
 * Captures requests + dependencies (Postgres/HTTP) + exceptions + console traces.
 * POA logs via raw console.* (953 call sites) and the log() helper in vite.ts, so
 * setAutoCollectConsole(true, true) ships all of that straight in as traces — no
 * change to any log call site. The 50 MB/day cap on the poassociation-logs
 * workspace (provisioned out-of-band) is the cost backstop.
 *
 * IMPORTED FIRST in server/index.ts (before express / routes) so the SDK patches
 * console + the http module before anything serves a request.
 *
 * No connection string (e.g. on Replit, or any env without the app setting) ->
 * telemetry is a silent no-op. Azure has APPLICATIONINSIGHTS_CONNECTION_STRING set.
 */
import appInsights from "applicationinsights";

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (conn) {
  appInsights
    .setup(conn)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectConsole(true, true) // (loggers, AND raw console.*) -> traces
    .setAutoCollectPerformance(false, false) // perf counters off: volume, low value here
    .setAutoDependencyCorrelation(true)
    .setSendLiveMetrics(true) // Live Metrics stream is free (not ingested)
    .setInternalLogging(false, false)
    .start();

  const client = appInsights.defaultClient;
  client.context.tags[client.context.keys.cloudRole] = "poassociation";

  // Suppress health/warmup PROBE requests so they don't consume the 50 MB/day cap.
  // We filter by the distinctive Azure probe User-Agents (NOT by path), so genuine
  // user hits to "/" are kept — only the infra pings are dropped. POA's own request
  // logger only logs /api*, so these probes never reach the console either way; this
  // strips them from App Insights request telemetry too. Also drops favicon/robots noise.
  const PROBE_UA = /ReadyForRequest|AlwaysOn|HealthCheck|Edge Health Probe|AppServiceHealthCheck|AlwaysOnDetector/i;
  client.addTelemetryProcessor((envelope, context) => {
    if (envelope.data.baseType === "RequestData") {
      const req = context?.["http.ServerRequest"] as any;
      const ua = String(req?.headers?.["user-agent"] || "");
      if (PROBE_UA.test(ua)) return false;
      const url = String((envelope.data as any).baseData?.url || "");
      if (/\/(favicon\.ico|robots\.txt|health|healthz)(\?|$)/i.test(url)) return false;
    }
    return true;
  });

  console.log(
    "[AppInsights] enabled (requests+dependencies+exceptions+console traces; perf off; health probes filtered; 50 MB/day cap)"
  );
} else {
  console.log("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled");
}

export {};
