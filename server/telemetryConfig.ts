/**
 * Live telemetry "dials" via Azure App Configuration.
 *
 * Lets us tune what App Insights actually SENDS — sampling rate, which telemetry
 * types are captured, console-trace severity floor, health-probe drop — at
 * runtime with NO redeploy. Collection in appInsights.ts stays broad/ON; the
 * telemetry processor + requestTracker read getDials() at send/request time and
 * filter accordingly. The 50 MB/day workspace cap is the downstream backstop.
 *
 * Keys live in the shared `swaggering-badger-appconfig` store, namespaced
 * `poa:telemetry:*`, plus a `poa:sentinel` key we poll to detect changes.
 * Read via the App Service managed identity (DefaultAzureCredential).
 *
 * No AZURE_APPCONFIG_ENDPOINT (e.g. local / Replit) -> silent fallback to
 * DEFAULTS, never breaks the app (same posture as the AI bootstrap). The poll
 * interval is unref()'d so it never holds the process open.
 */
import { AppConfigurationClient } from "@azure/app-configuration";
import { DefaultAzureCredential } from "@azure/identity";

export type Dials = {
  sampleRate: number; // 0–100, % of telemetry to send
  minTraceLevel: "info" | "warn" | "error";
  captureRequests: boolean;
  captureDependencies: boolean;
  captureExceptions: boolean;
  captureConsoleTraces: boolean;
  dropHealthProbes: boolean;
};

// Steady-state baseline = LEAN (economical): exceptions always; requests + deps
// sampled to 25% (sampleRate gate in appInsights.ts is scoped to those types, so
// exceptions are never dropped by sampling); console traces error-only. This is
// also the fallback when App Config is unreachable (the 50 MB/day cap backstops
// cost either way).
const DEFAULTS: Dials = {
  sampleRate: 25,
  minTraceLevel: "error",
  captureRequests: true,
  captureDependencies: true,
  captureExceptions: true,
  captureConsoleTraces: true,
  dropHealthProbes: true,
};

// While a verbose window is active (dashboard "Verbose 24h/1h" pill sets
// poa:telemetry:verboseUntil), getDials() returns this wide-open profile, then
// auto-reverts to the steady baseline the instant the timestamp lapses — no cron,
// checked at send-time on every telemetry item.
const VERBOSE: Dials = {
  sampleRate: 100,
  minTraceLevel: "info",
  captureRequests: true,
  captureDependencies: true,
  captureExceptions: true,
  captureConsoleTraces: true,
  dropHealthProbes: true,
};

const PREFIX = "poa:telemetry:";

let dials: Dials = { ...DEFAULTS };
let verboseUntilMs = 0; // epoch ms; while now < this, getDials() returns VERBOSE
let client: AppConfigurationClient | null = null;
let lastSentinel: string | undefined;

export function getDials(): Dials {
  return verboseUntilMs > Date.now() ? VERBOSE : dials;
}

async function loadAll(): Promise<void> {
  if (!client) return;
  const n: Dials = { ...DEFAULTS };
  let vUntil = 0;
  for await (const s of client.listConfigurationSettings({ keyFilter: PREFIX + "*" })) {
    const k = s.key.slice(PREFIX.length);
    const v = s.value ?? "";
    if (k === "sampleRate") {
      const r = Number(v); // clamp 0–100; bad/empty -> default (note: "0" is a valid drop-all)
      n.sampleRate = Number.isFinite(r) && r >= 0 && r <= 100 ? r : DEFAULTS.sampleRate;
    } else if (k === "minTraceLevel") n.minTraceLevel = v as Dials["minTraceLevel"];
    else if (k === "captureRequests") n.captureRequests = v === "true";
    else if (k === "captureDependencies") n.captureDependencies = v === "true";
    else if (k === "captureExceptions") n.captureExceptions = v === "true";
    else if (k === "captureConsoleTraces") n.captureConsoleTraces = v === "true";
    else if (k === "dropHealthProbes") n.dropHealthProbes = v === "true";
    else if (k === "verboseUntil") vUntil = v ? Date.parse(v) || 0 : 0;
  }
  dials = n;
  verboseUntilMs = vUntil; // cleared when the key is absent/empty
}

export async function initTelemetryConfig(): Promise<void> {
  const ep = process.env.AZURE_APPCONFIG_ENDPOINT;
  if (!ep) {
    console.log("[telemetryConfig] no AZURE_APPCONFIG_ENDPOINT — using defaults");
    return;
  }
  try {
    client = new AppConfigurationClient(ep, new DefaultAzureCredential());
    await loadAll();
    console.log("[telemetryConfig] dials:", JSON.stringify(dials));
    // Poll the sentinel; reload all keys only when it changes (cheap watch).
    setInterval(async () => {
      try {
        const s = await client!.getConfigurationSetting({ key: "poa:sentinel" });
        if (s.value !== lastSentinel) {
          lastSentinel = s.value;
          await loadAll();
          console.log("[telemetryConfig] refreshed:", JSON.stringify(dials));
        }
      } catch {
        /* transient App Config read error — keep current dials */
      }
    }, 30000).unref();
  } catch (e: any) {
    console.log("[telemetryConfig] init failed, using defaults:", e?.message);
  }
}
