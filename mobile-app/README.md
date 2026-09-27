# SIH26238 Android App Layer

This folder adds a native Android WebView shell around the existing Student App. The three working product modules remain the source of truth:

- `student-app` — student-facing Next.js application
- `operations` — scholarship/application workflow and operations APIs
- `verification` — document/verification intelligence APIs

The native layer does not duplicate those business features.

## Native capabilities added

- Android installable APK target
- persistent WebView cookies and Web Storage
- Android document picker for upload flows
- multi-file selection support
- OAuth-safe in-app HTTP/HTTPS navigation so government redirects remain in the same session
- intent/UPI/phone/email hand-off to Android apps
- browser/Android hand-off for downloaded resources
- Android back-button navigation through web history
- offline/connection-error screen with retry
- portrait phone configuration

## Deployment reality

The existing product is a three-service application. The ZIP's documented runtime is Student App `localhost:3000`, Operations `localhost:3001`, and Verification `localhost:8000`.

An APK installed on a physical phone cannot use those localhost addresses to reach the Windows development machine. A production APK therefore needs the Student App and the two API services deployed on reachable HTTPS endpoints.

The APK is a client shell; it does not embed the Node.js Operations server or the Python Verification server.

## Production build

Install Android Studio/SDK and Gradle 9.6.0 on the Windows machine, then:

```powershell
cd mobile-app
.\BUILD_APK.ps1 `
  -StudentAppUrl "https://student.example.gov"
```

The output is:

```text
mobile-app/dist/SIH26238-v25.apk
```

For a production deployment, keep cleartext HTTP disabled by omitting `-AllowCleartext`.

## Local physical-device build

For a phone on the same Wi-Fi network as the Windows machine, use the machine's LAN IP, for example `192.168.1.25`:

```powershell
cd mobile-app
.\BUILD_APK.ps1 `
  -StudentAppUrl "http://192.168.1.25:3000" `
  -MobileOpsUrl "http://192.168.1.25:3001/api/v1" `
  -MobileVerificationUrl "http://192.168.1.25:8000" `
  -AllowCleartext
```

For this mode the three existing services must listen on `0.0.0.0`, Windows Firewall must permit TCP 3000/3001/8000 on the local network, and the API CORS allow-list must include the exact Student App origin.

Use `START-MOBILE.bat 192.168.1.25` to start the existing services in LAN mode.

## Why this architecture

The current Student App already contains the UI, session model, API adapters, application flows, document wallet, verification display, deficiencies, payments, notifications, and JAGO. Rebuilding those features in React Native or Flutter would create a second implementation and introduce avoidable drift.

Keeping the existing Next.js app inside a native shell means the Android application uses the same web UI and the same backend contracts while Android-specific integration is handled once in `MainActivity`.

## Production hardening

Before store/public release:

- deploy all service endpoints behind HTTPS
- use exact production CORS allow-lists
- validate DigiLocker OAuth redirect URIs against the deployed Operations callback
- configure a real Android release keystore and signing identity
- finalize application ID, versioning, app icon, privacy policy, and data-safety declarations
- test document upload, application submission, deficiency resolution, JAGO, payment/status tracking, notification views, OAuth, downloads, and Android back navigation on a physical device

## CI

`.github/workflows/build-android.yml` builds the same release APK on GitHub Actions when this product is placed in a Git repository.
