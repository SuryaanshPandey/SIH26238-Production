
## LGD reference data troubleshooting

The registration form loads State and District values only from official LGD/OGD sources. It never falls back to an invented local list.

If `/api/v1/reference/states` reports HTTP 503, inspect the JSON `error.details.attempts` field. It records whether the LGD server returned an HTTP error or the Operations machine could not resolve/connect to the upstream host.

An OGD fallback adapter is now implemented in `ReferenceDataService`: whenever the live LGD service fails or returns something unparseable, it automatically retries against the OGD Platform resource API using `DATA_GOV_API_KEY`, `LGD_OGD_STATES_RESOURCE_ID`, and `LGD_OGD_DISTRICTS_RESOURCE_ID`. These must still be copied from the official data.gov.in resource pages rather than guessed — leaving them blank simply skips the fallback and reports the LGD failure as before.

## LGD 500/503 behavior

The Operations reference adapter now probes the official LGD state/district service using the same POST-empty-payload request pattern used by an independently published LGD client, then compatibility probes the other common request forms. It never inserts a local synthetic state or district list.

An upstream failure is returned as HTTP 503 with `error.details.attempts`, including the exact upstream status/body preview from each probe. This prevents the frontend from mislabeling an upstream failure as an internal application error.

The official OGD Platform also publishes LGD States and LGD Districts datasets, maintained by the Ministry of Panchayati Raj and updated monthly. If direct LGD service access is unavailable in a deployment, configure the OGD API key and verified resource IDs in `.env` — the adapter is already wired up and will be used automatically — rather than introducing a hardcoded fallback list.


### Institution directory sources
The institution autocomplete aggregates UGC live directory data, AISHE-derived institution data, and the live Government of India/IIT Delhi Unnat Bharat Abhiyan Uttar Pradesh RCI directory. Results are scored by state and district, including the historical Allahabad/Prayagraj name mapping.

### Official NSP snapshot fallback

Real mode is live-source-first. When the official NSP public catalogue cannot be reached or changes shape, the operations API may serve `NSP_SNAPSHOT` records from `data/nsp-official-snapshot-2026-09.json`. These records are explicitly labelled `source_mode: SNAPSHOT`; they are catalogue metadata only, not fabricated benefit or eligibility data. The student UI directs users to the official NSP specification before relying on scheme requirements. Once live NSP data succeeds, `source_mode: LIVE` is returned instead.



## DigiLocker issued-document sync

After official DigiLocker Requester/partner onboarding, the student can authorize the connection from Profile. The callback stores the OAuth access/refresh tokens encrypted at rest. The Wallet/Profile fetch action then calls the official issued-document metadata API, links each new issued document into the verification document store, and keeps the DigiLocker URI as a secure source reference rather than pretending the local portal owns the binary file.

Required environment values:

```text
DIGILOCKER_OAUTH_CLIENT_ID=<official client id>
DIGILOCKER_OAUTH_CLIENT_SECRET=<official client secret>
DIGILOCKER_OAUTH_REDIRECT_URI=<exact callback URI registered with DigiLocker>
DIGILOCKER_OAUTH_AUTHORIZE_URL=https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize
DIGILOCKER_OAUTH_TOKEN_URL=https://digilocker.meripehchaan.gov.in/public/oauth2/1/token
DIGILOCKER_USER_URL=https://digilocker.meripehchaan.gov.in/public/oauth2/1/user
DIGILOCKER_ISSUED_DOCUMENTS_URL=https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued
DIGILOCKER_FETCH_TIMEOUT_MS=15000
```

Do not add fabricated credentials. DigiLocker documents can only be fetched after the deployment is authorized as a verified partner and the official callback/client credentials are configured.
