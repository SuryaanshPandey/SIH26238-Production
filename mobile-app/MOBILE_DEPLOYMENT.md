# SIH26238 Mobile Deployment Contract

## Production topology

```text
Android APK
   |
   v
HTTPS Student App
   |
   +---- HTTPS Operations API
   |
   +---- HTTPS Verification API
               |
               +---- official government connectors
```

The Student App should be built with:

```env
NEXT_PUBLIC_USE_LIVE_BACKEND=true
NEXT_PUBLIC_RIJVAN_API_URL=https://<operations-host>/api/v1
NEXT_PUBLIC_VERIFICATION_API_URL=https://<verification-host>
```

Operations should expose:

```env
STUDENT_APP_ORIGIN=https://<student-host>
VERIFICATION_SERVICE_URL=https://<verification-host>
DOCUMENT_SERVICE_URL=https://<verification-host>
```

Verification should allow:

```env
SIH_CORS_ORIGINS=https://<student-host>
```

DigiLocker should return to the deployed Operations callback, and Operations should redirect to the deployed Student App origin.

Never place private OAuth secrets, database passwords, signing keystores, or server API keys into the Android APK or browser-visible environment variables.
