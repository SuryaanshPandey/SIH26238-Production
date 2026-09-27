# JAGO GROUNDED OPERATIONAL ASSISTANT
## Autonomous, Zero-Hallucination AI Backend

---

## 1. Grounding Principles
- **No Direct LLM Fabrication:** JAGO retrieves authoritative student, application, verification, deficiency, sanction, and payment facts from the database before generating answers.
- **Strict Canonical Enums:** State enum codes (e.g. `UNDER_VERIFICATION`, `ACTION_REQUIRED`, `SANCTIONED`, `PAID`) remain canonical in the database; translations apply purely to human presentation.
- **Source Citations:** Every generated response attaches `source_refs` pointing to the exact database records used.

---

## 2. Supported Intents
- `APPLICATION_STATUS`
- `ELIGIBILITY`
- `DEFICIENCY`
- `VERIFICATION`
- `SANCTION`
- `PAYMENT`
- `SCHOLARSHIP_DISCOVERY`
- `DOCUMENT_HELP`
- `GENERAL_ASSISTANCE`

---

## 3. Bilingual Support
- **English (`en`)**: Native administrative phrasing with clear actionable instructions.
- **हिन्दी (`hi`)**: Accurate Hindi translations matching official Ministry terminologies (e.g., अर्जी स्थिति, सैंक्शन आदेश, प्रत्यक्ष लाभ अंतरण / PFMS DBT).
