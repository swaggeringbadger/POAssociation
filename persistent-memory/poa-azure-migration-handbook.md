# POA → Azure Migration & Operating-Model Handbook

**Source:** Mitch McDeere (dev-lead@swaggering-b) → Edward (dev-lead@poassociation), SB task `94eac9fc-c1a1-40fb-99cf-726ea2edc82d`, 2026-06-06.
**Status:** This is the operating model POAssociation moves to. Infra footprint already provisioned (2026-06-06). Third app SB has moved this way (after SB itself + Hazel's Style) — proven playbook (Option A: shared Azure Flex Postgres + shared VNet).

> **Two git flows (owner, 2026-06-06):** local Replit git = day-to-day, commit regularly. **Push to GitHub `swaggeringbadger/POAssociation` = prep for a PROD release**, not routine. See `github-deploy-setup` harness memory for the push recipe.

---

## 1. Migration-journal paradigm — READ FIRST

### Core rule: versioned `migrate`, NEVER `push`, in prod
POA today uses `drizzle-kit push` (`db:push`) — diffs `shared/schema.ts` straight against the live DB and mutates it. No files, no ordered history, no rollback artifact, can silently drop columns. Fine for solo Replit dev; **unsafe on Azure prod.**

Azure flow uses **versioned migrations**:
1. `drizzle-kit generate` → numbered SQL file in `migrations/` + entry in `migrations/meta/_journal.json`.
2. **Commit** that SQL (reviewable in the PR).
3. At release, applied by a **journaled migrator** that records each file's **hash** in `drizzle.__drizzle_migrations`.

### What the journal (`__drizzle_migrations`) buys
- **Idempotent / hash-guarded:** only applies files whose hash isn't already recorded. Re-running a release is safe.
- **Fail-closed, one txn per migration:** each migration's DDL + its journal row commit together. A failed migration rolls back and **stops the release before deploy** — never ship code against a half-migrated DB.
- **Ordered + auditable:** journal is the source of truth for "what schema is live."

### Three hard DON'Ts (each is a scar already earned)
1. **Do NOT migrate on boot.** No `RUN_DB_MIGRATIONS_ON_BOOT`, no migrate call in `server/index.ts`. On Azure this caused an HS prod 503 cold-connect crash loop. Migration is a release step, run once. (Our `server/index.ts` doesn't do this today — keep it that way.)
2. **Do NOT migrate from the GitHub runner.** The Flex is **private** (inside the VNet, no public endpoint). A public CI runner can't reach it. Migrations run from an **ACI (Azure Container Instance) one-shot inside the VNet** — the only thing that can see the DB.
3. **Do NOT keep using `push` against prod.** Switch to `generate` + commit + ACI-`migrate`.

### Gated release order (non-negotiable)
```
backup (pg_dump via ACI, or Flex PITR)  →  migrate (ACI, journaled, fail-closed)  →  deploy code
```
backup fails → stop. migrate fails → stop (no deploy). Only a clean migrate proceeds. Mitch delivers `poassociation-release.mjs` (clone of `hazels-style-release.mjs`) that wires this.

### ⚠️ POA-specific cleanup BEFORE first Azure deploy
`migrations/` + `_journal.json` are **out of sync** (a `push` side effect):
- `_journal.json` lists: `0000_equal_secret_warriors`, `0001_kind_george_stacy`, `0002_dazzling_vector`, `0003_unknown_stryfe`
- `migrations/` actually contains: `0001_add_ai_analysis_tables.sql`, `0002_co_applicant_system.sql`, `0002_dazzling_vector.sql`
- Only `0002_dazzling_vector` matches both; there are two `0002` files + journal tags with no SQL.

**Can't reliably `migrate` from this state.** Clean path (done together at cutover): the **data move carries live schema via pg_dump/restore** → restored Flex already has POA's real current schema → **baseline the journal** (one `__drizzle_migrations` row = "current state") → from there every change is fresh `generate` → commit → ACI-`migrate`. **Don't retro-fit the inconsistent files; baseline and move on.** (Same as HS on 2026-05-29.)

---

## 2. DB driver swap — ✅ DONE (Edward, 2026-06-06)
**Completed ahead of cutover.** New centralized **`server/db.ts`** (node-postgres Pool + drizzle, `ssl: {rejectUnauthorized:false}` unless `sslmode=disable`, `keepAlive`, idle-error handler that won't crash the process, `max:10`). `storage.ts` now `import { db } from "./db"` (still re-exports `db`). All 6 maintenance scripts (clearFormTemplates, clearApplications, checkForms, seedAllTenantForms, seedFormConfigs, updateFormDocuments) swapped to node-postgres inline with SSL. `pg@^8.21.0` + `@types/pg` added as explicit deps. **Verified:** node-postgres connects to the live DB today (heliumdb, 19 tenants, TCP+SSL) — so it works against current Neon AND will work against the Flex. `auth.ts` session store (connect-pg-simple via `conString`) was already node-pg — left unchanged. Left `@neondatabase/serverless` + `ws` in package.json (unused now, harmless). Full build green. Original details below:

### Original instructions
`server/storage.ts` + ~6 maintenance scripts (`checkForms.ts`, `clearApplications.ts`, `clearFormTemplates.ts`, `seedAllTenantForms.ts`, `updateFormDocuments.ts`, …) use the **Neon serverless driver** (talks over WebSockets). The Azure Flex speaks **standard Postgres TCP** — the Neon driver **will not connect to it.**

Swap `drizzle-orm/neon-serverless` + `@neondatabase/serverless` Pool + `ws`/`neonConfig` → **`drizzle-orm/node-postgres`** + `pg` Pool:
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, max: 10 /* + pool resilience */ });
const db = drizzle(pool, { schema });
```
Drop `ws` import + `neonConfig` line. Add pool resilience for always-on Flex (keepalive; error handler that does NOT crash the process — Flex drops idle conns). Mitch shares HS's `db.ts` pattern as reference. **Can request a PR with HS's pattern instead of hand-swapping.**

---

## 3. Footprint already provisioned (2026-06-06) — deploy INTO it, don't provision
| Resource | Value |
|---|---|
| Resource group | `poassociation-rg` (Central US, shared `swaggering-badger` sub) |
| App Service | `poassociation` → `https://poassociation.azurewebsites.net` (B1, Node 20, system-assigned MI) |
| VNet | `snet-app-poa` (10.0.7.0/24) in shared `vnet-swaggering-badger`; **`WEBSITE_VNET_ROUTE_ALL=0`** until cutover |
| Key Vault | `poassociation-kv` (`https://poassociation-kv.vault.azure.net/`); app MI has Secrets User |
| DB target | new DB `poassociation` + role `poassociation_app` on shared **`swaggering-badger-pg`** Flex (PG16) — created at cutover |
| Deploy identity | UAMI `poassociation-gh-deployer`, OIDC federated to `repo:swaggeringbadger/POAssociation:ref:refs/heads/main`; GH secrets `AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID` set |

---

## 4. Deploy mechanics
- **No auto-deploy on push.** On-demand: `gh workflow run deploy.yml` (`workflow_dispatch`, OIDC-authed, zero stored creds). Mitch adds `deploy.yml` (we have none today — were Replit-deployed).
- **Startup command:** `node dist/index.js` (our `build` emits `dist/index.js`). Not `start-prod.js`.
- **Schema-changing release** → gated `poassociation-release.mjs` (backup→ACI-migrate→deploy).
- **Code-only, no new migration** → `gh workflow run deploy.yml -f skip_migrations=true`.

## 5. Key Vault refs — appSettings footguns
Runtime secrets are App Service settings like `@Microsoft.KeyVault(VaultName=poassociation-kv;SecretName=...)`.
- **A settings PUT replaces the WHOLE array** — always GET → modify → PUT the full set or you wipe all other settings (incl. KV refs) and break the live app.
- **App Service caches KV refs hard** — to flip a secret value, point at a **new secret name** (new ref string), don't bump the existing secret. (Why the new DB conn lands as `database-url-azure`, a fresh name.)
- **Never re-run `main.bicep` against the live app** — its `appSettings` block overwrites KV refs. New infra goes in separate deployments.

## 6. Secrets to carry over (seeded into `poassociation-kv` at cutover)
`DATABASE_URL` (new Flex string, as **`database-url-azure`**) · `SESSION_SECRET` (**carry the EXACT value** or every logged-in user is bounced — auth is self-hosted DB sessions via `connect-pg-simple`) · `SMTP2GO_API_KEY` · `SUPER_ADMIN_EMAILS` · `HOMEHUB_SSO_SECRET` (outbound SSO jump) · `APP_URL=https://poassociation.com`.
Adopt **`deploy/required-settings.yml`** convention (name·required·secret·owner·purpose) — deployer reconciles vs App Service + KV each release and **blocks on a missing `required:true` setting**. Mitch seeds a skeleton from live settings.

## 7. Inherited gotchas (SB + HS cutovers)
- **ACI in a VNet has no logs API** — verify via control-plane GET + Kudu, not ACI logs.
- **Docker Hub rate-limits ACI image pulls** — cutover script retries w/ backoff, does NOT stop the app until the ACI is accepted. (`provision-shared-acr.mjs` available, ~$5/mo, if it gets bad.)
- **Burstable Flex CPU credits:** shared Flex is now SB + HS + POA. Watch credit balance during burn-in; next stop is GP `D2ds_v5`.
- **Backup = Flex PITR + ACI pg_dump**, never a runner step (private DB).

---

## What Mitch needs from Edward (action items)
1. **Acknowledge** the push→migrate switch + that we stop `db:push` against prod.
2. **Start the DB-driver swap** (`neon-serverless` → `node-postgres`) in `server/storage.ts` + maintenance scripts — or ask Mitch for a PR with HS's pattern.
3. **Confirm OK to baseline the journal** at cutover (discard inconsistent existing migration files, start clean from restored live schema).
4. Mitch delivers: `poassociation-release.mjs`, `deploy.yml`, `db.ts`/pool-resilience reference, `required-settings.yml` skeleton.

Ping `@dev-lead@swaggering-b` with questions.
</content>
