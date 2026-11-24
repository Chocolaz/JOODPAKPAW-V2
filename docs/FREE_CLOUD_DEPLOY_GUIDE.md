# JoodPakPaw V2 — Free-Tier Cloud Deployment Guide

This guide describes how to deploy the **JoodPakPaw V2** monorepo (`joodpakpaw-frontend`, `joodpakpaw-api`, `joodpakpaw-ml`) using **100% Free-Tier Cloud Services** with zero source-code modifications — switching from local Docker Compose to cloud hosting solely through environment variables.

---

## 1. Architecture & Free-Tier Stack Overview

| Component | Service / Directory | Local Docker (`docker-compose.yml`) | Free-Tier Cloud Target | Key Free-Tier Adaptations |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `joodpakpaw-frontend` (Next.js 16) | `http://localhost:3000` | **Vercel Hobby** | Root path `/` (`NEXT_PUBLIC_BASE_PATH=""`), `images.remotePatterns` pre-configured for R2 & Supabase Storage |
| **Core API** | `joodpakpaw-api` (Express + Prisma + Socket.IO v4) | `http://localhost:8000` | **Render Free Web Service** or **Koyeb Free** | `/health` endpoint, 1.5s `AbortSignal.timeout` + In-Process Hybrid ML Fallback, In-Memory cache & cron fallback |
| **ML Service** | `joodpakpaw-ml` (Python 3.12 FastAPI + Scikit-Learn) | `http://localhost:5000` | **Hugging Face Spaces (Docker, `PORT=7860`)** or **Render Free** | Non-root `mluser` container, 60s In-Memory Catalog/TF-IDF Snapshot, PgBouncer-safe `psycopg_pool` (`max_size=3`) |
| **PostgreSQL 16** | Database (42 tables, 77 provinces) | `joodpakpaw-postgres:5432` | **Supabase Free** (500 MB) or **Neon Serverless Postgres** | Pooled `DATABASE_URL` (`?pgbouncer=true&sslmode=require&connection_limit=5&pool_timeout=20`) + `DIRECT_URL` for Prisma migrations |
| **Object Storage** | Media `.webp` uploads & S3 GC | `joodpakpaw-minio:9000` | **Cloudflare R2 Free** (10 GB) or **Supabase Storage** | `@aws-sdk/client-s3` adapter + Supabase REST fallback (`S3_PUBLIC_URL` + S3 garbage collection) |
| **Cache & Scheduler** | Response cache & booking lifecycle sweeps | `joodpakpaw-redis:6379` | **Upstash Free Redis** or **Auto In-Memory Fallback** | Leaving `REDIS_URL` empty activates zero-crash In-Memory `CacheService` + 15-min in-process scheduler |

```
[Vercel Hobby: joodpakpaw-frontend (/)]
       │  HTTPS REST + Socket.IO WebSocket (/api/socket.io)
       ▼
[Render / Koyeb Free: joodpakpaw-api (:8000)] ──(<= 1500ms HTTP)──▶ [HF Spaces / Render: joodpakpaw-ml (:7860 / :5000)]
       │                                    └──(timeout/cold-start)──▶ [In-Process 3-Stage Hybrid Fallback]
       ├──▶ [Supabase / Neon Postgres (Pooled DATABASE_URL)]
       └──▶ [Cloudflare R2 / Supabase Storage (.webp + S3 GC)]
```

---

## 2. Database (`Supabase Free` or `Neon Serverless Postgres`)

### 2.1 Connection Strings (`DATABASE_URL` vs `DIRECT_URL`)
Prisma requires two URLs on serverless/pooled PostgreSQL providers such as Supabase Transaction Pooler (port `6543`) or Neon:

- **`DATABASE_URL` (Runtime Pooled Connection — used by `joodpakpaw-api` & `joodpakpaw-ml`):**
  ```env
  # Supabase Transaction Pooler (port 6543) example
  DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=5&pool_timeout=20&connect_timeout=30"
  ```
- **`DIRECT_URL` (Direct Connection — used ONLY by `prisma migrate deploy` / `prisma db push`):**
  ```env
  # Supabase Direct / Session connection without pgbouncer=true
  DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require"
  ```

