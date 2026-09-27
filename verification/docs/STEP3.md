# Step 3 — Source Connector Architecture

## Goal

Introduce a single connector contract for external and institutional sources so verification logic never depends on source-specific APIs.

The architecture is:

```text
Verification Engine (future)
          |
          v
   SourceService
          |
          v
   ConnectorRegistry
     /     |      \\
    v      v       v
DigiLocker UDISE+ Institution ...
    |       |        |
    +-------+--------+
            |
      SourceRecord
```

## Common interface

Every adapter implements `SourceConnector`:

```python
fetch_record(query: SourceQuery) -> SourceRecord
supported_attributes() -> set[str]
health_check() -> dict
```

The normalized `SourceRecord` contains:

- source system
- stable source reference
- source-record status
- subject id
- normalized attributes
- retrieval timestamp
- response hash
- document/institution context
- adapter metadata

The connector layer intentionally does **not** return verification confidence. Matching/verification owns that decision.

## Built-in mock adapters

The prototype includes deterministic adapters for:

- DigiLocker
- UDISE+
- APAAR
- AISHE
- UIDAI
- State e-District
- UGC/NTA-related source
- Institution records

These are mock adapters. `live_integration` is explicitly reported as `false`. They do not imply unrestricted live access to government systems.

## Authorization boundary

A source query carries an `ConnectorAuthorization` context:

```text
authorized
purpose
consent_id (optional)
```

The connector fails closed when authorization is missing. This is an integration boundary, not a replacement for a final consent service.

## Error semantics

Source conditions remain distinguishable:

```text
AUTHORIZATION_REQUIRED -> 403
RECORD_NOT_FOUND        -> 404
SOURCE_UNAVAILABLE      -> 503
INVALID_RESPONSE        -> 422
```

The future verification engine can therefore distinguish “no record exists” from “the government source is down.”

## API

### `GET /connectors`

Returns registered source adapters and their readiness metadata.

### `POST /source-records/query`

Queries one source through the common contract.

Example:

```json
{
  "system": "DIGILOCKER",
  "student_id": "stu_001",
  "attributes": ["full_name", "date_of_birth", "category"],
  "authorized": true,
  "purpose": "DOCUMENT_VERIFICATION",
  "consent_id": "cons_001"
}
```

The response is a normalized source record regardless of which connector was selected.

## Design rules

1. Verification code must depend on `SourceConnector` / `SourceService`, not concrete adapters.
2. Source-specific response parsing stays inside the adapter.
3. No raw secrets, full Aadhaar numbers, bank account numbers or API keys are stored or logged.
4. Missing records and unavailable sources are different states.
5. Connector output is evidence input; it is not itself a final verification decision.
6. Live government access must only be added behind the same adapter interface after an authorized integration path exists.

## Validation

Step 3 tests cover:

- required source registry coverage
- common query contract
- authorization enforcement
- missing record behavior
- unavailable source behavior
- unsupported attribute handling
- duplicate connector registration
- normalized service output
- cross-source querying
- deterministic response hashes
- API success/error mapping
