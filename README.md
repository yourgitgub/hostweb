# host2pro (hostweb)

White-label Wordpress hosting on Cloudflare Workers (vinext) + D1.

## Product locks

- Package **Wordpress** — 3,000 THB / month / site
- Cloudways → DigitalOcean Singapore, 1 server = 1 WP, DO Premium ~2GB (≤ $30)
- Flow: register → USDT TRC20 top-up → deploy
- Temp `{xxxxxxxx}.xgb.app`; deleted → 301 → `https://wordpress.xgb.app`
- Receive wallet: `TMAm332oS6bBhCeDbGqHGG1vwZPTn9iRzq`
- FX start: **1 USDT = 34.50 THB** (admin weekly update; shown to customers)
- Unique system-generated USDT amounts; auto-credit from chain only

## Stack

- Next.js App Router via [vinext](https://github.com/cloudflare/vinext) on Cloudflare Workers
- D1 (`host2pro-db`), Queue producer (`host2pro-jobs`)
- Jobs: `POST /api/jobs/tick` with header `x-job-token: $JOB_TOKEN`

## Local

```bash
npm install
npm run dev
```

Bootstrap admin (from `cloudflare.config.ts` placeholders):

- `admin@host2pro.local` / `changeme-admin-8`

Override via `.dev.vars` in production-shaped envs. Put Cloudflare + Cloudways API tokens in **Admin** UI — do not commit secrets.

Seed a mock ready pool from Admin → **Seed mock ready** before first customer deploy without live Cloudways.

## Deploy

```bash
npm run build
npm run deploy
```

Create the D1 database / queue in the Cloudflare account (or let `cf` provision on first deploy), then set production secrets for `SESSION_SECRET` and `JOB_TOKEN`.