### 2.2 How `joodpakpaw-ml` Handles Prisma URLs & PgBouncer
Prisma-specific query parameters (`schema`, `pgbouncer`, `connection_limit`, `pool_timeout`, `statement_cache_size`) cause `psycopg` / `libpq` to fail if passed raw. `joodpakpaw-ml` handles this automatically:
1. **`joodpakpaw-ml/app/config.py` (`sanitize_database_url`)**: Strips `schema`, `pgbouncer`, `connection_limit`, `pool_timeout`, and `statement_cache_size` from `DATABASE_URL` while preserving `sslmode=require` and `connect_timeout`.
2. **`joodpakpaw-ml/app/database.py` (`DatabaseClient`)**: Opens a read-only `psycopg_pool.ConnectionPool` with `min_size=1`, `max_size=3`, `timeout=5.0`, and `kwargs={"prepare_threshold": None}` so prepared statements never collide behind Supabase/Neon PgBouncer pools.

### 2.3 Initial Schema & Seed Commands (Run Locally Against Cloud DB)
```powershell
cd joodpakpaw-api
npx prisma migrate deploy
npx tsx prisma/seed.ts
# Optional rich multi-province demo dataset & ML signals:
npx tsx prisma/seed-rich-data.ts
```

---

## 3. Object Storage (`Cloudflare R2 Free 10GB` or `Supabase S3`)

`joodpakpaw-api/src/services/storage.service.ts` converts every uploaded image to `.webp` (max `1920x1920`, quality `82`) via `sharp` and cleans up replaced/deleted objects via S3 Garbage Collection (`deleteObjectFromS3`).

### 3.1 Option A: Cloudflare R2 (10 GB Free, Zero Egress Fees)
1. Create a bucket named `joodpakpaw-media` in Cloudflare R2 and enable **Public Development URL** (e.g., `https://pub-<hash>.r2.dev`) or custom domain.
2. Create an R2 API Token with **Object Read & Write** scope on `joodpakpaw-media`.
3. Configure R2 Bucket **CORS Policy** to allow your Vercel frontend origin:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Set environment variables on `joodpakpaw-api`:
   ```env
   S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
   S3_REGION="auto"
   S3_ACCESS_KEY="<R2_ACCESS_KEY_ID>"
   S3_SECRET_KEY="<R2_SECRET_ACCESS_KEY>"
   S3_BUCKET="joodpakpaw-media"
   S3_PUBLIC_URL="https://pub-<hash>.r2.dev"
   S3_FORCE_PATH_STYLE="false"
   ```

### 3.2 Option B: Supabase Storage (1 GB Free)
When `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set (alongside a public bucket `joodpakpaw-media`), `storage.service.ts` uploads via Supabase Storage REST API and falls back to the S3 adapter if needed:
```env
SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
SUPABASE_ANON_KEY="<SUPABASE_ANON_OR_SERVICE_KEY>"
S3_BUCKET="joodpakpaw-media"
S3_PUBLIC_URL="https://<PROJECT_REF>.supabase.co/storage/v1/object/public/joodpakpaw-media"
```

### 3.3 Next.js Image Allowlist
`joodpakpaw-frontend/next.config.ts` already allows `**.r2.dev`, `**.cloudflarestorage.com`, and `**.supabase.co` in `images.remotePatterns`. If you attach a custom media domain, add it to `next.config.ts`.

---

## 4. Cache & Scheduler (`Upstash Redis` or Auto In-Memory Fallback)

- **Zero-Config Free Cloud Mode (Empty `REDIS_URL`):**
  Leave `REDIS_URL` unset or empty (`REDIS_URL=""`) on Render/Koyeb.
  - `joodpakpaw-api/src/services/cache.service.ts` runs an in-memory `Map` cache with per-key TTL (`60s` property lists/ML catalog snapshot, `30s` recommendation responses) and an `unref()` cleanup timer.
  - `joodpakpaw-api/src/services/bookingLifecycle.service.ts` runs an **in-process 15-minute scheduler** plus lazy reconciliation on read/write paths (auto-expiring unpaid `pending` bookings and auto-completing `confirmed` stays past `18:00 ICT` on check-out day).
  - `GET /health` accurately reports `"redis": "in-memory-fallback"`.
- **Upstash Free Redis (Optional Multi-Instance Upgrade):**
  Set `REDIS_URL="rediss://default:<TOKEN>@<HOST>.upstash.io:6379"`. `GET /health` will report `"redis": "configured"`.

---

## 5. Backend (`joodpakpaw-api` on Render Free / Koyeb Free)

### 5.1 1-Click Render Blueprint (`render.yaml` — Singapore)
The repository root includes [`render.yaml`](../render.yaml) configured for **Render Free (`region: singapore`, `branch: main`)** provisioning both `joodpakpaw-api` and `joodpakpaw-ml`:
1. Open **Render Dashboard -> New -> Blueprint** and connect `Chocolaz/JOODPAKPAW-V2` (branch `main`).
2. `JWT_SECRET` and `JWT_REFRESH_SECRET` are auto-generated by Render (`generateValue: true`), while sensitive secrets (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `S3_PUBLIC_URL`, `ML_INTERNAL_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, `ML_SERVICE_URL`) prompt securely at creation time (`sync: false`).

