# Step 4 — Identity Matching

## Scope

This step implements the **Identity Matching** responsibility of the Documents + Verification module.

It answers:

> Do the student's submitted identity attributes correspond to a normalized record returned by an authorized source?

It does **not** make scholarship eligibility decisions, change application state, approve documents, or merge records.

## Architecture

```text
Submitted Student Attributes
          |
          v
   Normalization Layer
          |
          v
     Field Matcher <---------------- SourceRecord
          |                              ^
          |                              |
          +--> deterministic comparison  Step 3 connectors
          +--> name fuzzy comparison
          +--> conflict detection
          |
          v
    IdentityMatch
          |
          +--> decision
          +--> confidence
          +--> per-field explanation
          +--> decisive conflicts

SourceRecord[1..N]
       |
       v
Duplicate Detector
       |
       v
DuplicateCandidate[]
       |
       v
Manual review signal (not automatic merge)
```

## Normalization

Normalization is field-aware and happens before comparison:

- names: Unicode normalization, case folding, punctuation/whitespace cleanup
- dates: common date formats normalized to ISO date form
- phones: non-digits removed and the final 10 digits retained where applicable
- email: case/space normalization
- category: canonical casing/spacing
- identifiers: separators removed and case normalized
- unknown fields: conservative text normalization

Normalization is only for comparison. It does not overwrite the original submitted or source values.

## Field matching

Default weights:

| Field | Weight | Method |
|---|---:|---|
| `full_name` | 0.35 | normalized exact + fuzzy |
| `date_of_birth` | 0.25 | normalized exact |
| `category` | 0.15 | normalized exact |
| `mobile` | 0.10 | normalized exact |
| `email` | 0.10 | normalized exact |
| `institution_id` | 0.05 | normalized exact |

The matcher reports both the original values and normalized comparison values in the internal result. API consumers receive enough information to explain the outcome without exposing unrelated source records.

### Deterministic fields

Date of birth, mobile, email, institution ID and category are not treated as fuzzy matches. A conflict on any of these fields is a **decisive conflict** and produces `MISMATCH`.

### Fuzzy names

Only `full_name` uses fuzzy comparison. A high similarity (>= 0.90) can support a strong match when corroborated by at least one decisive normalized-exact identity field.

A medium similarity (0.65–0.8999) is reported as partial evidence rather than being treated as identity proof.

## Decisions

### `MATCH`

A strong name match plus at least one decisive exact identity match, with no conflicts.

### `PARTIAL_MATCH`

Some evidence matches, but the evidence is not sufficient for a strong identity match.

### `MISMATCH`

At least one decisive identity field conflicts.

### `INSUFFICIENT_EVIDENCE`

No comparable identity evidence exists, or the available evidence is too weak to support a conclusion.

## Confidence

Confidence is a normalized evidence score, not a government decision and not an eligibility score.

It considers:

1. field similarity;
2. field weights;
3. evidence coverage across available identity fields.

Missing values do not become false mismatches. Low evidence coverage suppresses confidence rather than pretending that a single field proves identity.

## Duplicate detection

The duplicate detector compares multiple normalized `SourceRecord` objects pairwise.

A `DuplicateCandidate` is emitted only when multiple fields provide sufficiently strong evidence. The result is explicitly a **candidate for review**. It does not merge, delete or replace any record.

This preserves source history and prevents the matching layer from taking an administrative action it does not own.

## API

### `POST /identity-matches`

Accepts a student claim plus one or more normalized `SourceRecord` objects and returns one explainable `IdentityMatch` per source.

### `POST /identity-matches/duplicates`

Accepts two or more normalized `SourceRecord` objects and returns possible duplicate candidates.

## Example — strong match

```json
{
  "submitted_attributes": {
    "full_name": "Asha Kumar",
    "date_of_birth": "14/08/2005",
    "category": "ST"
  },
  "source": {
    "full_name": "ASHA KUMAR",
    "date_of_birth": "2005-08-14",
    "category": "ST"
  },
  "decision": "MATCH"
}
```

## Example — conflict

```text
Submitted DOB : 2005-08-14
Source DOB    : 2006-08-14

Decision      : MISMATCH
Conflict      : date_of_birth
```

The application/workflow consequence belongs to Rijvan's module; this service only identifies and explains the identity conflict.

## Security boundary

- No raw Aadhaar, complete bank account numbers, secrets or API keys are logged.
- Source-specific integration remains behind Step 3's `SourceConnector` interface.
- Identity matching receives normalized source records rather than reaching directly into external systems.
- Original submitted/source values remain distinguishable from normalized values.
- Duplicate detection never performs an automatic merge.

## Seed scenarios

See:

- `fixtures/identity/strong_match.json`
- `fixtures/identity/date_conflict.json`
- `fixtures/identity/insufficient_evidence.json`
- `fixtures/identity/duplicate_candidate.json`

## Validation

Step 4 adds 16 tests. Combined suite:

**46/46 passed.**
