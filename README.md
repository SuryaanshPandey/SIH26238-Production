# SIH26238 — Unified Scholarship Platform (Integrated Final Product)

This package combines the three team modules into one runnable local product:

```text
Student Experience (Suryansh)
        ↓ HTTP
Scholarship Operations + Workflow (Rijvan)
        ↓ HTTP
Documents + Verification Intelligence (Suryaansh)
```

## One-click run

1. Extract this ZIP.
2. Open the extracted folder.
3. Double-click **`START.bat`**.
4. The launcher installs missing dependencies, prepares a clean real-data database, starts all three services, waits for health, and opens the student app.

The first run requires an internet connection for npm/Python dependency installation.

## URLs

- Student app: http://localhost:3000
- Operations command center: http://localhost:3001
- Verification API docs: http://localhost:8000/docs
- Verification investigation workspace: http://localhost:8000/investigation

Use **`CHECK.bat`** to test the complete service chain.
Use **`STOP.bat`** to stop services started by this package.

## Runtime identity

No student or application is seeded in real-data mode. Registering creates the student account; submitting an application creates its application ID and runs the verification pipeline using the configured sources.

## What is live in real-data mode

### Student experience

- scholarship discovery
- eligibility API
- application listing/details
- document wallet
- attribute-level verification display
- deficiency/action centre
- payment/DBT display
- notifications
- JAGO application agent: conversational navigation, grounded application/payment tracking, deficiency guidance, document-upload initiation, scholarship discovery, and graceful out-of-scope handling
- JAGO persistent conversation history

### Rijvan operations

- scholarship master + rules
- applications and state machine
- eligibility evaluation
- deficiency handling
- manual review cases
- sanctions
- DBT/payment records
- notifications
- beneficiary intelligence
- JAGO
- audit timeline

### Suryaansh verification

- document repository + versioning
- source connector registry + production HTTP adapters; mocks are test-only
- identity matching
- field-level verification
- evidence provenance
- mismatch/exception intelligence
- investigation projection
- SQLite persistence
- consent enforcement
- audit/correlation support

## Clean architecture boundary

The modules remain independently owned. They do not share internal database tables. Cross-module communication is through HTTP adapters and the SIH26238 contract boundary.

## Runtime data

Runtime databases, `.env` files, `.next`, `node_modules`, Python virtual environments, logs and caches are intentionally not included in the final ZIP. `START.bat` creates them locally.

## Troubleshooting

If a port is already occupied, run `STOP.bat`, close any old project terminals, and run `START.bat` again.

If dependency installation fails, run the following manually from each JavaScript module:

```powershell
cd operations
npm ci

cd ..\student-app
npm ci
```

For the verification service:

```powershell
cd verification
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Then run `START.bat` again.

## Useful controls

- `START.bat` — first-run setup + launch everything.
- `CHECK.bat` — verify all three services are reachable.
- `VERIFY_ALL.bat` — same health validation with the product URLs printed clearly.
- `STOP.bat` — stop this bundle's processes.
- `RESET.bat` — delete local runtime environments/databases; the next `START.bat` starts with a clean real-data database.

## Real-data walkthrough

Open the Student App and create an account through **Register**. Log in with that account, open Scholarships, and confirm the catalogue is sourced from NSP. Documents and Verification expose the connection status of configured official providers; unconfigured protected sources are shown as unavailable rather than populated with demo records. Submitting an application records your consent and invokes the verification pipeline.

For deterministic automated tests, use the explicit test/demo mode documented in `REAL_DATA_SETUP.md`; the default launcher does not seed the Asha case.


## DigiLocker
See [DIGILOCKER_SETUP.md](./DIGILOCKER_SETUP.md) for official API Setu onboarding and local credential configuration.


## Official Scholarship Refresh

Use `REFRESH_SCHOLARSHIPS.ps1` to force an on-demand official-source refresh after startup. The normal student API also refreshes official sources in the background and continues to serve the last successful catalogue while sources are unavailable.


### Official-source scholarship aggregator
The scholarship layer aggregates current records from official government/statutory sources and retains source provenance. The bundled NSP catalogue is emergency continuity data only. See `OFFICIAL_SCHOLARSHIP_SOURCES.md` and `SCHOLARSHIP_AGGREGATOR_FINAL_VALIDATION.md`.

## Zero-Payment Production Deployment

The default `render.yaml` is now the zero-payment deployment profile. It runs the Student App, Operations API, and Verification API on Render Free and moves durable data to Supabase Postgres + Supabase Storage. See `FREE_DEPLOYMENT.md` and `supabase-free-setup.sql`.

The previous persistent-disk/starter configuration is preserved as `render.paid.yaml`.

