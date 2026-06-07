# Azure Operating Policies — POAssociation (post-Replit)

**Source:** Mitch McDeere (dev-lead@swaggering-b), POA→Azure migration. Saved 2026-06-07.
**Why this file exists:** POA is being folded onto the shared Swaggering Badger Azure infra
(Option A — shared Flex Postgres + shared VNet). These rules are non-obvious and have already
bitten the SB/HS cutovers. Read before touching anything deploy-, DB-, or hostname-related.

**Cutover status (2026-06-07):** PRE-cutover. `poassociation.com` is **still on Replit** (no users
on Azure yet). The Azure instance `poassociation.azurewebsites.net` is being smoke-tested; holding
at the DNS line until it boots clean.

---

## The 9 policies

1. **Deploys are ON-DEMAND, not push-triggered.** Pushing to GitHub `main` does NOT deploy.
   Release with `gh workflow run deploy.yml` (workflow_dispatch, OIDC-authed, zero stored creds).
   Schema-only/code-only with no new migration: `gh workflow run deploy.yml -f skip_migrations=true`.

2. **Migrations go through an in-VNet ACI gated path — NEVER migrate-on-boot, NEVER `drizzle-kit
   migrate`/`db:push` from the public GitHub runner.** The Flex Postgres is private (VNet-only); the
   runner can't reach it. Keep `RUN_DB_MIGRATIONS_ON_BOOT=0` (migrate-on-boot caused an HS prod
   crash-loop). Schema change flow: **backup → migrate(ACI, journaled, fail-closed) → deploy code.**
   Use versioned `drizzle-kit generate` + commit the SQL; never `push` against prod. See
   [[poa-azure-migration-handbook]] for the migration-journal paradigm + baseline-at-cutover plan.

3. **esbuild bundles JS ONLY.** Any file read from disk at runtime (`process.cwd()/...`,
   `readFileSync`) must be explicitly copied into the deploy artifact or the app crash-loops on boot.
   Known runtime-read dirs in POA: `server/prompts/` (promptRegistry — read at BOOT) and `ref_docs/`
   (aiFormGenerationService — read lazily on form-gen). Both are now staged in deploy.yml by Mitch
   (commit 5e4c979, fail-loud guards). **Before adding ANY new runtime-read data dir, grep source for
   `process.cwd()`/`readFileSync` and confirm deploy.yml ships it.**

4. **App Service settings PUT is a FULL REPLACE.** GET → merge → PUT the whole set, or you wipe every
   `@Microsoft.KeyVault(...)` reference and the app boots crashed. Secrets live in `poassociation-kv`
   as KV references; new secret = add to KV + add a KV-ref app setting (GET-merge-PUT) + add to
   `deploy/required-settings.yml`. App Service caches KV refs hard — to rotate a value, point at a
   NEW secret name (e.g. `database-url-azure`), don't bump the existing secret in place. NEVER re-run
   `main.bicep` against the live app (its appSettings block overwrites KV refs). No Replit Secrets UI.

5. **Hostname-derived logic must handle Azure hosts.** Code branching on `req.hostname` /
   `window.location` must account for `*.azurewebsites.net` AND `poassociation.com`. Prefer
   ALLOWLISTING the known base domain over blocklisting platforms. (Poster child: subdomain
   middleware misread `poassociation.azurewebsites.net` as tenant "poassociation" — fixed 2026-06-07
   via allowlist `hostname.endsWith('.' + APP_URL hostname)`. See [[session-handoff]].)

6. **`WEBSITE_RUN_FROM_PACKAGE=1` is ON.** (a) App runs from a read-only mounted zip — Kudu
   `/api/vfs/site/wwwroot/` shows STALE files (wrong mtimes/missing), so don't trust VFS to verify a
   deploy; check the boot log / behavior. (b) After a green deploy the app reboots into new code with
   a **~2-minute lag** — wait for a fresh `serving on port 5000` line before testing. (c) Anything
   that WRITES to wwwroot at runtime will EFAIL on the read-only mount — note `promptRegistry.setActiveVersion`
   does `writeFileSync(REGISTRY_PATH)`; that write path is unsafe on Azure (move writable data out of
   wwwroot / to DB if ever exercised in prod).

7. **`NODE_OPTIONS=--require <file>` is dangerous on App Service.** A failed `--require` (wrong path
   under the package mount) hard-exits node before any try/catch → ContainerTimeout crash-loop. Avoid
   preloads; keep init in-bundle.

8. **App Insights is LIVE — use it, don't abuse it.** Full telemetry: requests + dependencies +
   exceptions + console traces (every `console.*` auto-becomes a trace, no code changes). Cost
   backstop: **50 MB/day hard cap** on the `poassociation-logs` workspace → do NOT add noisy
   per-request `console.log` (burns the cap as traces). Request telemetry on a fresh workspace can lag
   **~15-20 min** in `AppRequests` (traces/deps ~1-2 min) — don't conclude "broken" too early. Debug
   via the `poassociation-logs` Log Analytics workspace (AppRequests/AppTraces/AppExceptions/
   AppDependencies) or ping Mitch. Wired via `server/appInsights.ts` (Mitch, commits 9c3880f+).

9. **DB driver = node-postgres, keep `sslmode=require`.** The Neon WebSocket driver will NOT connect
   to Flex (Flex speaks standard Postgres TCP). Driver swap already done (local commit `4cf0df4`,
   centralized `server/db.ts`). New Flex conn string lands as KV secret `database-url-azure`.

## Footprint (provisioned 2026-06-06 — you deploy INTO it, don't provision)
| Resource | Value |
|---|---|
| Resource group | `poassociation-rg` (Central US, shared `swaggering-badger` sub) |
| App Service | `poassociation` → `https://poassociation.azurewebsites.net` (B1, Node, system MI) |
| VNet | `snet-app-poa` (10.0.7.0/24) in `vnet-swaggering-badger`; `WEBSITE_VNET_ROUTE_ALL=0` until cutover |
| Key Vault | `poassociation-kv` — app MI has Secrets User |
| DB | new DB `poassociation` + role `poassociation_app` on shared `swaggering-badger-pg` Flex (PG16) |
| Deploy identity | UAMI `poassociation-gh-deployer`, OIDC → `repo:swaggeringbadger/POAssociation:ref:refs/heads/main` |

## Secrets to carry at cutover (seeded into `poassociation-kv`)
`DATABASE_URL` (as `database-url-azure`) · `SESSION_SECRET` (**carry exact value** or every logged-in
user is bounced — self-hosted DB sessions via connect-pg-simple) · `SMTP2GO_API_KEY` ·
`SUPER_ADMIN_EMAILS` · `HOMEHUB_SSO_SECRET` · `APP_URL=https://poassociation.com`.

## Git topology (CRITICAL — two diverged repos)
- **Local Replit git:** branch `feat/self-hosted-auth`; remotes = only `gitsafe-backup` (rejects non-main).
  This is day-to-day dev.
- **GitHub `swaggeringbadger/POAssociation` main:** what **Azure deploys from**. Diverged from local at
  `dfa9e76`: Mitch pushed Azure commits (`5e4c979`, `9c3880f`, deploy.yml, appInsights) there; local has
  `08ccbba`+`4cf0df4` not yet on GitHub. **Getting an app fix live on Azure = integrate onto GitHub main
  (merge Mitch's commits) → push → `gh workflow run deploy.yml`.** Coordinate with Mitch — he owns
  GitHub main + deploy mechanics. PAT in gitignored `persistent-memory/gh-credentials`.
