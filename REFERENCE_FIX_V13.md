# SIH26238 REAL-DATA v13

## One-pass reference/auth hardening

- Institution search aggregates UGC, AISHE-derived records, and the official Unnat Bharat Abhiyan Uttar Pradesh RCI directory.
- UBA parsing is header-aware and regression-tested against the current published table shape containing `United College of Engineering and Research, Allahabad | C-47913 | Prayagraj`.
- UBA results are cached and only fetched for Uttar Pradesh.
- UGC/AISHE results are ranked with exact state/district matches first and historical Allahabad/Prayagraj normalization.
- Public login/register pages no longer trigger protected deficiency/notification calls even when a stale browser token exists.
- Opening login/register clears a stale local session before a new authentication flow.
