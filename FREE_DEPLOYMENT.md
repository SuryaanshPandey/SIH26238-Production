# SIH26238 v25 — Zero-Payment Deployment

This deployment keeps the working application architecture but moves durable state off Render's ephemeral filesystem.

## Services

- Student App: Next.js on Render Free
- Operations API: Next.js + Prisma on Render Free, PostgreSQL in Supabase
- Verification API: FastAPI on Render Free, PostgreSQL JSONB tables + Supabase Storage
- Android APK: points only to HTTPS service URLs

Render Free services sleep after 15 minutes without inbound traffic. The first request after sleep may take about a minute to wake the service. Free filesystems are ephemeral, so do not store SQLite databases or uploaded documents on Render.

## 1. Create Supabase project

Create a Supabase project on the Free plan.

In Supabase, open `Connect` and copy the **Session pooler** PostgreSQL connection string. This is the IPv4-friendly option for a hosted backend. Replace `[YOUR-PASSWORD]` with the database password.

In `SQL Editor`, run `supabase-free-setup.sql`.

The bucket `sih26238-documents` is private.

## 2. Get Supabase credentials

From Supabase:

- `SUPABASE_URL`: Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-side secret key
- `DATABASE_URL`: Session pooler PostgreSQL connection string

Never put `SUPABASE_SERVICE_ROLE_KEY` into the Student App or APK.

## 3. Deploy Render Blueprint

This repository contains `render.free.yaml` specifically for the free deployment.

In Render, create a new Blueprint from this GitHub repository and point it at `render.free.yaml`.

If the CLI is preferred:

```powershell
render workspace set tea-d62c7hkoud1c739f108g
render blueprints validate .\render.free.yaml
```

Then create/sync the Blueprint using the Render dashboard. The secret fields marked `sync: false` must be supplied in Render.

## 4. Set secrets

Operations:

```text
DATABASE_URL=<Supabase Session pooler URL>
```

Verification:

```text
DATABASE_URL=<same Supabase Session pooler URL>
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase server-side secret key>
```

## 5. Test health endpoints

```text
https://sih26238-operations-v25-free.onrender.com/api/v1/health
https://sih26238-verification-v25-free.onrender.com/health
https://sih26238-student-v25-free.onrender.com/
```

Operations should report a healthy database. Verification should report `status: ok`.

## 6. Test persistence

Create a test application, upload a PDF/JPG/PNG, then let the free service sleep. After it wakes:

- the Operations database record must still exist in Supabase Postgres
- the document object must still exist in the private Supabase Storage bucket

## 7. Build Android APK

Use the URLs above with:

```powershell
cd mobile-app
.\BUILD_PRODUCTION_APK.ps1 `
  -StudentAppUrl "https://sih26238-student-v25-free.onrender.com" `
  -MobileOpsUrl "https://sih26238-operations-v25-free.onrender.com/api/v1" `
  -MobileVerificationUrl "https://sih26238-verification-v25-free.onrender.com"
```

The script rejects non-HTTPS endpoints.

## Important limitations

- Render Free web services sleep after 15 minutes of inactivity and can take about a minute to wake.
- Render Free services have a monthly included instance-hour limit; multiple free services consume that allowance separately.
- Supabase Free currently includes 500 MB database size and 1 GB file storage. Monitor usage.
- Protected government integrations such as DigiLocker require official credentials/onboarding; this deployment does not invent or embed those credentials.
