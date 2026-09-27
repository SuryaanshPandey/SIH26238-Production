# Reference Fix v19 — Foundation Reliability, Uploads, Eligibility, Navigation

This release fixes the first foundation issues found after the v18 baseline:

- Real manual document uploads. The prior UI selected a file but only sent metadata; v19 uploads the actual file, validates type/size, calculates SHA-256, stores the file locally, and persists document metadata.
- Document titles and file metadata are retained in the verification contract instead of falling back to the enum name.
- Document list requests use short-lived browser caching and in-flight deduplication.
- Dashboard is stale-while-revalidate: returning to the dashboard can render the cached student profile immediately and a failed refresh becomes a warning instead of a blank/error dashboard.
- Dashboard secondary data is fetched concurrently; optional payment lookups never block rendering.
- Eligibility no longer calls the heavy document/verification providers when the selected scholarship only has NSP catalogue metadata. It returns an explicit NEEDS_VERIFICATION state quickly rather than timing out.
- Eligibility uses cached scholarship/profile data, defaults ST students toward the ST-specific catalogue entry when no scheme was supplied, and never displays an income ceiling of ₹0 when the official catalogue does not provide a ceiling.
- Eligibility UI distinguishes a safe catalogue pre-check from an official final eligibility decision.
- My Applications `+ New` now opens `/applications/new`; that page has an explicit scheme-selection screen when no scheme was preselected.

This release intentionally does not replace the scholarship catalogue source strategy yet. The official-source scholarship work is the next phase.
