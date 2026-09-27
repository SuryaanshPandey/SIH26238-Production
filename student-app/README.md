# SIH26238 — Unified Scholarship Mobile Application for Tribal Students
## Suryansh-Owned Student Experience Module

> **Ministry of Tribal Affairs (MoTA), Government of India**  
> **Problem Statement:** SIH26238 — Smart Automation  
> **Module Owner:** Suryansh (Student Experience)  
> **Architecture Standard:** Common Data Contract v1

---

## 1. Module Ownership & System Boundaries

In accordance with the team division:
- **Suryansh (Me):** Owns the **Student Experience** (mobile-first UI, forms, accessibility, client state, navigation, and decoupled service abstractions).
- **Suryaansh:** Owns **Documents & Verification** (DigiLocker connectors, document storage, OCR/attribute comparison engine).
- **Rijvan:** Owns **Scholarship Domain, Workflow & Intelligence** (scheme master, deterministic rule engine, exception routing, DBT integration, JAGO conversational intelligence).

### Strict Boundary Enforcement
- No business logic or government rules are hard-coded in the UI.
- All interactions route through typed API client adapters in `lib/api/*.ts`.
- Production mode requires the integrated REST backends and a real authenticated student session.
- Demo mocks remain available only to automated tests/local test fixtures; the live UI does not silently fall back to them.
- Scholarship discovery is sourced from the public National Scholarship Portal catalogue at runtime.
- Protected government records (DigiLocker, APAAR, UIDAI, UDISE+, e-District, etc.) are represented by explicit official-provider connectors and return `NOT_CONFIGURED` / `SOURCE_UNAVAILABLE` until authorized provider endpoints and credentials are supplied.

---

## 2. Complete Student Experience (18 Core Capabilities)

