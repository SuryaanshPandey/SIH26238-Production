# DATABASE SCHEMA & MODELING
## Prisma Schema Architecture (SIH26238 Rijvan Module)

---

## 1. Entity Relational Model

```
Scholarship (1) ──── (N) ScholarshipRuleVersion (1) ──── (N) ScholarshipRule
     │
     └─── (N) Application (1) ──── (N) ApplicationStatusHistory
               │
               ├─── (N) EligibilityEvaluation (1) ──── (N) EligibilityRuleResult
               │
               ├─── (N) Deficiency (1) ──── (N) DeficiencyHistory
               │
               ├─── (N) ReviewCase (1) ──── (N) ReviewHistory
               │
               ├─── (1) Sanction
               │
               └─── (1) Payment (1) ──── (N) PaymentEvent
```

---

## 2. Table Specifications
1. **`Scholarship`**: Scheme catalog, rule versions, active periods, required documents JSON, benefit ceiling JSON.
2. **`ScholarshipRuleVersion` & `ScholarshipRule`**: Atomic versioned criteria (`CATEGORY_ST`, `INCOME_LIMIT`, `ACADEMIC_LEVEL`).
3. **`Application`**: Main state owner (`DRAFT`, `SUBMITTED`, `UNDER_VERIFICATION`, `ACTION_REQUIRED`, `UNDER_REVIEW`, `VERIFIED`, `SANCTIONED`, `PAYMENT_PROCESSING`, `PAID`, `REJECTED`).
4. **`ApplicationStatusHistory`**: Immutable log of every status transition with actor, timestamp, correlation ID, and reason.
5. **`EligibilityEvaluation` & `EligibilityRuleResult`**: Immutable snapshot of evaluation runs and per-rule breakdown.
6. **`Deficiency` & `DeficiencyHistory`**: Action items tracked against applications with resolution notes and waivers.
7. **`ReviewCase` & `ReviewHistory`**: Desk officer case examination queue with recorded decisions.
8. **`Sanction`**: Sanction reference order numbers and authorized disbursement sums.
9. **`Payment` & `PaymentEvent`**: Independent PFMS DBT transaction records and idempotent callback logs.
10. **`Notification`**: In-app notification queue for students and officers.
11. **`BeneficiaryCandidate`**: Proactive outreach candidates detected from external registers.
12. **`JagoAssistance`**: Audit record of user queries, detected intent, grounded facts, and citations.
13. **`AuditEvent`**: Master operational audit trail.
14. **`ExternalReference`**: Mapping external identifiers (NSP, DigiLocker, PFMS, UDISE+, APAAR).
