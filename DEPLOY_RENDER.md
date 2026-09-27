# SIH26238 v25 — Production Deployment on Render

This deployment path intentionally keeps the existing application architecture intact:

```text
Android APK
   -> HTTPS Student App (Next.js)
      -> HTTPS Operations API (Next.js + existing Prisma/SQLite)
      -> HTTPS Verification API (FastAPI + existing SQLite/document storage)
```

The goal is to avoid rewriting working application logic merely to make it publicly reachable.

## 0. What this deployment requires

Render's free services are useful for testing but are not intended for production, and persistent disks are available on paid services. This configuration therefore uses the `starter` plan for all three web services and adds a 10 GB persistent disk to Operations and Verification.

The persistent disks are important because Operations uses SQLite and Verification stores its SQLite state plus uploaded documents on the local filesystem.

## 1. Put this project in GitHub

Create a GitHub repository and upload the extracted contents of this project so that the repository root contains:

```text
render.yaml
student-app/
operations/
verification/
mobile-app/
```

Do not put the whole ZIP inside the repository. Extract it first.

Recommended repository visibility: private unless you intentionally want the source public.

## 2. Create the Render Blueprint

1. Open Render Dashboard.
2. Choose `New` -> `Blueprint`.
3. Connect the GitHub repository.
4. Render will detect the root-level `render.yaml`.
5. Review the three services and two persistent disks.
6. Apply/create the Blueprint.

The Blueprint creates:

```text
sih26238-student-v25
sih26238-operations-v25
sih26238-verification-v25
```

and persistent disks:

```text
operations-data  -> /var/data
verification-data -> /var/data
```

## 3. Wait for all three services to deploy

Open each service and wait for its deploy to become `Live`.

Check the health endpoints:

### Student App

```text
https://<student-host>/
```

### Operations

```text
https://<operations-host>/api/v1/health
```

### Verification

```text
https://<verification-host>/health
```

The Operations health response should report `database: ok`.
The Verification health response should report `status: ok`.

## 4. IMPORTANT — verify the actual Render URLs

The Blueprint uses predictable names. In the normal case the URLs will be:

```text
https://sih26238-student-v25.onrender.com
https://sih26238-operations-v25.onrender.com
https://sih26238-verification-v25.onrender.com
```

If Render changes a service name because of a naming collision, use the actual URLs shown in the dashboard.

If the actual hostnames differ, update these values in Render and redeploy:

### Student service

```text
NEXT_PUBLIC_RIJVAN_API_URL=https://<actual-operations-host>/api/v1
NEXT_PUBLIC_VERIFICATION_API_URL=https://<actual-verification-host>
```

### Operations service

```text
STUDENT_APP_ORIGIN=https://<actual-student-host>
VERIFICATION_SERVICE_URL=https://<actual-verification-host>
DOCUMENT_SERVICE_URL=https://<actual-verification-host>
DIGILOCKER_OAUTH_REDIRECT_URI=https://<actual-operations-host>/api/v1/government/digilocker/callback
```

### Verification service

```text
SIH_CORS_ORIGINS=https://<actual-student-host>
```

Because `NEXT_PUBLIC_*` variables are used by Next.js, changing those values requires a rebuild/deploy of the Student service.

## 5. First Operations startup

Operations uses the existing SQLite Prisma schema. Its Render start script runs:

```text
npm run prisma:migrate
```

which is the project's existing `prisma db push` command, followed by Next.js startup.

No SQLite -> PostgreSQL schema migration is performed. This is deliberate to reduce the risk of changing behavior in the frozen build.

## 6. Verification persistent storage

Verification is configured as:

```text
SIH_STORAGE_BACKEND=sqlite
SIH_STORAGE_PATH=/var/data/sih26238.db
SIH_DOCUMENT_STORAGE_PATH=/var/data/documents
```

Uploaded documents therefore stay below the persistent disk mount.

Do not remove the Verification disk after you start using the service; doing so can remove access to stored application/document state.

## 7. Government integrations

The application keeps official protected integrations disabled until the required onboarding/credentials exist.

Do not put any DigiLocker/OAuth/client secret, database credential, JWT signing secret, or server API key into:

- `NEXT_PUBLIC_*` variables
- the Android APK
- browser-visible JavaScript
- `render.yaml`

Render generates `JWT_SECRET` automatically in the Blueprint.

DigiLocker can be configured later by adding the official client credentials in the Operations service environment after partner onboarding.

## 8. Full application smoke test

Once all three services are live, test in this order:

```text
1. Open Student App
2. Register a student
3. Log in
4. Open dashboard
5. Open scholarship catalogue
6. Open eligibility
7. Create an application
8. Upload a document
9. Open verification
10. Open application status
11. Open deficiencies / actions
12. Open JAGO
13. Check profile and notifications
```

If any API call fails, inspect the Operations or Verification service logs before changing the Android project.

## 9. Build the final Android APK

Once the three HTTPS URLs are confirmed, use Android Studio or the included production build script.

Example Gradle command from:

```text
mobile-app/android
```

```powershell
& "C:\Gradle\gradle-9.6.0\bin\gradle.bat" clean :app:assembleRelease `
  -PstudentAppUrl="https://<actual-student-host>" `
  -PmobileOpsUrl="https://<actual-operations-host>/api/v1" `
  -PmobileVerificationUrl="https://<actual-verification-host>" `
  -PallowCleartext=false
```

The resulting release APK will be:

```text
mobile-app/android/app/build/outputs/apk/release/app-release.apk
```

This APK does not depend on your PC or LAN.

## 10. Final architecture

```text
                     INTERNET
                         |
                         v
              +----------------------+
              |      Android APK     |
              |   Native WebView     |
              +----------+-----------+
                         |
                       HTTPS
                         |
                         v
              +----------------------+
              |      Student App      |
              |       Next.js         |
              +----+-------------+----+
                   |             |
                 HTTPS         HTTPS
                   |             |
                   v             v
          +-------------+   +-------------+
          | Operations  |   | Verification |
          | Next.js     |   | FastAPI      |
          | SQLite      |   | SQLite       |
          +------+------+   +------+------+
                 |                  |
          /var/data disk     /var/data disk
```

## 11. Rollback strategy

Do not upgrade Next.js, AGP, Gradle, Prisma, or database providers as part of the first deployment.

The first production deployment should change only:

```text
local URLs -> HTTPS service URLs
local filesystem -> persistent Render disks
local startup -> Render startup scripts
```

This preserves the frozen application behavior while changing its runtime environment.
