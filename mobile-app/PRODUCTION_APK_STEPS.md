# Production APK after Render deployment

Once Render gives you the three final HTTPS URLs, run from `mobile-app`:

```powershell
.\BUILD_PRODUCTION_APK.ps1 `
  -StudentAppUrl "https://<student-host>" `
  -MobileOpsUrl "https://<operations-host>/api/v1" `
  -MobileVerificationUrl "https://<verification-host>"
```

The script rejects non-HTTPS URLs and forces cleartext HTTP off for the production APK.

Output:

```text
mobile-app/dist/SIH26238-v25-production.apk
```
