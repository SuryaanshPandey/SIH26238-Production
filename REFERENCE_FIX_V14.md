# SIH26238 REAL-DATA v14

## One-pass runtime resilience and scholarship-source hardening

This release preserves the v13 reference/auth fixes and adds the following production hardening:

- Fixed the `government.ts` local config import so `/profile` can compile.
- Added `AppError.conflict()` and `AppError.unauthorized()` plus duplicate-registration handling.
- Fixed verification CORS preflight handling for `OPTIONS` and `Authorization` requests.
- Added a verified official NSP academic-year 2026-27 catalogue snapshot for outage/parse-failure fallback.
- NSP catalogue loading is live-first, non-blocking when cached official data exists, and exposes `source_mode=LIVE|SNAPSHOT`.
- Prevented live and snapshot catalogue rows from being mixed in one response.
- Added scholarship request timeout/in-flight deduplication to prevent React StrictMode duplicate fetches and permanent spinners.
- All major Student App screens now fail gracefully instead of leaving skeleton loaders indefinitely when optional APIs fail.
- Dashboard renders profile first and loads optional applications/documents/deficiencies/scholarships and payments independently.
- My Applications renders applications before optional PFMS payment lookups finish.
- Document Wallet renders student documents independently from DigiLocker connector status.
- JAGO now always has a deterministic initial assistant message and preserves chat replies instead of reloading an empty history.
- Added visible retry/error states for scholarship, profile, application, action, notification, eligibility, document, and detail screens.
- Snapshot scholarship records cannot be evaluated with legacy/demo eligibility rules; they return `NEEDS_VERIFICATION` until an authorized ruleset is available.
- Real-mode startup preloads the official NSP snapshot and the health check accepts either fresh NSP live data or the explicit official snapshot fallback.

## Validation performed

- Official NSP snapshot contains 29 catalogue records for academic year 2026-27.
- Relative-import resilience scan: `missing_local_imports=0`.
- `scripts/frontend-resilience-check.py`: `resilience_checks=PASS`.
- TypeScript parser scan found no syntax/parser diagnostics; a full dependency-backed Next build could not be executed in the isolated environment because npm dependency downloads were unavailable/time-limited.
