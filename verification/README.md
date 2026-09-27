# SIH26238 — Documents & Verification Intelligence

## Step 8 — Production Hardening & Integration Readiness

This release contains the complete Documents + Verification module through Step 8.

### Included

1. Contract Foundation
2. Document Service + Repository
3. Source Connector Architecture
4. Identity Matching
5. Verification Engine + Evidence
6. Mismatch & Exception Intelligence
7. Verification Investigation Layer
8. Production Hardening & Integration Readiness

### Run locally — in-memory development mode

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Run locally — persistent SQLite mode

```powershell
$env:SIH_STORAGE_BACKEND="sqlite"
$env:SIH_STORAGE_PATH="./data/sih26238.db"
uvicorn app.main:app --reload
```

Optional hardening settings are documented in `.env.example` and `docs/STEP8.md`.

### Test

```powershell
pytest -q
python scripts_persistent_smoke.py
```

### Core investigation API

```text
GET /investigations
GET /investigations/{application_id}
GET /investigations/{application_id}/timeline
GET /investigations/{application_id}/fields/{field_name}
GET /investigation
```

### Hardening API

```text
POST /consents
GET /consents/{consent_id}
POST /consents/{consent_id}/revoke
GET /source-observations/{source_reference}
GET /audits/{entity_type}?entity_id=...
GET /system/storage
```

### Architectural boundary

The module owns Documents + Verification Intelligence. It does not own Scholarship eligibility, Application state, Deficiency workflow, Sanction/Payment, Beneficiary Candidate decisions, or JAGO backend behavior.
