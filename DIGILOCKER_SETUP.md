# DigiLocker setup

This project uses the official DigiLocker/ API Setu requester OAuth flow. Real DigiLocker documents cannot be fetched with only a public URL; the organization must be onboarded as an authorized partner/requester and receive client credentials.

## 1. Get official credentials
Use the official API Setu Partner Portal: https://partners.apisetu.gov.in/

DigiLocker states that requesters are authorized entities and use OAuth 2.0/SSO for access. The redirect URI must match the URI registered for the partner application.

## 2. Configure locally
Copy `.env.digilocker.example` to `.env.digilocker` and fill:

```env
DIGILOCKER_OAUTH_CLIENT_ID=...
DIGILOCKER_OAUTH_CLIENT_SECRET=...
DIGILOCKER_OAUTH_REDIRECT_URI=http://localhost:3001/api/v1/government/digilocker/callback
```

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-digilocker.ps1
```

The startup script automatically imports these three values into `operations/.env` and preserves them on subsequent starts.

## 3. Restart
Run `START.ps1` again. The status endpoint and Document Wallet will change from `NOT_CONFIGURED` to `READY`.

## 4. Connect and fetch
Profile -> Connect DigiLocker -> approve on the official DigiLocker page -> return to the app -> Fetch documents.

The service only labels records as DigiLocker-sourced after the official connector has actually returned them. No synthetic DigiLocker documents are generated.
