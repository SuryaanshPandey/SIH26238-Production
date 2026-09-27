# SIH26238 Integration Baseline

## Integrated module boundaries

- `verification/`: Suryaansh — Documents + Verification Intelligence.
- `operations/`: Rijvan — Scholarship domain/workflow/intelligence.
- `student-app/`: Suryansh — Student-facing experience.

Integration is API-only. No module reads another module database.

## Canonical demo

Student: created per registration
Application: created per authenticated student submission
Institution: `INST-JH-00412`

The demo deliberately contains a State e-District income discrepancy: submitted/declared income ₹180,000 vs source record ₹240,000. This is used to exercise mismatch + manual-review signaling.

## Validation completed in the build environment

- Verification Python suite: 81 passed.
- Python compilation: passed.
- TypeScript/TSX syntax parsing across Operations + Student App: 162 files, zero syntax failures.
- Live FastAPI verification service: healthy.
- Real source query: State e-District returns the Asha demo record.
- Real verification run: produces mismatch and traceable evidence.

Full `npm install`, `next build`, and Prisma execution were not run in this sandbox because the npm registry was unavailable here. They must be run on the local Windows environment after dependencies are installed.

## Run locally

### Terminal 1 — Verification
```powershell
cd C:\Users\surya\Desktop\SIH\me\SIH26238-Documents-Verification
$env:SIH_STORAGE_BACKEND="sqlite"
$env:SIH_STORAGE_PATH=".\data\integration.db"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Terminal 2 — Operations
```powershell
cd C:\Users\surya\Desktop\SIH\rijvan
npm install
npx prisma db push
npm run db:seed
$env:VERIFICATION_PROVIDER="http"
$env:DOCUMENT_PROVIDER="http"
$env:VERIFICATION_SERVICE_URL="http://127.0.0.1:8000"
$env:DOCUMENT_SERVICE_URL="http://127.0.0.1:8000"
npm run dev -- -p 3001
```

### Terminal 3 — Student App
```powershell
cd C:\Users\surya\Desktop\SIH\suryansh
npm install
Copy-Item .env.example .env.local -Force
$env:NEXT_PUBLIC_USE_LIVE_BACKEND="true"
$env:NEXT_PUBLIC_RIJVAN_API_URL="http://127.0.0.1:3001/api/v1"
$env:NEXT_PUBLIC_VERIFICATION_API_URL="http://127.0.0.1:8000"
npm run dev -- -p 3000
```

Open `http://localhost:3000`.

## Real-data mode

The integrated launcher now enforces `DEMO_MODE=false`, `REAL_DATA_MODE=true`, `VERIFICATION_PROVIDER=http`, `DOCUMENT_PROVIDER=http`, and `NEXT_PUBLIC_USE_LIVE_BACKEND=true`. Test/mock adapters remain available only for automated tests and explicit demo development. Live scholarship discovery comes from the official NSP public catalogue; protected government sources return `NOT_CONFIGURED` until authorized endpoints/credentials are supplied.

The scholarship catalogue is sourced from the public National Scholarship Portal page at `https://scholarships.gov.in/All-Scholarships`. Personal records from protected systems such as DigiLocker, UIDAI, APAAR and UDISE+ are never fabricated: the app reports `NOT_CONFIGURED`/`SOURCE_UNAVAILABLE` until an authorized connector endpoint and credentials are supplied.
