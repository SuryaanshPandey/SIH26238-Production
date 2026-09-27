# SIH26238 Foundation Verification Checklist

Run after extracting the release:

1. Start `START.ps1` and confirm Verification 8000, Operations 3001, Student App 3000 are READY.
2. Sign in as a student and open Dashboard. Navigate through Profile, Scholarships, My Applications, Wallet and JAGO, then return to Dashboard. The dashboard must render from cached data and may show a non-blocking warning, but must not remain on skeletons because PFMS/NSP/DigiLocker timed out.
3. Open Wallet -> Upload. Choose PDF/JPG/PNG, fill metadata, upload. Progress must move to 100%, the new title must appear immediately, and a second list request must not be required. Exact duplicate files must be rejected.
4. Replace a document. The new version must appear and the previous version must remain in history.
5. Open Eligibility. It must render even when the profile refresh is slow. Catalogue snapshot schemes must show a further-verification result instead of a synthetic eligible/not-eligible decision.
6. From My Applications tap New. It must open `/applications/new`, show a scheme selector, prefetch the document wallet, and allow moving into the application wizard without first visiting Scholarship Discovery.
7. Complete an application using consent. The application list must refresh/invalidate after submission.
8. DigiLocker remains optional; when credentials are absent, the UI must say not configured and must not block manual uploads.

Next release gate: live official scholarship-source ingestion and validation. After that release gate passes, overhaul JAGO.
