# Step 1 — Contract Foundation

## Boundary

Owned here:

- Document backend/lifecycle contract
- Verification contract
- Evidence contract
- Supporting audit/consent/external-reference contract
- Common response envelope
- Shared verification-related enums/error codes

Not owned here:

- Student onboarding/discovery
- Eligibility rules
- Application state transitions
- Sanction/payment
- Beneficiary discovery
- JAGO backend
- Complete manual-review workflow

## Architectural rule

Cross-module access occurs through API/event contracts rather than another module's database.

## Why this step comes first

The team contract is frozen at v1. Establishing the typed boundary first lets every later component—document service, connector adapters, identity matching, verification engine and reviewer-facing investigation UI—emit the same structures.

## Next step

Implement the in-module Document Service with an in-memory repository first:

1. create document metadata
2. update document version/lifecycle
3. retrieve document metadata
4. link document to application
5. preserve history
6. cover not-found, invalid transition and duplicate-version edge cases
7. expose endpoints using the v1 response envelope
