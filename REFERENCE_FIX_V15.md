# SIH26238 REAL-DATA v16

## Scholarship navigation and performance hardening

- Scholarship Discovery no longer forces a live refresh every time `/scholarships` is opened.
- Added the verified 2026-27 NSP snapshot to the Student App itself so the catalogue can render immediately on a cold navigation.
- Added session-level stale-while-revalidate caching with a 5-minute fresh window and 24-hour stale window.
- Live NSP/operations refresh now happens in the background and cannot replace usable official catalogue data with an error screen.
- Scholarship details resolve from the in-memory/session/bundled catalogue before making a network request.
- Dashboard quick-link and bottom navigation now share the same catalogue cache rather than creating separate slow fetches.
- Fixed the React list-key warning in `ChatWindow` by making message/action keys unique and stable for the append-only chat UI.
- Updated scholarship tests for the 29-record 2026-27 official snapshot architecture.

## Validation performed

- Bundled snapshot: 29 records, 29 unique IDs, all academic year 2026-2027.
- No remaining `getScholarships(true)` call in Scholarship Discovery.
- No remaining `key={msg.id}` list key in ChatWindow.
- ZIP integrity verified after packaging.

A complete dependency-backed Next.js build was not run in this environment because `npm ci` timed out and the local dependency tree is unavailable.
