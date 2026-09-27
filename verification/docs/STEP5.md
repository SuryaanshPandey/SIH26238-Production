# Step 5 — Verification Engine

## Scope

This step turns submitted attributes and normalized source records into immutable, field-level verification facts with traceable evidence and confidence.

It deliberately does **not**:

- change `application.status`
- create or resolve deficiencies
- decide scholarship eligibility
- sanction or reject an application
- implement the manual-review workflow
- inspect binary document contents

## Flow

```text
Student/application claim
        ↓
Submitted-value evidence
        ↓
Normalized source record
        ↓
Field comparison
        ↓
Verification result + confidence
        ↓
Source/document evidence
        ↓
Immutable Verification record
```

## Verification results

- `MATCH`
- `PARTIAL_MATCH`
- `MISMATCH`
- `NOT_VERIFIABLE`
- `SOURCE_UNAVAILABLE`
- `INSUFFICIENT_EVIDENCE`
- `PENDING_REVIEW`

## Evidence policy

Every verification stores references to at least two evidence records when a source record is processed:

1. The submitted value.
2. The source value.

Referenced document IDs can also be represented as document evidence. Binary document parsing is intentionally outside this step.

Evidence is immutable. A later check creates new records rather than overwriting earlier verification history.

## API

### Run verification

`POST /verifications/run`

### Get a verification

`GET /verifications/{verification_id}`

### List application verifications

`GET /applications/{application_id}/verifications`

### Get evidence

`GET /evidence/{evidence_id}`

### List evidence for a verification

`GET /verifications/{verification_id}/evidence`

## Confidence

Confidence is derived from the existing field-comparison logic and weighted by the fields that were actually comparable. Missing/unavailable source data does not receive artificial confidence.

## Review boundary

A mismatch or unavailable source can mark `review_required=true` in the verification result. This is only a verification signal. Application workflow consequences remain owned by Rijvan's module.
