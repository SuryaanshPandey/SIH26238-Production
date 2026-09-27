# Official Scholarship Aggregator — Implementation

## Sources

The runtime source layer is restricted to official Government of India domains (`.gov.in` / `.nic.in`) and the National Scholarship Portal. Default adapters cover NSP, myScheme, UGC, Ministry of Tribal Affairs, Social Justice & Empowerment, Ministry of Minority Affairs, DEPwD, Ministry of Education and Ministry of Labour & Employment.

## Runtime behavior

1. The student UI renders its cached/bundled emergency catalogue immediately.
2. The operations service refreshes official sources in the background.
3. Source records are normalized, validated, deduplicated and merged.
4. Every published record keeps source evidence, URL and fetch timestamp.
5. Detail crawling is bounded and uses a persistent per-source cursor so large catalogues are covered over repeated refreshes rather than only the first N pages.
6. Failed or empty source runs do not delete the last-known-good catalogue.
7. Eligibility rules are not invented from sparse catalogue text.

## Operational endpoint

`GET /api/v1/scholarships/sources` returns latest source-run health for the academic year.

## Emergency snapshot

The bundled NSP snapshot is retained only as an explicit offline continuity mechanism. It is not the source-of-record when the official aggregator has successfully populated live records.


## Current-source coverage

- NSP live catalogue
- myScheme current scheme index + official scheme detail pages + sitemap rotation
- UGC Student Corner and scholarship/fellowship detail links
- Ministry of Tribal Affairs scholarship page
- Department of Social Justice & Empowerment scheme index/details
- Ministry of Minority Affairs official site
- DEPwD scholarship page/details
- Ministry of Education scholarship page/details
- Ministry of Labour & Employment official site

The source allow-list only accepts HTTPS `.gov.in` / `.nic.in` hosts (plus the exact NSP host). Arbitrary blogs and third-party aggregators are not ingested.

## Freshness and failure handling

Source requests use bounded timeouts and retries. myScheme/detail crawling uses a persistent cursor so a large sitemap is processed in batches across refreshes. A failed or empty source run never deletes the previous successful catalogue. Student requests can continue serving the last official cache while refresh work runs in the background.

## Manual refresh

Authorized scholarship officers can POST to `/api/v1/scholarships/sources` to trigger an official-source refresh. GET returns the latest health record for each configured source.
