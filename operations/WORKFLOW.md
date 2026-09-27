# APPLICATION WORKFLOW & STATE MACHINE
## Lifecycle State Progression & Transitions

---

## 1. Valid Lifecycle Transitions
```
DRAFT
  │
  ▼
SUBMITTED
  │
  ▼
UNDER_VERIFICATION ──► (Discrepancy) ──► ACTION_REQUIRED
  │                                           │ (Student Correction)
  │                                           ▼
  ├──► (Manual Escalation / Timeout) ──► UNDER_REVIEW
  │                                           │ (Officer Approval)
  ▼                                           ▼
VERIFIED ◄────────────────────────────────────┘
  │
  ▼
SANCTIONED
  │
  ▼
PAYMENT_PROCESSING
  │
  ▼
PAID (Terminal)
```

Terminal Exception States: `REJECTED`, `WITHDRAWN`, `CANCELLED`.

---

## 2. Guarded Invariants
- Direct state overrides via arbitrary PATCH are strictly forbidden.
- Every state transition generates an audit entry in `ApplicationStatusHistory` and `AuditEvent`.
- If a verification mismatch occurs, the application transitions to `ACTION_REQUIRED`, generates an open deficiency, and notifies the student.
- Once student resolves the deficiency, re-verification can be triggered.
