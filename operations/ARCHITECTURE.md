# ARCHITECTURE SPECIFICATION
## SIH26238 Rijvan Module: Scholarship Operations & Intelligence

---

## 1. System Topology & 3-Module Integration

```
┌─────────────────────────────────────────────────────────────┐
│               Suryansh (Student Mobile Experience)          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Common Contract v1 REST APIs
┌──────────────────────────────▼──────────────────────────────┐
│            RIJVAN SCHOLARSHIP OPERATIONS & INTELLIGENCE      │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │  Scholarship Master   │◄────►│   Eligibility Engine   │  │
│  │   & Rule Versions     │      │ (Deterministic Rules)  │  │
│  └───────────┬───────────┘      └───────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼──────────────────────────────▼────────────┐  │
│  │           Application Lifecycle State Machine         │  │
│  │ (DRAFT ──► SUBMITTED ──► VERIFIED ──► SANCTIONED...)  │  │
│  └───────────┬──────────────────────────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼───────────┐      ┌───────────▼────────────┐  │
│  │  Deficiency Workflow  │      │  Manual Review Queue   │  │
│  │ (Auto from Suryaansh) │      │ (Assigned Case Review) │  │
│  └───────────┬───────────┘      └───────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼───────────┐      ┌───────────▼────────────┐  │
│  │    Sanction Domain    │      │ Payment Provider (PFMS)│  │
│  │  (Strict Conditions)  │      │ (Idempotent Webhooks)  │  │
│  └───────────────────────┘      └────────────────────────┘  │
│                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐  │
│  │  JAGO Grounded AI     │      │Beneficiary Intelligence│  │
│  │  (Zero Hallucination) │      │(Targeted Outreach Recs)│  │
│  └───────────────────────┘      └────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │       Audit Trail, Events & Notification Hub          │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────▲──────────────────────────────┘
                               │ Mock Adapters / Events
┌──────────────────────────────┴──────────────────────────────┐
│           Suryaansh (Documents & Verification Engine)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Invariants
1. **Rijvan is the SOLE Owner of `application.status`**:
   No external module or frontend can directly PATCH application status. Transitions must flow through domain validators and audit services.
2. **Decoupled Sanction & Payment Domains**:
   `application.status` and `payment.status` are completely independent. Payment processing or failure never corrupts the sanction order.
3. **Upstream Resilience**:
   `SOURCE_UNAVAILABLE` or `NOT_VERIFIABLE` from Suryaansh **never** translates to `NOT_ELIGIBLE` or `REJECTED`. It is gracefully escalated to manual review or scheduled for retry.
4. **Zero Hallucination AI Grounding**:
   JAGO answers strictly from authoritative database entities with attached citation references.
5. **No Direct Database Sharing**:
   Modules communicate solely through Common Contract v1 REST endpoints and event payloads.
