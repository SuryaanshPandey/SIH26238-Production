# SIH26238 — RIJVAN MODULE: PROJECT PLAN
## SCHOLARSHIP OPERATIONS & INTELLIGENCE
**Ministry of Tribal Affairs — Smart Automation Theme (SIH 2026)**

---

## 1. Executive Summary & Module Mission
The **Rijvan Module** serves as the autonomous decision, state management, and operational intelligence engine for the SIH26238 Unified Scholarship Platform for Tribal Students. It answers:
> *"Which scholarship applies, is the student eligible, what is happening to the application, what needs to happen next, and what intelligence can the system provide?"*

This module operates independently in this repository with clean mock boundaries for:
1. **Suryansh (Module 1)**: Student Access & Scholarship Application (Mocked via `StudentClient`)
2. **Suryaansh (Module 2)**: Documents & Verification Intelligence (Mocked via `VerificationClient` & `DocumentClient`)

All cross-module interactions strictly conform to **Common Data Contract v1**.

---

## 2. Technical Stack & Modular Architecture
- **Framework**: Next.js 14+ (App Router) with full-stack TypeScript (REST API `/api/v1/...` + Admin Operations Portal)
- **Database & ORM**: PostgreSQL / SQLite fallback with Prisma ORM
- **Contract Enforcement**: Zod validation schemas with standard response envelopes
- **Testing Engine**: Vitest (Unit, State Machine, Eligibility, Grounding, Integration, & Contract Tests)
- **Styling**: Modern, responsive, high-accessibility Government Operations UI Design System

```
┌────────────────────────────────────────────────────────────┐
│               Suryansh (Student Mobile App)                │
└─────────────────────────────┬──────────────────────────────┘
                              │ Common Contract v1 REST APIs
┌─────────────────────────────▼──────────────────────────────┐
│           RIJVAN SCHOLARSHIP OPERATIONS & INTELLIGENCE     │
│                                                            │
│  ┌──────────────────────┐      ┌────────────────────────┐  │
│  │  Scholarship Master  │◄────►│   Eligibility Engine   │  │
│  │   & Rule Versions    │      │  (Deterministic Rules) │  │
│  └──────────┬───────────┘      └───────────┬────────────┘  │
│             │                              │               │
│  ┌──────────▼──────────────────────────────▼────────────┐  │
│  │          Application Lifecycle State Machine         │  │
│  │ (DRAFT ──► SUBMITTED ──► VERIFIED ──► SANCTIONED...) │  │
│  └──────────┬──────────────────────────────┬────────────┘  │
│             │                              │               │
│  ┌──────────▼───────────┐      ┌───────────▼────────────┐  │
│  │ Deficiency Workflow  │      │  Manual Review Queue   │  │
│  │  (Auto from Suryaansh│      │ (Assigned Case Review) │  │
│  └──────────┬───────────┘      └───────────┬────────────┘  │
│             │                              │               │
│  ┌──────────▼───────────┐      ┌───────────▼────────────┐  │
│  │   Sanction Engine    │      │ Payment Provider (PFMS)│  │
│  │  (Strict Conditions) │      │ (Idempotent Webhooks)  │  │
│  └──────────────────────┘      └────────────────────────┘  │
│                                                            │
│  ┌──────────────────────┐      ┌────────────────────────┐  │
│  │ JAGO Grounded Backend│      │Beneficiary Intelligence│  │
│  │  (Zero Hallucination)│      │(Targeted Outreach Recs)│  │
│  └──────────────────────┘      └────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       Audit Trail, Events & Notification Hub         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────▲──────────────────────────────┘
                              │ Mock Adapters
┌─────────────────────────────┴──────────────────────────────┐
│          Suryaansh (Verification & Document Engine)        │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Overview
1. `scholarships`: Master records, academic year, scheme type, ministry metadata, active status.
2. `scholarship_rule_versions`: Versioned criteria (`v1.0`, `v1.1`), validity dates.
3. `scholarship_rules`: Atomic rules (income limits, category, age, academic thresholds, course types).
4. `applications`: Main lifecycle table owning `status` and `current_stage`.
5. `application_status_history`: Immutable transition log with actors and reasons.
6. `eligibility_evaluations`: Immutable evaluation runs, overall result, and confidence.
7. `eligibility_rule_results`: Per-rule breakdown (satisfied, failed, missing info, needs verification).
8. `deficiencies`: Issues tracked against applications with severity, required actions, and status.
9. `deficiency_history`: Tracking resolution, waiving, and reopening.
10. `reviews`: Manual officer review cases with assignments and decisions.
11. `sanctions`: Independent sanction records with sanction reference and authorized amount.
12. `payments`: Independent payment records with PFMS transaction references and statuses.
13. `payment_events`: Idempotent log of PFMS webhook payloads and status updates.
14. `notifications`: In-app notification queue for students and officers.
15. `beneficiary_candidates`: Unassisted eligible ST candidates identified by proactive intelligence.
16. `jago_assistance`: Audit log of JAGO queries, detected intent, grounded facts, and responses.
17. `audit_events`: Tamper-evident operational audit trail with correlation IDs.
18. `external_references`: Tracking mapping to external systems (NSP, DigiLocker, PFMS, UDISE+, APAAR).

---

## 4. API Plan & Endpoints (Common Data Contract v1)
All responses wrapped in standard envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "contract_version": "v1",
    "request_id": "req_...",
    "timestamp": "2026-09-23T16:15:00Z"
  }
}
```

