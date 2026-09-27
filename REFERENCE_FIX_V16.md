# REFERENCE_FIX_V16 — DigiLocker real fetching

This release fixes the DigiLocker integration end-to-end:

- production DigiLocker/Meri Pehchaan OAuth endpoint defaults
- encrypted OAuth token storage and refresh
- official issued-document metadata fetch
- real sync into the verification document wallet
- duplicate-safe URI-based linking
- profile “Fetch documents” action
- wallet “Sync DigiLocker” action
- no fake/synthetic DigiLocker records
- secured inter-service document writes when `VERIFICATION_SERVICE_API_KEY`/`SIH_API_KEY` is configured

External official credentials are intentionally not included.
