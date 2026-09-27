# CROSS-MODULE INTEGRATION GUIDE
## How Suryansh (Student App) and Suryaansh (Verification) Connect

---

## 1. What Rijvan Exposes to Teammates

### For Suryansh (Student Mobile App):
- `GET /api/v1/scholarships`: Browse available schemes and benefit criteria.
- `POST /api/v1/applications`: Create initial draft application.
- `POST /api/v1/applications/:id/submit`: Submit application for automated processing.
- `GET /api/v1/applications/:id`: Query real-time status and timeline.
- `GET /api/v1/applications/:id/deficiencies`: Retrieve open action items and upload updated evidence.
- `POST /api/v1/deficiencies/:id/resolve`: Signal deficiency resolution.
- `GET /api/v1/notifications/:studentId`: Retrieve student notification stream.
- `POST /api/v1/jago/query`: Power the student-facing conversational chatbot.

### For Suryaansh (Verification Intelligence):
- `POST /api/v1/applications/:id/start-verification`: Hand off application for automated verification.
- Suryaansh transmits verification outcomes (`MATCH`, `MISMATCH`, `SOURCE_UNAVAILABLE`) adhering to `VerificationContract`.

---

## 2. Integration Boundary Rules
- **No Direct DB Access:** Suryansh and Suryaansh must **never** connect directly to the SQLite/PostgreSQL database of this module.
- **Common Contract v1 Standard:** All API calls must utilize the frozen envelope format with `x-request-id` header.
