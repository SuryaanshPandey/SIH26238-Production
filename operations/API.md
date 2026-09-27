# REST API SPECIFICATION
## Common Data Contract v1 Endpoints

All responses conform to:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "contract_version": "v1",
    "request_id": "req_xxx",
    "timestamp": "2026-09-23T16:30:00.000Z"
  }
}
```

---

## 1. Scholarship Master
- `GET /api/v1/scholarships` - List all schemes with optional filters (`status`, `schemeType`, `academicYear`).
- `POST /api/v1/scholarships` - Create new scheme.
- `GET /api/v1/scholarships/:id` - Get scheme details.
- `POST /api/v1/scholarships/:id/activate` - Activate scholarship.
- `POST /api/v1/scholarships/:id/deactivate` - Deactivate scholarship.

## 2. Applications & Lifecycle
- `GET /api/v1/applications` - List applications (`status`, `scholarshipId`, `studentId`).
- `POST /api/v1/applications` - Create application in `DRAFT`.
- `GET /api/v1/applications/:id` - Get application details.
- `POST /api/v1/applications/:id/submit` - Submit application (`DRAFT -> SUBMITTED`).
- `POST /api/v1/applications/:id/start-verification` - Trigger verification (`MATCH`, `MISMATCH`, `SOURCE_UNAVAILABLE`).
- `POST /api/v1/applications/:id/verify` - Confirm verification (`UNDER_REVIEW -> VERIFIED`).
- `POST /api/v1/applications/:id/reject` - Reject application.
- `GET /api/v1/applications/:id/timeline` - Get audit history timeline.

## 3. Deficiencies
- `GET /api/v1/applications/:id/deficiencies` - List application deficiencies.
- `POST /api/v1/applications/:id/deficiencies` - Create deficiency.
- `POST /api/v1/deficiencies/:id/resolve` - Mark deficiency resolved.
- `POST /api/v1/deficiencies/:id/waive` - Discretionary waiver.

## 4. Manual Review Queue
- `GET /api/v1/reviews` - List review cases.
- `POST /api/v1/reviews/:id/assign` - Assign desk officer.
- `POST /api/v1/reviews/:id/start` - Start review examination.
- `POST /api/v1/reviews/:id/decision` - Make decision (`APPROVE`, `REJECT`, `REQUEST_CORRECTION`, `ESCALATE`).

## 5. Sanction & Payments
- `GET /api/v1/applications/:id/sanction` - Get sanction order.
- `POST /api/v1/applications/:id/sanction` - Issue sanction order.
- `GET /api/v1/applications/:id/payment` - Get payment status.
- `POST /api/v1/applications/:id/payment/initiate` - Initiate DBT payment.
- `POST /api/v1/payments/:id/simulate` - Simulate PFMS response (`SUCCESS`, `FAILED`, `RETURNED`).
- `POST /api/v1/payments/webhook/mock` - Idempotent PFMS webhook listener.

## 6. Eligibility Engine
- `POST /api/v1/eligibility/evaluate` - Test eligibility against student context.
- `GET /api/v1/eligibility/:applicationId` - Get evaluation breakdown.

## 7. JAGO Grounded Assistant
- `POST /api/v1/jago/query` - Query grounded assistant (`studentId`, `query`, `language: 'en' | 'hi'`).

## 8. Beneficiary Intelligence
- `GET /api/v1/beneficiaries/candidates` - List proactive candidates.
- `POST /api/v1/beneficiaries/candidates/generate` - Run proactive discovery scan.
- `POST /api/v1/beneficiaries/candidates/:id/review` - Review outreach candidate.
### Service health
`GET /api/v1/health` checks only the Operations process and local database. It intentionally does not require NSP or another external government provider to be reachable during startup.

