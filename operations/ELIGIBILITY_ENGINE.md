# DETERMINISTIC ELIGIBILITY ENGINE
## Rule-Driven Autonomous Decision Logic

---

## 1. Composable Rules
The eligibility engine evaluates student data, scheme parameters, and verified evidence through composable rules:
1. **`CategoryRule`**: Verifies applicant belongs to Scheduled Tribes (`category === "ST"`).
2. **`IncomeRule`**: Evaluates annual family income against scheme maximum threshold:
   - Pre/Post Matric: ≤ ₹2,50,000
   - Higher Education / Fellowship: ≤ ₹6,00,000
   - Overseas: ≤ ₹8,00,000
3. **`EducationLevelRule`**: Validates course compatibility:
   - Pre-Matric: Class 9, 10
   - Post-Matric: Class 11, 12, Undergraduate, Postgraduate
   - Fellowship: M.Phil, Ph.D
4. **`InstitutionRule`**: Confirms valid AISHE enrollment.
5. **`ApplicationPeriodRule`**: Validates current date falls within active application window.
6. **`VerificationEvidenceRule`**: Integrates verification results from Suryaansh.

---

## 2. Decision States
- **`ELIGIBLE`**: All rules satisfied with high confidence (≥ 0.95).
- **`NOT_ELIGIBLE`**: One or more mandatory criteria failed (e.g. non-ST category, income exceeded).
- **`NEEDS_VERIFICATION`**: Required information missing or upstream source was `SOURCE_UNAVAILABLE`.

> **Critical Invariant:** An upstream `SOURCE_UNAVAILABLE` (e.g., state revenue timeout) produces **`NEEDS_VERIFICATION`**, NEVER `NOT_ELIGIBLE` or `REJECTED`.
