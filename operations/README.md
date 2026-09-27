# SIH26238 — RIJVAN MODULE: SCHOLARSHIP OPERATIONS & INTELLIGENCE
### Ministry of Tribal Affairs — Smart Automation Theme (SIH 2026)

> **Important Notice:** This repository contains the **Rijvan Module** (Scholarship Operations & Intelligence). It is an autonomous, demo-ready, independently runnable subsystem designed to cleanly integrate with **Suryansh** (Student Access & Mobile App) and **Suryaansh** (Documents & Verification Intelligence) via **Common Data Contract v1**.

---

## 🎯 What This Module Does
The **Rijvan Module** is the operational core, decision engine, and lifecycle authority of the platform:
- **Sole State Owner:** Governs `application.status`, `deficiency.status`, `review.status`, `sanction.status`, and `payment.status`.
- **Deterministic Eligibility Engine:** Composable rules evaluating Category (ST), Income ceilings, Academic level, AISHE enrollment, and Verification evidence without LLM hallucination.
- **Verification to Deficiency Translation:** Translates upstream verification results into actionable deficiency workflows; **never** automatically rejects on `SOURCE_UNAVAILABLE`.
- **Manual Review Queue:** Officer case examination workbench with mandatory justification logging.
- **Sanction & DBT Payment Domain:** Strictly decoupled domains with a provider interface; deterministic PFMS mocks are test-only and disabled in real-data mode.
- **Grounded JAGO AI Backend:** Context-grounded assistant with bilingual (English/Hindi) support and source citations.
- **Beneficiary Proactive Intelligence:** Detects unassisted eligible tribal students from institutional registers (AISHE, UDISE+) with confidence scoring.
- **Tamper-Evident Audit Trail:** Immutable logging of all state transitions and domain actions.

---

## ❌ Out of Scope (Owned by Other Modules)
- **Suryansh (Module 1):** Student mobile app, registration, onboarding, document upload UI.
- **Suryaansh (Module 2):** Document OCR/storage backend, biometric verification engine, DigiLocker connector, verification investigation UI.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js v20+ or v24+
- npm or yarn

### 2. Installation
```bash
git clone <repo-url>
cd SIH26238-Rijvan
npm install
```

### 3. Database Migration & Seeding
```bash
# Push Prisma schema to SQLite database (file:./dev.db)
npm run prisma:migrate

# Seed 5 ST Schemes and realistic demo applications
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** to view the Government Operations Admin Portal.

---

## 🧪 Automated Tests & Definition of Done
```bash
# Run Vitest test suites (Unit, State Machine, Contract)
npm test

# Run End-to-End Test/Demo Walkthrough
npm run demo

# Run Cross-Module Simulator (Suryaansh -> Rijvan)
npm run simulator

# Run Complete Automated Definition-of-Done Checklist
npm run verify
```

---

## 📋 Common Data Contract v1
All cross-module communication conforms to the standard response envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "contract_version": "v1",
    "request_id": "req_1790181546774_bxrip",
    "timestamp": "2026-09-23T16:30:00.000Z"
  }
}
```

---

## 📚 Complete Documentation Suite
- [ARCHITECTURE.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/ARCHITECTURE.md)
- [API.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/API.md)
- [DATABASE.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/DATABASE.md)
- [ELIGIBILITY_ENGINE.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/ELIGIBILITY_ENGINE.md)
- [WORKFLOW.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/WORKFLOW.md)
- [JAGO.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/JAGO.md)
- [BENEFICIARY_INTELLIGENCE.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/BENEFICIARY_INTELLIGENCE.md)
- [MOCK_INTEGRATIONS.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/MOCK_INTEGRATIONS.md)
- [INTEGRATION.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/INTEGRATION.md)
- [TESTING.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/TESTING.md)
- [SECURITY.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/SECURITY.md)
- [DEMO.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/DEMO.md)
- [TROUBLESHOOTING.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/TROUBLESHOOTING.md)
- [FINAL_STATUS.md](file:///Users/rijvan/Desktop/SIH26238-Rijvan/FINAL_STATUS.md)
