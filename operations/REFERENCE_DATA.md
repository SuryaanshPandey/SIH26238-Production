# Reference Data Integration

The registration form no longer uses hardcoded state/district lists.

## Locations

States and districts are fetched from the Government of India's Local Government Directory (LGD) web services. The LGD web-service calls are made as POST requests (the public web-service examples use POST), rather than browser-style GET requests:

- States: `https://lgdirectory.gov.in/webservices/lgdws/stateList`
- Districts: `https://lgdirectory.gov.in/webservices/lgdws/districtList?stateCode={LGD_STATE_CODE}`

The backend caches these official responses in memory for 24 hours. If LGD is unavailable or returns no data, the API returns an error; it does not fall back to a synthetic list. An LGD/network error therefore does not imply that the user is offline; it means the official reference service could not be reached or parsed at that moment.

## Institutions

College suggestions are fetched server-side from the official UGC college directory:

`https://www.ugc.gov.in/colleges`

The selected institution is persisted with:

- `institutionId`: deterministic UGC-derived reference for the selected record
- `institutionSourceSystem`: `UGC`
- `institutionSourceReference`: selected reference
- `institutionSourceUrl`: official UGC directory URL

Institution search results are cached for 24 hours to avoid downloading the large UGC directory for every keystroke. The UI shows the source reference after a user selects a result.

The UGC page used here is the UGC's published list of colleges under Section 2(f) & 12(B). Institutions outside that directory can still require manual entry and subsequent verification; they are not presented as UGC-confirmed.

## Reference status

`GET /api/v1/reference/status` exposes the exact source systems and policy used by the registration form. It does not claim that a protected student record is connected.

## Student location provenance

Registration stores the selected LGD state and district codes (`stateLgdCode`, `districtLgdCode`) alongside their human-readable names. This keeps the government-directory selection traceable after account creation.
### UGC college autocomplete
The registration college autocomplete consumes the official UGC colleges directory. The parser maps the published table by header names and falls back to the published column order (`Sr No`, `Name of the college`, `Affiliated To University`, `College address`, `District`, `State`, `Status`, ...). It does not treat the serial-number column as the college name.

## Institutions (UGC + AISHE)

The registration autocomplete aggregates the live UGC college directory with the `aishe-institutions-list` AISHE dataset snapshot. AISHE is the broader higher-education institution directory and includes affiliated colleges; UGC remains a live recognition-oriented source. AISHE snapshot records are labeled as such and are not represented as a live API response.


### AISHE coverage

The institution autocomplete also searches the `aishe-institutions-list` dataset, whose data is sourced from the Government of India AISHE Higher Education Institution Directory. AISHE is used as a directory snapshot and is labeled `source_mode=SNAPSHOT`; it is not represented as a live government API response. UGC remains a live source where its published college directory contains the institution. Location matching normalizes the Prayagraj/Allahabad naming change so historical AISHE records can still match the current State/District selection.
