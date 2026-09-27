# SIH26238 v20 — Foundation Final Release

Completed in one release:

1. Manual document uploads use actual PDF/JPG/PNG files with progress, SHA-256 integrity, metadata persistence, size/type validation, duplicate protection, replacement versioning, camera capture support, issue/expiry validation, and a title-vs-type consistency guard.
2. Document Wallet is manual-upload-first; DigiLocker status is optional and non-blocking.
3. Document list/cache is stale-tolerant for navigation; uploads update the cache immediately without a second list request, so the new document appears without a redundant reload.
4. Dashboard starts from cached/stale primary data, isolates secondary failures, and releases the main loading state before payment/PFMS enrichment.
5. Profile starts from cached student data and keeps optional government-connector status separate.
6. Eligibility is cached-first, keeps a slow/missing profile refresh non-fatal, supports a fast honest metadata-only pre-check for catalogue snapshots, and no longer exposes unsupported universal rule toggles as if they were scheme-independent facts.
7. Catalogue-only scholarship records cannot be evaluated by legacy synthetic rules.
8. New Application opens `/applications/new`, provides a local scheme selector, prefetches the document wallet, and gives a clear upload path when no documents exist.
9. Student application listing remains on the lightweight read service and payment enrichment does not block rendering.

Next phase (intentionally separate): live official scholarship-source ingestion and validation against official portals/specifications, followed by the JAGO chatbot overhaul.
