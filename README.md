# host2pro (hostweb)

White-label Wordpress hosting on **Cloudflare Workers (vinext) + D1 + Queues + Cron**.

Target hostname: **https://wordpress.xgb.app** · temp sites `{xxxxxxxx}.xgb.app`

## Product locks

- Package **Wordpress** — 3,000 THB / month / site
- Cloudways → DigitalOcean Singapore, 1 server = 1 WP, DO Premium ~2GB (≤ $30)
- Flow: register → USDT TRC20 top-up → deploy
- Temp `{xxxxxxxx}.xgb.app`; deleted → **301** → `https://wordpress.xgb.app`
- Wallet: `TMAm332oS6bBhCeDbGqHGG1vwZPTn9iRzq` · FX start **1 USDT = 34.50 THB**
- Unique system-generated USDT amounts; auto-credit from chain only
- API tokens via **admin UI** or **Worker secrets** — never commit

## Stack

| Piece | Detail |
| --- | --- |
| App | vinext App Router (`npm run dev` / `build` / `deploy`) |
| Config | `cloudflare.config.ts` (primary) + `wrangler.jsonc` (D1 migrations / secrets helper) |
| DB | D1 `host2pro-db` |
| Jobs | Cron `* * * * *` + Queue `host2pro-jobs` via `worker/index.ts` · also `POST /api/jobs/tick` |
| Integrations | Cloudflare DNS / Registrar / Dynamic Redirect · Cloudways API v2 Bearer |

## Local

```bash
npm install
cp .dev.vars.example .dev.vars   # edit placeholders; leave CF/CW tokens empty for mock mode
npm run dev                      # http://localhost:5173
```

Bootstrap admin (placeholders): `admin@host2pro.local` / `changeme-admin-8`

Without Cloudways token: Admin → **Seed mock ready** before first deploy.

```bash
npm run build
curl -X POST http://localhost:5173/api/jobs/tick -H "x-job-token: local-dev-job-token"
```

## Deploy to wordpress.xgb.app

Secrets are **not** in git. Set them in the Cloudflare account that owns `xgb.app`.

### 1) One-time Cloudflare resources

```bash
# Auth (browser) OR use API token env for CI
npx cf auth login
# export CLOUDFLARE_API_TOKEN=…   # account token for wrangler/cf
# export CLOUDFLARE_ACCOUNT_ID=…

# D1
npx wrangler d1 create host2pro-db
# → paste the returned database_id into wrangler.jsonc d1_databases[0].database_id
#    (cloudflare.config uses name-based binding; first deploy can also auto-provision)

# Queue
npx wrangler queues create host2pro-jobs

# Apply SQL migrations to remote D1
npm run db:migrate:remote
```

### 2) Worker secrets (production)

```bash
npx wrangler secret put SESSION_SECRET --name host2pro
npx wrangler secret put JOB_TOKEN --name host2pro
npx wrangler secret put CLOUDFLARE_API_TOKEN --name host2pro
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --name host2pro
npx wrangler secret put CLOUDFLARE_ZONE_ID_XGB --name host2pro   # zone id for xgb.app
npx wrangler secret put CLOUDWAYS_ACCESS_TOKEN --name host2pro
npx wrangler secret put BOOTSTRAP_ADMIN_EMAIL --name host2pro
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD --name host2pro
```

Also set Worker var `ENVIRONMENT=production` (dashboard or `wrangler.jsonc` vars) so session cookies use `Secure`.

You may instead paste CF/CW tokens in **Admin → settings** after first login; env secrets win when both are set.

### 3) Build & deploy (vinext)

```bash
npm run build
npm run deploy
# → vinext-cloudflare deploy (reads cloudflare.config.ts)
```

`cloudflare.config.ts` already lists custom domain `wordpress.xgb.app`. Confirm in the dashboard that the Worker is attached to that hostname (DNS CNAME/AAAA for `wordpress` in zone `xgb.app`).

Optional: add a Worker route `*.xgb.app/*` so deleted temp hosts that still resolve can hit middleware 301. Primary deleted path uses Cloudflare Dynamic Redirect (when API token present).

### 4) Post-deploy checklist

1. Open https://wordpress.xgb.app → landing
2. Login as bootstrap admin → set FX / pool size if needed
3. Confirm cron appears on Worker triggers; or hit  
   `curl -X POST https://wordpress.xgb.app/api/jobs/tick -H "x-job-token: $JOB_TOKEN"`
4. Seed pool: Admin **Maintain pool** (live Cloudways) or **Seed mock ready**
5. Customer flow: register → top-up → deploy → power → delete (expect 301)

## Credential resolution

| Need | Sources (first wins) |
| --- | --- |
| Cloudflare API | `CLOUDFLARE_API_TOKEN` secret → admin_settings |
| Zone xgb.app | `CLOUDFLARE_ZONE_ID_XGB` → admin_settings |
| Account | `CLOUDFLARE_ACCOUNT_ID` → admin_settings |
| Cloudways v2 | `CLOUDWAYS_ACCESS_TOKEN` → admin_settings |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local vinext / workerd |
| `npm run build` | Production Worker bundle |
| `npm run deploy` | Deploy via `@vinext/cloudflare` |
| `npm run db:migrate:local` | Apply `migrations/` to local D1 |
| `npm run db:migrate:remote` | Apply `migrations/` to remote D1 |

## Remaining ops (human)

- Cloudflare account must own `xgb.app` + billing for Registrar
- Cloudways Access Token with Server + Application scopes
- Rotate any tokens that were pasted in chat
- This environment has **no** Cloudflare/Cloudways credentials — deploy must be run where those secrets exist
