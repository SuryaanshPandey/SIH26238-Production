# Step 2 — Document Service + Repository

## Goal

Turn the frozen `Document` contract into a working document backend with:

- creation
- retrieval
- application linking
- version history
- replacement/versioning
- controlled lifecycle transitions
- deterministic error handling
- repository abstraction

## Deliberate boundary

This step stores document **metadata and secure storage references**, not binary files.
The contract already exposes `storage_ref`, so a future object-storage adapter can be introduced without changing the external entity contract.

No scholarship workflow, eligibility logic, verification decisioning, payment processing, beneficiary discovery or student-facing wallet UI is implemented here.

## Architecture

```text
HTTP API
   |
   v
DocumentService
   |
   v
DocumentRepository (interface)
   |
   +--> InMemoryDocumentRepository  [Step 2]
   |
   +--> Future Postgres/Supabase adapter
```

## Lifecycle rule

Transitions are explicit and conservative. A replaced version is terminal: create a new version instead of mutating it.

Important examples:

```text
UPLOADED -> PROCESSING -> AVAILABLE -> VERIFIED
                                  \-> MISMATCH
                                  \-> EXPIRED

CURRENT VERSION -> REPLACED
                    |
                    +-> NEW VERSION (v+1)
```

`VERIFIED` and `MISMATCH` are part of the shared Document contract; later verification logic will be the component that gives those states meaning.

## Versioning rule

A logical document stream is identified by:

```text
student_id + application_id + document_type
```

Only one current (non-`REPLACED`) version exists in that stream. Replacement creates a new immutable version with the next integer version number and marks the old version `REPLACED`.

## API endpoints

### `POST /documents`
Create a document record.

### `GET /documents/{document_id}`
Retrieve one document.

### `GET /applications/{application_id}/documents`
List all documents linked to an application.

### `GET /documents/{document_id}/versions`
List the complete version chain for the logical document.

### `PATCH /documents/{document_id}/status`
Perform one validated lifecycle transition.

### `POST /documents/{document_id}/replace`
Create the next document version while preserving the old version.

### `GET /documents/{document_id}/history`
Read lifecycle history for one document ID.

## Running

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
uvicorn app.main:app --reload
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Validation target

The step must demonstrate:

```text
Create
  -> Retrieve
  -> Link to Application
  -> Transition
  -> Replace
  -> Version History
  -> Error Handling
```

## Next step

Next, add the **source connector interface + mock DigiLocker/government/institution adapters**. Those adapters will return normalized source records without pretending to have unrestricted live government API access.
