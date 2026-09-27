# Official Scholarship Ingestion Validation

Static validations completed for this release:

- Node type-stripping parser check for modified TypeScript files: PASS
- Python syntax checks for project Python files: PASS
- Prisma schema structure: source, state and scholarship provenance fields present
- Source URL policy: HTTPS + `.gov.in` / `.nic.in` allow-list
- Persistent detail-crawl cursor: enabled
- Live source failure: last-known-good catalogue retained
- Manual refresh command: `REFRESH_SCHOLARSHIPS.ps1`

A live source fetch cannot be truthfully marked as executed from this isolated build environment because outbound DNS/network access is unavailable. The runtime code is designed to perform the live fetch on the user's machine during `START.ps1` / `REFRESH_SCHOLARSHIPS.ps1`.
