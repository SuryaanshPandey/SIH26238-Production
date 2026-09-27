# Official Scholarship Source Registry

The default registry is deliberately limited to official government or official statutory-council sources. The aggregator does not ingest scholarship blogs, commercial aggregators, or arbitrary web pages.

| Source | Role | Strategy |
|---|---|---|
| National Scholarship Portal (NSP) | Current NSP catalogue | Live catalogue cards + official specification-page enrichment |
| myScheme | Central + State/UT discovery | Index + sitemap + rotating detail crawl |
| University Grants Commission (UGC) | Higher-education scholarships/fellowships | Student Corner tables/links + detail crawl |
| Ministry of Tribal Affairs | ST scholarships/fellowships | Official scholarship page + detail links |
| Social Justice & Empowerment | SC/OBC/EBC/DNT education schemes | Official scheme links + detail crawl |
| Ministry of Minority Affairs | Minority scholarships | Official ministry page + detail links |
| DEPwD | Scholarships for students with disabilities | Official scholarship page + detail crawl |
| Ministry of Education | Education scholarships | Official page + detail crawl |
| AICTE | Technical-education schemes | Official AICTE schemes page + detail crawl |
| Labour & Employment | Worker-family student support | Official ministry pages + detail crawl |

Additional sources can be supplied through `ADDITIONAL_OFFICIAL_SCHOLARSHIP_SOURCES_JSON`. Every additional URL is accepted only when it is HTTPS and belongs to an allowed official host pattern (`*.gov.in`, `*.nic.in`, or the explicitly allow-listed official AICTE host).

## Source-of-truth policy

A successful live aggregate is the catalogue source of record. The bundled 2026-27 NSP snapshot is retained only as an emergency continuity fallback when no usable official aggregate is available. Snapshot rows are never mixed with a successful live aggregate.
