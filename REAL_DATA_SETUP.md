# SIH26238 Real-Data Deployment Guide

This package runs the application in real-data mode by default. The production path does not silently fall back to demo students, demo applications, mock notifications, or simulated payment outcomes.

## What is live now

### National Scholarship Portal (NSP)
The Operations service reads the public NSP scholarship catalogue from:

https://scholarships.gov.in/All-Scholarships

The catalogue is synchronized into the local Prisma database with source metadata (`NSP`, source URL, and fetch timestamp). The student application reads these records through the Operations API. A failed refresh uses an existing NSP cache only; it never substitutes local demo schemes.

The live catalogue currently publishes Academic Year 2026-27 and scheme application windows. Complete scheme-specific eligibility rules are not inferred from the public catalogue page. Such rules are returned as `NEEDS_VERIFICATION` until an official machine-readable rule source is configured.

## Authentication

Student registration creates a real `StudentAccount` in the Operations database. Passwords are stored using Node.js `scrypt` with a random per-password salt. Login accepts the registered mobile number, email address, or generated Student ID and issues an authenticated session.

This is application authentication, not government identity authentication. Do not describe a student as Aadhaar/DigiLocker verified merely because a local account exists.

## Protected government sources

DigiLocker, UDISE+, APAAR, AISHE, UIDAI, state e-District, and UGC/NTA are represented by production HTTP adapters. In real-data mode an adapter with no configured official endpoint returns `NOT_CONFIGURED` / `SOURCE_UNAVAILABLE`; it does not return fabricated records. DigiLocker also has an official OAuth-backed connection path in the Operations service; once the partner credentials are supplied, the student can authorize the connection from Profile and the verification service can read the authorized DigiLocker account profile through the local server-to-server bridge.

Configure only an endpoint supplied through the relevant official onboarding/authorization process:

- `SIH_SOURCE_DIGILOCKER_BASE_URL` + `SIH_SOURCE_DIGILOCKER_API_KEY`
- `SIH_SOURCE_UDISE_PLUS_BASE_URL` + `SIH_SOURCE_UDISE_PLUS_API_KEY`
- `SIH_SOURCE_APAAR_BASE_URL` + `SIH_SOURCE_APAAR_API_KEY`
- `SIH_SOURCE_AISHE_BASE_URL` + `SIH_SOURCE_AISHE_API_KEY`
- `SIH_SOURCE_UIDAI_BASE_URL` + `SIH_SOURCE_UIDAI_API_KEY`
- `SIH_SOURCE_STATE_EDISTRICT_BASE_URL` + `SIH_SOURCE_STATE_EDISTRICT_API_KEY`
- `SIH_SOURCE_UGC_NTA_BASE_URL` + `SIH_SOURCE_UGC_NTA_API_KEY`
- `SIH_SOURCE_INSTITUTION_BASE_URL` + `SIH_SOURCE_INSTITUTION_API_KEY`

The generic verification adapter expects a configured provider/bridge to return the normalized source envelope documented in `verification/app/connectors/http.py`. Government-specific credential handling stays outside the verification engine. The packaged START script configures the local DigiLocker bridge automatically and generates its server-to-server key.

## DigiLocker authorization

API Setu publishes the current DigiLocker partner resource center and requester API specifications. DigiLocker user authorization uses OAuth 2.0; partner onboarding/authorization is required before production access.

Production authorization endpoint:
https://api.digitallocker.gov.in/public/oauth2/1/authorize

Production token endpoint:
https://api.digitallocker.gov.in/public/oauth2/1/token

Partner resources:
https://apisetu.gov.in/digilocker

Do not put DigiLocker client secrets in the Student App. Keep them in the Operations server environment.

## Payment provider

PFMS/DBT is not simulated in real-data mode. Payment initiation fails with `PAYMENT_PROVIDER_UNAVAILABLE` until an authorized provider integration is configured. The mock payment simulation endpoint and mock webhook are deliberately disabled in real-data mode.

## Notifications

Student notifications are read from the Operations database for the authenticated student. Notifications are emitted by application workflow/payment events; the Student App does not contain a hardcoded notification list.

## Running locally

1. Extract the package.
2. Run `powershell -ExecutionPolicy Bypass -File .\START.ps1`.
3. Create a new account through `/register`.
4. Log in through `/login`.
5. Open Scholarships and confirm the displayed schemes have `NSP` as the source.
6. Open Documents / Verification and confirm unconfigured protected sources are shown as unavailable rather than verified.
7. Submit a test application only with information you actually provide. Submission records real consent and immediately invokes the verification pipeline; unavailable government sources are reported as unavailable/review-required rather than simulated as matches.

The startup script removes known demo records from the local database and never runs the deterministic seed in real-data mode.

## Demo/test mode

Mocks remain in the repository for automated tests and deterministic demonstrations only. To deliberately run a test environment, set `REAL_DATA_MODE=false` and use the test/demo commands documented in the module READMEs. Do not use that mode for a production submission claiming real-data integration.

## Registration reference data

Registration uses live official reference data:
- States and districts: Government of India's Local Government Directory (LGD) web services.
- College suggestions: UGC's official college directory. Selecting a result stores the source system/reference/URL with the student account.

No synthetic state/district list is used when these sources are unavailable.


### Institution directory

Registration aggregates the live UGC college directory with the AISHE institution dataset package (`aishe-institutions-list`). AISHE results are labeled as a dataset snapshot, while UGC results are labeled live. This prevents a historical AISHE record from being presented as a real-time government API response.


## v12 reference/auth fixes

- Institution autocomplete accepts both `aisheCode` and `aishe_code` record shapes from the AISHE-derived directory package.
- Registration UI labels the institution source as UGC + AISHE + UBA rather than UGC-only.
- A stale/invalid student session now clears itself and redirects to `/login?reason=session_expired` instead of repeatedly producing 401s on protected dashboard calls.
- Before starting services, use `STOP.ps1` from any older extracted product folder so port 3000/3001/8000 are not occupied by a stale build.


### Institution search sources

Institution autocomplete combines the live UGC college directory, the AISHE-derived institution dataset, and the Unnat Bharat Abhiyan Uttar Pradesh RCI directory. The UBA source is especially useful for Uttar Pradesh affiliated/participating institutions and is not a hardcoded fallback.
