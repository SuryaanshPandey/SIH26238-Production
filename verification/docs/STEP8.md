# Step 8 — Production Hardening & Integration Readiness

## Purpose

Step 8 hardens the Documents + Verification module without changing cross-module ownership.

The module still owns documents + verification intelligence and exposes verification-specific investigation information. It does not own the application workflow, sanction, payment, beneficiary discovery or JAGO backend.

## 1. Persistent local storage

The runtime now supports a stdlib-only SQLite adapter behind the existing repository interfaces.

Environment:

```powershell
$env:SIH_STORAGE_BACKEND="sqlite"
$env:SIH_STORAGE_PATH="./data/sih26238.db"
uvicorn app.main:app --reload
```

Persisted artifacts:

- documents + document history
- verification records
- evidence
- verification exceptions
- audit events
- consent records
- normalized source observations

The domain services continue to depend on interfaces, so the SQLite adapter can later be replaced by Postgres/Supabase without rewriting business logic.

## 2. Consent hardening

Create a consent record:

```text
POST /consents
```

Retrieve it:

```text
GET /consents/{consent_id}
```

Revoke it:

```text
POST /consents/{consent_id}/revoke
```

Strict source access can be enabled with:

```powershell
$env:SIH_REQUIRE_CONSENT="true"
```

With strict mode enabled, the source query must provide a valid `consent_id` whose student and purpose match the request and whose status is `GRANTED`.

## 3. Source observation history

Every successful normalized source query can be persisted as an immutable source observation. This gives investigators a reconstructable view of what a source returned at a particular retrieval time.

```text
GET /source-observations/{source_reference}
```

The raw external response is not stored by this layer; the stored payload is the normalized contract representation.

## 4. Transport hardening

Optional API-key enforcement:

```powershell
$env:SIH_API_KEY="change-this-for-local-demo"
```

Protected requests must send:

```text
X-SIH-API-Key: <configured-key>
```

Successful protected responses also carry an `X-Request-ID` correlation header.

The middleware never logs request bodies, credentials or document contents.

## 5. Audit trail

Successful mutating HTTP requests create a non-sensitive audit event with:

- actor type
- actor identifier
- HTTP action/path
- entity type/path
- timestamp
- correlation ID

Domain-history records remain authoritative for document/verification artifacts. Audit events answer the transport-level question of which API operation happened and when.

```text
GET /audits/{entity_type}?entity_id=...
```

## 6. Operational endpoints

```text
GET /system/storage
GET /connectors
GET /health
```

## 7. Validation

```powershell
pytest -q
python scripts_persistent_smoke.py
```

The smoke test starts one process, creates a complete document → source → verification → investigation chain, shuts the process down, starts a second process against the same SQLite database, and verifies that the investigation is reconstructed from persisted records.
