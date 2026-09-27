# Step 6 — Mismatch & Exception Intelligence

## Scope

This step turns verification observations into explainable exception signals for downstream human review.

It does **not** change application status, create/resolve Rijvan-owned deficiencies, decide eligibility, sanction/reject applications, or implement the manual-review workflow.

## Detection categories

- `DATA_MISMATCH`
- `CROSS_SOURCE_CONFLICT`
- `SOURCE_UNAVAILABLE`
- `MISSING_EVIDENCE`
- `EXPIRED_DOCUMENT`
- `STALE_SOURCE_RECORD`
- `INSUFFICIENT_INFORMATION`
- `PARTIAL_IDENTITY_MATCH`

## Intelligent rules

### Cross-source disagreement

When multiple available sources return different normalized values for the same field, the system retains every observed value and creates `CROSS_SOURCE_CONFLICT`. It does not silently pick a winner.

### Staleness

No government freshness period is hard-coded. A source is marked stale only when the caller explicitly supplies a field-level freshness policy.

### Expiry

An expired document produces a verification exception but does not mutate the document lifecycle. The document service remains the owner of document status.

### Missing evidence

The system distinguishes a source being unavailable from a reachable source returning no record, and from an available record that lacks a particular attribute.

### Review boundary

`review_required=true` and `routing=MANUAL_REVIEW_SIGNAL` are downstream workflow signals. They do not constitute a manual-review state machine.

## Exception object

Each exception retains:

- affected field
- submitted value, where applicable
- source values
- source references
- verification IDs
- evidence IDs
- detection method
- severity
- detection timestamp

This is the minimum useful hand-off for Step 7's investigation interface.

## API

- `POST /exceptions/analyze`
- `GET /exceptions/{exception_id}`
- `GET /applications/{application_id}/exceptions`

## Flow

```text
Source records + Documents + Verification references
                     ↓
              Exception Intelligence
          ┌──────────┼──────────┐
          ↓          ↓          ↓
      mismatch    conflict   freshness/expiry
          │          │          │
          └──────────┼──────────┘
                     ↓
          Immutable exception signals
                     ↓
          Review-ready evidence package
                     ↓
             Downstream workflow
```
