# SECURITY, PRIVACY & DATA PROVENANCE
## SIH26238 Rijvan Module

---

## 1. PII & Sensitive Data Protection
- **No Raw Aadhaar Storage or Logging:** Aadhaar is strictly masked (`XXXX-XXXX-8921`) across all UI layers, API envelopes, and database tables.
- **Masked Financial Accounts:** Bank account numbers are tokenized/masked (`XXXXXXXX9832`) with valid bank IFSC codes.
- **No Committed Secrets:** Credentials, database passwords, and JWT keys are managed through environment variables (`.env.example` provided).

---

## 2. Integrity & Audit Invariants
- **Immutable Audit Trail:** State history and audit events are stored with correlation IDs (`correlation_id`) and timestamps, preventing tampering.
- **Idempotent Webhook Defense:** PFMS payment callbacks enforce unique `idempotencyKey` checks to defend against replay attacks.
- **Zero Government Falsehoods:** All external integrations are clearly identified in UI and documentation as Prototype Connectors / Mock Adapters.