1. **Login & Authentication** (`/login`): Database-backed student account login using mobile number, Student ID, or email plus a real password session.
2. **Student Registration** (`/register`): Single unified onboarding form for ST/PVTG students with community classification and DigiLocker access consent.
3. **Student Profile** (`/profile`): Displays student credentials with strict privacy masking (`XXXX-XXXX-8921` for Aadhaar, `XXXXXX4512` for bank accounts, and tokenized APAAR ID `APAAR-ST-2026-9921481`).
4. **Home / Dashboard** (`/dashboard`): Student summary banner, active application card, pending deficiency alerts, and quick service shortcuts.
5. **Scholarship Discovery** (`/scholarships`): Discovery across all 5 official MoTA schemes:
   - *Pre-Matric Scholarship for ST Students* (Centrally Sponsored, Class IX-X)
   - *Post-Matric Scholarship for ST Students* (Centrally Sponsored, Class XI to Higher Ed)
   - *National Fellowship & Scholarship (Top Class)* (Central Sector, premier institutions)
   - *National Fellowship for ST Students (NFST)* (Central Sector, M.Phil / Ph.D. scholars)
   - *National Overseas Scholarship (NOS)* (Central Sector, foreign master's / doctoral degrees)
6. **Scholarship Details** (`/scholarships/[id]`): Detailed breakdowns of tuition fees, monthly maintenance allowances, contingency grants, and required documentation.
7. **Dynamic Eligibility Questionnaire** (`/eligibility`): Interactive form consuming the Eligibility API with deterministic checks against ST community rules, income ceilings, and the "one scholarship at a time" constraint.
8. **Eligibility Result Breakdown** (`/eligibility`): Instant clear feedback (`ELIGIBLE`, `NOT_ELIGIBLE`, or `FURTHER_REVIEW`) with rule-by-rule pass/fail explanations.
9. **Scholarship Application Wizard** (`/applications/new`): 4-step mobile wizard allowing instant selection of pre-verified documents from the Document Wallet and formal declaration submission.
10. **My Applications** (`/applications`): Filterable view (All, Action Required, Completed) of all active and historic scholarship files.
11. **Application Lifecycle & Timeline** (`/applications/[id]`): Detailed audit timeline tracking actions by `STUDENT`, `INSTITUTE`, `STATE_DNO`, `MINISTRY`, and `PFMS_SYSTEM`.
12. **Action Centre & Deficiencies** (`/actions`): Dedicated screen for resolving data mismatches or missing documents.
    > **Key Policy Rule:** Mismatches are **NOT automatically rejected**; they are routed for official manual review by the District Nodal Officer (DNO).
13. **Document Wallet UI** (`/documents`): Repository of digital certificates with status badges (`VERIFIED`, `AVAILABLE`, `MISMATCH`) and instant DigiLocker re-sync.
14. **Attribute-Level Verification Display** (`/applications/[id]`): Transparent attribute-by-attribute comparison of student claims against authoritative sources (`DIGILOCKER`, `AISHE`, `APAAR`, `STATE_EDISTRICT`).
15. **Sanction Order Tracking** (`/applications/[id]`): Breakdown of approved tuition fees vs maintenance allowances and sanction order numbers.
16. **Separate DBT & PFMS Payment Tracker** (`/applications/[id]`):
    > **Contract Rule:** Application status and Payment status are **separate entities**. Application can be `SANCTIONED` while payment is `PAYMENT_PROCESSING` via the PFMS Aadhaar Payment Bridge (APB).
17. **Notifications Feed** (`/notifications`): Push/system notifications with category filters and deep links.
18. **JAGO Application Agent** (`/jago` + global launcher): Conversational control layer for the student app—navigation, scholarship discovery, application/payment tracking, deficiency explanation, eligibility help, document-upload initiation, contextual follow-ups, persistent history, English/Hindi handling, and graceful out-of-scope routing.

---

## 3. Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS with custom MoTA branding palette
- **Forms & Validation:** React Hook Form + Zod
- **Data Fetching & State:** Typed REST API adapters; deterministic mocks are test-only and never used as silent live fallbacks
- **Icons:** Lucide React
- **Testing:** Vitest + React Testing Library + jsdom

---

## 4. Folder Structure

```
SIH26238-Student-App/
├── app/
│   ├── layout.tsx                # App shell container, language & query providers
│   ├── page.tsx                  # Splash / welcome entry
│   ├── login/page.tsx            # Student mobile OTP login
│   ├── register/page.tsx         # Unified ST student registration
│   ├── dashboard/page.tsx        # Student home dashboard
│   ├── profile/page.tsx          # Profile & masked credentials
│   ├── scholarships/
│   │   ├── page.tsx              # 5-scheme discovery & search
│   │   └── [id]/page.tsx         # Scheme details & benefits
│   ├── eligibility/page.tsx      # Dynamic questionnaire & verdict
│   ├── applications/
│   │   ├── page.tsx              # My Applications list
│   │   ├── new/page.tsx          # Multi-step application submission wizard
│   │   └── [id]/page.tsx         # Application timeline & payment tracker
│   ├── actions/page.tsx          # Action Centre / deficiency resolution
│   ├── documents/page.tsx        # Document Wallet (DigiLocker reuse)
│   ├── notifications/page.tsx    # Notification alerts feed
│   └── jago/page.tsx             # JAGO conversational chatbot
├── components/
│   ├── ui/                       # Button, Card, Badge, Input, Modal primitives
│   ├── layout/                   # MobileHeader, MobileBottomNav, LanguageToggle
│   ├── scholarship/              # SchemeCard, SchemeFilter
│   ├── application/              # ApplicationCard, TimelineTracker
│   ├── documents/                # DocumentCard, UploadModal
│   ├── notifications/            # NotificationCard
│   ├── verification/             # VerificationTable
│   ├── payment/                  # PaymentTracker
│   └── jago/                     # ChatWindow
├── lib/
│   ├── contracts/
│   │   └── types.ts              # Common Data Contract v1 definitions
│   ├── api/                      # Clean decoupled API service adapters
│   │   ├── scholarship.ts
│   │   ├── eligibility.ts
│   │   ├── application.ts
│   │   ├── documents.ts
│   │   ├── verification.ts
│   │   ├── payment.ts
│   │   ├── notification.ts
│   │   ├── student.ts
│   │   └── jago.ts
│   ├── mocks/
│   ├── validation/
│   │   └── schemas.ts            # Zod validation schemas
│   └── utils.ts                  # Currency/date formatters, status badge styles
└── tests/                        # 9 Vitest suites with 26 automated tests
```

---

## 5. How to Run & Verify

### Install Dependencies
```powershell
npm.cmd install
```

### Run Automated Test Suite
```powershell
npm.cmd test
```
*Executes all 9 Vitest test suites verifying eligibility rules, application creation, deficiency resolution, payment separation, document wallet sync, and JAGO answers.*

### Type Check
```powershell
npx.cmd tsc --noEmit
```

### Production Build
```powershell
npm.cmd run build
```

### Start Development Server
```powershell
npm.cmd run dev
```
Navigate to `http://localhost:3000` on your mobile browser or inspect using Chrome DevTools device mode.

---

## 6. How to Connect Real APIs (Zero-Rewrite Integration)

When Suryaansh (Documents/Verification) and Rijvan (Scholarship/Workflow/Intelligence) deploy their live REST services:

1. Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SCHOLARSHIP_API_URL=https://api.mota.gov.in/scholarships/v1
   NEXT_PUBLIC_DOCUMENTS_API_URL=https://api.mota.gov.in/documents/v1
   NEXT_PUBLIC_VERIFICATION_API_URL=https://api.mota.gov.in/verification/v1
   NEXT_PUBLIC_DBT_PAYMENT_API_URL=https://api.mota.gov.in/pfms-dbt/v1
   NEXT_PUBLIC_JAGO_API_URL=https://api.mota.gov.in/jago/v1
   ```

2. Replace the data fetcher in `lib/api/*.ts`. For example, in `lib/api/scholarship.ts`:
   ```ts
   // The student app uses the live backend by default; demo mocks are test-only and are not shipped in the production runtime path.
   export const scholarshipApi = {
     async getScholarships(): Promise<Scholarship[]> {
       const res = await fetch(`${process.env.NEXT_PUBLIC_SCHOLARSHIP_API_URL}/schemes`);
       return res.json();
     }
   };
   ```
   **No changes are required in any UI component or page.**

---

## 7. Security & Privacy Guarantees

- **No Raw Aadhaar Storage:** Only the masked last 4 digits are ever rendered (`XXXX-XXXX-8921`).
- **No Raw Bank Numbers:** Account numbers are tokenized and masked (`XXXXXX4512`).
- **Provenance-Aware Verification:** Every verified claim points directly to its source authority (`DIGILOCKER`, `AISHE`, `STATE_EDISTRICT`).
- **Human-in-the-Loop:** Data discrepancies route directly to District Nodal Officer review rather than triggering automated rejections.
