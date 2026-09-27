# Official Scholarship Aggregator — SIH26238

The Scholarship module now uses an official-source aggregation architecture instead of treating the bundled NSP snapshot as the source of record.

## Source policy

Only HTTPS official hosts are accepted. The built-in sources are:

- National Scholarship Portal (scholarships.gov.in)
- Government of India myScheme (myscheme.gov.in)
- University Grants Commission (ugc.gov.in)
- Ministry of Tribal Affairs (tribal.nic.in)
- Department of Social Justice & Empowerment (socialjustice.gov.in)
- Ministry of Minority Affairs (minorityaffairs.gov.in)
- Department of Empowerment of Persons with Disabilities (depwd.gov.in)
- Ministry of Education (education.gov.in)
- All India Council for Technical Education (aicte-india.org)
- Ministry of Labour & Employment (labour.gov.in)

Additional official `.gov.in`, `.nic.in`, or AICTE hosts can be configured through `ADDITIONAL_OFFICIAL_SCHOLARSHIP_SOURCES_JSON`.

## Data quality rules

Every canonical record keeps source URL, source name, fetch timestamp, extraction method and confidence. Duplicate records are merged instead of copied into the student catalogue. Source disappearance is not treated as proof that a scholarship was permanently deleted; existing verified records are retained until a subsequent successful source refresh provides authoritative change information.

## Runtime model

Student UX is cache-first. A live refresh runs in the background. The old 2026-27 NSP snapshot remains only as an emergency continuity fallback and is never mixed with a successful live aggregate.

## Manual refresh

Use:

`powershell -ExecutionPolicy Bypass -File .\\REFRESH_SCHOLARSHIPS.ps1`

The script generates Prisma client artifacts, applies the local schema, and runs the official aggregation job.
