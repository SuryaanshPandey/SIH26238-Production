# v21 — Document Upload Runtime Fix

Fixed `ReferenceError: getCachedDocuments is not defined` during document upload.

The upload method now uses a module-level cache helper instead of referencing an API-object method as an unqualified function. The upload orchestration also avoids relying on an implicit `this` binding.
