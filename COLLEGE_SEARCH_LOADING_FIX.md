# v23 College Search Loading UX Fix

The student registration college/institution lookup now provides immediate visual feedback while the official institution directory is being queried.

## Changes
- Spinner appears inside the College / Institution Name field while lookup is in progress.
- Dropdown opens immediately after two characters so the user sees that the search is active.
- Debounced official-directory lookup remains at 300 ms to avoid excessive requests while typing.
- Previous lookup requests are aborted when the query changes, preventing stale results from replacing newer results.
- Loading dropdown shows an animated spinner plus lightweight skeleton rows.
- Successful selection shows a verification/provenance indicator.

## Validation
- TypeScript/TSX parser: PASS
- Modified API contract parser: PASS
- ZIP integrity: PASS
