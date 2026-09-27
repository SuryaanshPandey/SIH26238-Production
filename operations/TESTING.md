# TESTING STRATEGY & TEST SUITE
## SIH26238 Rijvan Module

---

## 1. Test Architecture
The test suite is built on **Vitest** for fast, deterministic local and CI testing:
- **Unit Tests**:
  - `tests/unit/eligibility.test.ts`: Tests deterministic rule engine, income ceilings, ST category enforcement, and resilience to `SOURCE_UNAVAILABLE`.
  - `tests/unit/state-machine.test.ts`: Validates all valid state transitions and asserts that illegal transitions (e.g. `PAID -> DRAFT`) throw `AppError.invalidStateTransition`.
  - `tests/unit/jago.test.ts`: Verifies grounded answering, intent resolution, and bilingual Hindi/English accuracy.
  - `tests/unit/payment.test.ts`: Verifies PFMS DBT initiation, simulation outcomes, and error capture.
- **Contract Tests**:
  - `tests/contract/envelope.test.ts`: Validates that all mock fixtures (21 files) and API responses conform to `Common Data Contract v1`.

---

## 2. Test Execution Commands
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run contract tests only
npm run test:contract
```
