# SIH26238 Reference Data Fix v7

## Fixed

- LGD State/District connector now probes the official service with the same POST-empty-payload pattern used by a published LGD client, then compatibility POST/GET probes.
- Upstream LGD failures are returned as HTTP 503 (`UPSTREAM_UNAVAILABLE`) instead of being misclassified as internal HTTP 500 errors.
- Error responses include sanitized upstream attempt diagnostics so the Windows machine can distinguish DNS/TLS/network failures from upstream HTTP errors.
- Registration retry button is disabled while a retry is in progress, preventing repeated request storms.
- Registration remains ordered State -> District -> College; College remains disabled until both official State and District selections exist.
- No hardcoded state/district fallback was introduced.
