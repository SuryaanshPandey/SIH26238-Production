v21 - document upload runtime hotfix.

v23: College search loading UX + abort stale institution lookups.


Scholarship aggregator implementation: v24.1

v24.2 - Official multi-source scholarship ingestion foundation.

v24.3 - Multi-source official scholarship ingestion hardening, persistent crawl state, provenance, eligibility extraction and live refresh tooling.

- NSP catalogue cards now enqueue their official specification links for background detail enrichment.
- MOTA/MoMA scholarship pages expose official detail links to the incremental crawler.
- Scholar catalogue cache key bumped to v3 to prevent stale pre-aggregator session data.
- Source-health endpoint reports configured sources even before their first successful run.