- **Scholarships**:
  - `GET /api/v1/scholarships`
  - `GET /api/v1/scholarships/:id`
  - `POST /api/v1/scholarships`
  - `PATCH /api/v1/scholarships/:id`
  - `POST /api/v1/scholarships/:id/activate`
  - `POST /api/v1/scholarships/:id/deactivate`
  - `GET /api/v1/scholarships/:id/rules`
  - `POST /api/v1/scholarships/:id/rules/versions`
- **Eligibility Engine**:
  - `POST /api/v1/eligibility/evaluate`
  - `GET /api/v1/eligibility/:applicationId`
  - `GET /api/v1/eligibility/:applicationId/explanation`
- **Application Lifecycle**:
  - `GET /api/v1/applications`
  - `POST /api/v1/applications`
  - `GET /api/v1/applications/:id`
  - `POST /api/v1/applications/:id/submit`
  - `POST /api/v1/applications/:id/start-verification`
  - `POST /api/v1/applications/:id/send-review`
  - `POST /api/v1/applications/:id/request-correction`
  - `POST /api/v1/applications/:id/verify`
  - `POST /api/v1/applications/:id/reject`
  - `POST /api/v1/applications/:id/withdraw`
  - `POST /api/v1/applications/:id/cancel`
  - `GET /api/v1/applications/:id/timeline`
- **Deficiencies**:
  - `GET /api/v1/applications/:id/deficiencies`
  - `POST /api/v1/applications/:id/deficiencies`
  - `GET /api/v1/deficiencies/:id`
  - `POST /api/v1/deficiencies/:id/resolve`
  - `POST /api/v1/deficiencies/:id/waive`
- **Manual Review Queue**:
  - `GET /api/v1/reviews`
  - `GET /api/v1/reviews/:id`
  - `POST /api/v1/reviews/:id/assign`
  - `POST /api/v1/reviews/:id/start`
  - `POST /api/v1/reviews/:id/decision`
- **Sanction & Payment**:
  - `GET /api/v1/applications/:id/sanction`
  - `POST /api/v1/applications/:id/sanction`
  - `GET /api/v1/applications/:id/payment`
  - `POST /api/v1/applications/:id/payment/initiate`
  - `POST /api/v1/payments/:id/simulate`
  - `POST /api/v1/payments/webhook/mock`
- **JAGO Grounded Operational AI**:
  - `POST /api/v1/jago/query`
  - `GET /api/v1/jago/history/:studentId`
- **Beneficiary Proactive Intelligence**:
  - `GET /api/v1/beneficiaries/candidates`
  - `GET /api/v1/beneficiaries/candidates/:id`
  - `POST /api/v1/beneficiaries/candidates/generate`
  - `POST /api/v1/beneficiaries/candidates/:id/review`
- **Notifications & Audit**:
  - `GET /api/v1/notifications/:studentId`
  - `POST /api/v1/notifications/:id/read`
  - `GET /api/v1/audit/application/:applicationId`
  - `GET /api/v1/audit/entity/:entityType/:entityId`

---

## 5. Integration Plan (Dependency Inversion & Mocks)
- `src/adapters/student/StudentClient.ts` -> `MockStudentClient.ts`
- `src/adapters/document/DocumentClient.ts` -> `MockDocumentClient.ts`
- `src/adapters/verification/VerificationClient.ts` -> `MockVerificationClient.ts`
- `src/adapters/payment/PaymentProvider.ts` -> `MockPFMSClient.ts`
Each mock client supports configurable edge-case test modes (e.g., `SOURCE_UNAVAILABLE`, `DATA_MISMATCH`, `PFMS_TIMEOUT`, `REPLAY_ATTACK`).

---

## 6. Implementation Phases (Iterative Loop)
- **Phase 1**: Base Setup, Tooling, Config & Contracts
- **Phase 2**: Database Prisma Modeling & Migration
- **Phase 3**: Composable Rules & Deterministic Eligibility Engine
- **Phase 4**: Application State Machine & Verification Translation
- **Phase 5**: Deficiencies & Manual Review Queue
- **Phase 6**: Sanction & Payment (PFMS Idempotent Adapter)
- **Phase 7**: JAGO Operational Backend & Beneficiary Intelligence
- **Phase 8**: Notification Hub & Immutable Audit Service
- **Phase 9**: REST API Route Handlers with Envelope Middleware
- **Phase 10**: Administrative Operations UI (Next.js Dashboard & Management Consoles)
- **Phase 11**: Realistic Seed Data (5 Schemes & 20+ Demo Records)
- **Phase 12**: Automated Test Suite (Unit, Integration, Contract)
- **Phase 13**: CLI Tools (`demo.ts`, `verify.ts`, `simulator.ts`)
- **Phase 14**: Complete 14-File Documentation Suite + `FINAL_STATUS.md`