### 5.2 Manual Docker / Node Setup
Deploy `joodpakpaw-api` as a Docker Web Service (using `joodpakpaw-api/Dockerfile`) or Node.js service (`npm ci && npx prisma generate && npm run build`, start command `npm start`).

### Required Environment Variables
```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres?sslmode=require
REDIS_URL=
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<R2_ACCESS_KEY_ID>
S3_SECRET_KEY=<R2_SECRET_ACCESS_KEY>
S3_BUCKET=joodpakpaw-media
S3_PUBLIC_URL=https://pub-<hash>.r2.dev
S3_FORCE_PATH_STYLE=false
JWT_SECRET=<64_CHAR_RANDOM_SECRET>
JWT_REFRESH_SECRET=<64_CHAR_DIFFERENT_RANDOM_SECRET>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://your-app.vercel.app
# Optional comma-separated extra trusted browser origins (strictly enforced when NODE_ENV=production)
CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
# Optional Free-Tier Transactional Email via Resend (3,000 free emails/month) for OTP & Password Reset
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM="JoodPakPaw <no-reply@joodpakpaw.com>"
ML_SERVICE_URL=https://your-ml-service.hf.space
ML_TIMEOUT_MS=1500
ML_INTERNAL_SECRET=<SHARED_RANDOM_SECRET>
```

### Production Security & Email Delivery Notes
- **Fail-Fast JWT Guard:** When `NODE_ENV=production`, `joodpakpaw-api` refuses to boot if `JWT_SECRET` or `JWT_REFRESH_SECRET` are missing or still set to the `_dev` defaults.
- **Strict Production CORS & `trust proxy`:** `app.set('trust proxy', 1)` ensures rate-limiting uses the true client IP behind Render/Koyeb/Nginx proxies, and unlisted origins receive no `Access-Control-Allow-Origin` header in `production` (configure additional domains via `CORS_ORIGINS`).
- **Transactional Email (`RESEND_API_KEY` & `EMAIL_FROM`):** When `RESEND_API_KEY` is configured, OTP verification and password-reset emails are sent via the Resend REST API with zero extra npm dependencies. In `production`, OTP codes and password-reset tokens are never returned in HTTP responses.

### Health Check & 1.5s Cold-Start Fallback Behavior
- Configure your cloud provider health check path to **`/health`** (returns `200 OK` with `services.database`, `services.redis`, `services.storage`, and `ml: { url, timeoutMs, fallbackReady: true }`).
- Free-tier ML containers sleep after inactivity (cold start ~10–30s). `recommendation.service.ts` enforces **`ML_TIMEOUT_MS=1500`** via `AbortSignal.timeout`:
  - If `joodpakpaw-ml` does not reply within `1500ms` (or returns 5xx), `joodpakpaw-api` immediately executes the **In-Process 3-Stage Pet-Aware Hybrid Fallback** (Tier A/B multi-pet filtering, energy-facility compatibility, reconciled time-decay, Bayesian rating, and similar properties) and returns `meta.source = "in_process_fallback"` without blocking the home or detail pages.

---

## 6. ML Microservice (`joodpakpaw-ml` on Hugging Face Spaces / Render Free)

`joodpakpaw-ml/Dockerfile` uses a multi-stage `python:3.12-slim` build running as non-root user **`mluser`** and binds `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-5000}`.

### Option A: Hugging Face Spaces (Docker SDK — 16 GB RAM Free)
1. Create a new **Space** -> Select **Docker (Blank)** template.
2. Push or upload the `joodpakpaw-ml/` directory contents as the Space root.
3. Add a `README.md` Space header specifying `app_port: 7860` (or set Space Variable `PORT=7860`).
4. Set Space **Secrets** / **Variables**:
   ```env
   PORT=7860
   DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
   SNAPSHOT_TTL_SECONDS=60
   TIME_DECAY_LAMBDA=0.05
   ML_INTERNAL_SECRET=<SAME_SHARED_SECRET_AS_API>
   ```
5. Set `ML_SERVICE_URL=https://<hf-user>-<space-name>.hf.space` on `joodpakpaw-api`.

### Option B: Render Free Web Service (Docker)
- Root Directory: `joodpakpaw-ml`
- Runtime: `Docker`
- Health Check Path: `/health`
- Environment Variables: `PORT=5000`, `DATABASE_URL`, `SNAPSHOT_TTL_SECONDS=60`, `TIME_DECAY_LAMBDA=0.05`, `ML_INTERNAL_SECRET`.

