# JAGO Timeout Fix — V22

## Root cause
JAGO's request path could block on SQLite/Prisma operations before returning the response. In particular, recent-conversation lookup and the JagoAssistance history INSERT were on the synchronous request path. The application database query also fetched the full application relation graph for every JAGO intent.

## Fix
- Recent-history lookup is bounded by `JAGO_HISTORY_TIMEOUT_MS` and is treated as secondary context.
- Application/student data is loaded selectively by intent instead of fetching every relation on every request.
- Explicit application lookups use a single `findFirst` and preserve the privacy boundary.
- Context reads are bounded by `JAGO_CONTEXT_TIMEOUT_MS`.
- Response generation is bounded by `JAGO_RESPONSE_TIMEOUT_MS` with a grounded fallback.
- JAGO history persistence is now best-effort and no longer blocks the response.
- The browser JAGO request timeout is 30 seconds to tolerate the first Next.js dev compilation while the backend itself remains bounded.
- JAGO history loading uses a 3-second optional timeout so opening the assistant does not wait 15 seconds for history.

## Defaults
- `JAGO_HISTORY_TIMEOUT_MS=350`
- `JAGO_CONTEXT_TIMEOUT_MS=3500`
- `JAGO_RESPONSE_TIMEOUT_MS=7000`

## Validation
The modified TypeScript/TSX files were transpile-checked successfully. A full dependency-backed test/build run was not completed in the isolated build environment because `npm install` did not finish before the environment command timeout.
