/**
 * Application Insights bootstrap — CommonJS PRELOAD.
 *
 * Loaded via NODE_OPTIONS=--require .../aiBootstrap.cjs so it runs BEFORE the ESM
 * app bundle (dist/index.js). That ordering is the whole point: the classic
 * applicationinsights SDK instruments INCOMING requests by patching the `http`
 * module, which must happen before express/http is first loaded. In an esbuild
 * ESM bundle, a setup() call inside the bundle runs AFTER express's external
 * import is evaluated, so http is patched too late and AppRequests stays empty
 * (outbound pg dependencies still work — they connect later). Preloading here
 * fixes that: http is patched before anything imports it.
 *
 * FULL telemetry: requests + dependencies + exceptions + console traces. POA logs
 * via raw console.* (953 sites), captured as traces with no call-site changes.
 * Perf counters off. The 50 MB/day cap on poassociation-logs is the cost backstop.
 *
 * No connection string (e.g. Replit) -> silent no-op. Everything is wrapped so a
 * telemetry init failure can NEVER crash the app (a throwing --require kills node).
 */
try {
  const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (conn) {
    const appInsights = require("applicationinsights");
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
    // Filter by the distinctive Azure probe User-Agents (NOT by path) so genuine user
    // hits to "/" are kept — only infra pings are dropped. Also drop favicon/robots/health.
    const PROBE_UA = /ReadyForRequest|AlwaysOn|HealthCheck|Edge Health Probe|AppServiceHealthCheck|AlwaysOnDetector/i;
    client.addTelemetryProcessor((envelope, context) => {
      if (envelope.data.baseType === "RequestData") {
        const req = context && context["http.ServerRequest"];
        const ua = String((req && req.headers && req.headers["user-agent"]) || "");
        if (PROBE_UA.test(ua)) return false;
        const url = String((envelope.data.baseData && envelope.data.baseData.url) || "");
        if (/\/(favicon\.ico|robots\.txt|health|healthz)(\?|$)/i.test(url)) return false;
      }
      return true;
    });

    console.log(
      "[AppInsights] enabled via preload (requests+dependencies+exceptions+console traces; perf off; health probes filtered; 50 MB/day cap)"
    );
  } else {
    console.log("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled");
  }
} catch (err) {
  console.error("[AppInsights] bootstrap failed (telemetry disabled, app continues):", err && err.message);
}