### Security Note (`ML_INTERNAL_SECRET`)
When `ML_INTERNAL_SECRET` is configured on both services:
- `joodpakpaw-ml` verifies `X-ML-Secret` using constant-time `hmac.compare_digest` on `POST /ml/v1/refresh` (returning `403` if invalid/missing).
- `joodpakpaw-api` automatically attaches `X-ML-Secret` when triggering cache refreshes.

---

## 7. Frontend (`joodpakpaw-frontend` on Vercel Hobby)

1. Import the GitHub repository in **Vercel** and set **Root Directory** to `joodpakpaw-frontend`.
2. Framework Preset: **Next.js** (uses root path `/` by default — no legacy subpath prefix). `joodpakpaw-frontend/vercel.json` pins `installCommand` (`npm install --legacy-peer-deps`) and `buildCommand` (`npm run build` with `--webpack` SVGR support).
3. Set **Environment Variables** in Vercel Project Settings:
   ```env
   # Exact variable read by lib/apiClient.ts (keep trailing slash)
   NEXT_PUBLIC_API_BASE_URL=https://your-api.onrender.com/

   # Empty string for Root Path '/'
   NEXT_PUBLIC_BASE_PATH=

   # Socket.IO server origin (no trailing slash) & path
   NEXT_PUBLIC_SOCKET_URL=https://your-api.onrender.com
   NEXT_PUBLIC_SOCKET_PATH=/api/socket.io

   # Google Maps JavaScript API Key (Split Map View & Host Step 2 Location Map)
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<YOUR_GOOGLE_MAPS_API_KEY>
   ```
   > **Note:** `joodpakpaw-frontend/lib/apiClient.ts` reads `NEXT_PUBLIC_API_BASE_URL` (not `NEXT_PUBLIC_API_URL`), and `lib/socket.ts` reads `NEXT_PUBLIC_SOCKET_URL` (falling back to `new URL(NEXT_PUBLIC_API_BASE_URL).origin`). Always include the trailing `/` in `NEXT_PUBLIC_API_BASE_URL`.

### 7.1 Postman Production Collection & Environment
Import [`postman/JoodPakPaw_V2.postman_collection.json`](../postman/JoodPakPaw_V2.postman_collection.json) (`13` folders / `102` requests using `{{jwt_token}}`) together with [`postman/JoodPakPaw_Production.postman_environment.json`](../postman/JoodPakPaw_Production.postman_environment.json) (`baseUrl` pointing to Render) into Postman Cloud.

---

## 8. Post-Deploy Smoke Verification Checklist

Run these checks immediately after deploying all services:

1. **API Health & Env Wiring:**
   - `GET https://<api-domain>/health` -> Verify `200 OK`, `services.database === "connected"`, `ml.fallbackReady === true`, and `ml.timeoutMs === 1500`.
2. **ML Microservice Health & Snapshot:**
   - `GET https://<ml-domain>/health` -> Verify `200 OK`, `service === "joodpakpaw-ml"`, `db_connected === true`, and `catalog_size > 0`.
3. **CORS & Guest Cold-Start Feed:**
   - Open `https://<vercel-domain>/` in an incognito window (logged out).
   - Confirm **"Popular Picks to Get Started"** loads from `GET /api/v1/properties/recommend` with English match pills (`matchReasons`) and zero CORS errors in DevTools Console.
   - Confirm `Recently Viewed` (once properties are visited) triggers a single batch `GET /api/v1/properties?ids=...` request.
4. **Socket.IO Real-Time WebSocket Upgrade:**
   - Sign in on `https://<vercel-domain>/` -> Open DevTools -> Network -> WS tab -> Confirm `/api/socket.io/?...&transport=websocket` connects (`101 Switching Protocols`).
5. **Admin ML Inspector & Live/Fallback Verification:**
   - Sign in as Admin (`admin@joodpakpaw.com`) -> Navigate to `/admin/ml-inspector`.
   - Confirm status badge shows **Live ML Service** (`mlServiceReachable: true`), inspect 4-part score bars (`sContent`, `sCompat`, `sQuality`, `sPopularity`) across user personas, and click **Refresh ML Cache** (`POST /api/v1/admin/ml/refresh`).
   - Optionally verify **RBAC guard**: hitting `GET /api/v1/properties/recommend?debug=true` as a guest or non-admin returns `403 A-3007`.
   - Optionally verify **Fallback resilience**: temporarily pause `joodpakpaw-ml` and reload `/` or `/admin/ml-inspector` — responses complete within `<1500ms` with `meta.source === "in_process_fallback"`.
