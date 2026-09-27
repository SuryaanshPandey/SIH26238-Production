# Step 7 — Verification Investigation Layer

## Goal

Turn the existing Document, Verification, Evidence, and Exception artifacts into a **read-only, evidence-first operational investigation view**.

This is an internal operational projection. It does **not** become a new shared SIH26238 entity and it does not own application workflow, sanction, payment, eligibility, deficiency, or manual-review decisions.

## APIs

```text
GET /investigations
GET /investigations/{application_id}
GET /investigations/{application_id}/timeline
GET /investigations/{application_id}/fields/{field_name}
GET /investigation
```

## Investigation projection

```text
Application ID
Student ID
Review required
Overall result
Highest severity
Summary metrics
Field comparisons
Documents
Verifications
Evidence
Exceptions
Source references
Timeline
```

## Evidence-first field view

Each field can show:

- submitted value
- source references and source values available through verification records
- verification result(s)
- confidence
- linked evidence IDs
- linked exception IDs

## Timeline

The timeline is derived from persisted module artifacts:

- document creation/status history
- verification completion
- exception detection

It is read-only and preserves the original events.

## Case-wise classification

The application ID is the case boundary. The module exposes `case_<application_id>` as an internal projection identifier. No new `Application` entity is created and no application state is changed.

## Scope boundary

This layer does **not**:

- change `application.status`
- change payment state
- create or resolve Rijvan-owned deficiencies
- decide eligibility
- approve/reject scholarship applications
- perform reviewer decisions
- access another module's database

It only assembles existing verification intelligence into a usable investigation view.
