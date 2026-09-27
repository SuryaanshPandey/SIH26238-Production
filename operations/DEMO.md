# DEMO SCRIPTS & WALKTHROUGH GUIDE
## SIH26238 Rijvan Module

---

## 1. Terminal Demo Execution
Run the complete deterministic demo script:
```bash
npm run demo
```
This executes the 10-step lifecycle walkthrough in the terminal:
1. Application created in `DRAFT`.
2. Student submits to `SUBMITTED`.
3. Automated verification runs with `MISMATCH` -> creates deficiency -> transitions to `ACTION_REQUIRED`.
4. Student resolves deficiency with corrected income certificate.
5. Re-verification runs with `MATCH` -> transitions to `VERIFIED`.
6. Readiness for Sanction confirmed.
7. Ministry issues Sanction Order (`SANCTION-MTA-2026-XXXX`) -> transitions to `SANCTIONED`.
8. DBT Payment dispatched to PFMS -> transitions to `PAYMENT_PROCESSING`.
9. PFMS Credit Success simulated -> transitions to `PAID`.
10. JAGO answers query with zero hallucination and authoritative citations in English and Hindi.

---

## 2. Interactive Admin UI Walkthrough
1. Start the server: `npm run dev`.
2. Visit `http://localhost:3000`.
3. Inspect the **Dashboard** KPIs computed live from the database.
4. Open **Applications** (`/applications`) -> Click into an application -> Test interactive verification, sanction order issuance, and DBT payment simulation.
5. Open **JAGO Console** (`/jago-console`) -> Test student questions and inspect grounded responses.
6. Open **Beneficiary Intelligence** (`/beneficiaries`) -> Run candidate scan and review outreach candidates.
