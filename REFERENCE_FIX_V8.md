# REFERENCE FIX v8

Integrated from the supplied `sih26238-reference-fix.zip`. The Operations reference service now uses the supplied LGD/OGD implementation for State/District reference data while preserving the existing REAL-DATA frontend ordering and college autocomplete.

Source precedence: live LGD probes first; configured official OGD API fallback second; no synthetic local state/district list.
