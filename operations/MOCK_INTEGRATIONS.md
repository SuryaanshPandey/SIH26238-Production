# MOCK INTEGRATION ADAPTERS
## Dependency Inversion & Test Scenarios

---

## 1. Adapter Interfaces
All external dependencies are decoupled behind clean TypeScript interfaces:
1. **`StudentClient`** (`MockStudentClient`):
   - Simulates Suryansh student repository.
   - Supports valid ST student (`stu_demo_001`), high-income student (`stu_demo_high_income`), non-ST student (`stu_demo_non_st`), and incomplete student (`stu_demo_incomplete`).
2. **`DocumentClient`** (`MockDocumentClient`):
   - Simulates document metadata records and SHA-256 integrity hashes without storing raw document files.
3. **`VerificationClient`** (`MockVerificationClient`):
   - Simulates Suryaansh verification results.
   - Configurable test scenarios: `MATCH`, `MISMATCH`, `SOURCE_UNAVAILABLE`, `PARTIAL_MATCH`.
4. **`PaymentProvider`** (`MockPFMSClient`):
   - Simulates PFMS DBT Gateway.
   - Generates PFMS tracking references, simulates `PROCESSING`, `SUCCESS`, `FAILED`, and `RETURNED` webhooks with replay attack prevention.

---

## 2. Zero-Friction Future Replacement
When real services for Suryansh or Suryaansh come online, only the concrete adapter implementations in `src/adapters/` need to be swapped; zero changes to the domain, state machine, or UI are required.
