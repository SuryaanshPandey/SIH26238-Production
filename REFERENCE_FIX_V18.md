# Reference Fix v18 — My Applications Reliability & Performance

## Problem

The Student App's `/applications` page was showing `Request timed out. Please retry.` even though the Dashboard could load the rest of the student data. The API route statically imported the full `ApplicationService`, whose module graph pulls in lifecycle, verification, document, review, notification, sanctions, payments, and eligibility dependencies. In Next.js development this made the first request to the route unnecessarily expensive and could exceed the Student App's request timeout.

The page also performed a fresh application request on every mount and then made payment requests. React StrictMode can mount effects twice in development, which amplified the problem.

## Fix

1. Added `operations/src/modules/applications/ApplicationReadService.ts` as a lightweight, read-only student application query path.
2. The student `GET /api/v1/applications?studentId=...` route now uses the lightweight service.
3. The heavy `ApplicationService` is dynamically imported only for operations/administrative cross-student listing and POST application creation.
4. The student list query selects only fields needed by the list screen and uses the existing `studentId` index.
5. Scholarship metadata is selected in the same database query so the UI can display the real scheme name instead of a raw scheme ID.
6. The Student App now keeps an in-memory/sessionStorage application cache for 30 seconds.
7. In-flight student application requests are deduplicated, so React StrictMode does not create duplicate backend requests.
8. Submitting or resolving a deficiency invalidates the application cache.
9. My Applications renders the application list before fetching optional payment status.
10. Payment endpoint failures cannot hold the page in loading state.
11. Retry performs a targeted force-refresh instead of reloading the entire application.
12. Route is explicitly dynamic with `revalidate = 0` so a user's application list is never served from a stale static route response.

## Validation

- TypeScript parser checks passed for all modified TypeScript/TSX files.
- Student list route no longer statically imports `ApplicationService`.
- Modified package retains previous v17 DigiLocker configuration work and all earlier fixes.
