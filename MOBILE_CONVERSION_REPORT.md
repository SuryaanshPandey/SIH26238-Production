# Mobile Conversion Report

Baseline ZIP SHA-256:

`a524ce41b0cbb8f2d4ef7e0e190d273c03d9bae3a72e528e949de9b6c2b449b9`

## Preserved architecture

The existing three-module architecture remains intact:

1. Next.js Student App
2. Next.js Operations service
3. FastAPI Verification service

Only one existing application file was changed: `student-app/lib/config.ts`. The change is backward-compatible and adds persisted runtime overrides for the Operations and Verification API base URLs. Existing environment-variable behavior remains the fallback.

## Added

- `mobile-app/android/` native Android WebView project
- Android file picker integration
- Web/Android external scheme integration
- OAuth-safe in-app HTTP/HTTPS navigation
- persistent cookies and Web Storage
- WebView back navigation
- offline connection screen
- Android release/debug build configuration
- `mobile-app/BUILD_APK.ps1` and `BUILD_APK.bat`
- `START-MOBILE.ps1` and `START-MOBILE.bat` for LAN device testing
- root GitHub Actions APK build workflow
- mobile deployment contract and documentation

## Static validations performed in this environment

- Android resource XML parsed successfully.
- Android source structural checks passed.
- Runtime configuration checks passed.
- Java delimiter-balance checks passed.

## Build limitation in this environment

A final APK was not produced inside this sandbox because it does not have an Android SDK/Gradle installation, and the sandbox cannot retrieve the Android/npm dependency graph from the public registries. The provided project is ready to build on a normal Android Studio/Gradle environment or via GitHub Actions.

This is deliberately reported instead of presenting an APK that was not actually built/tested.
