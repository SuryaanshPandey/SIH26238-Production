# REAL-DATA v6 reference-data fix

## LGD
The stateList and districtList calls use POST, matching the LGD web-service integration pattern. The registration flow does not maintain a synthetic state/district fallback.

## Registration order
State -> District -> Education Stage/Income -> College/Institution -> Course -> Pincode.

The college autocomplete remains disabled until both the official LGD state and district are selected. Institution search is filtered by the selected state and district.

## Provenance
The selected LGD state/district codes are persisted on StudentAccount as `stateLgdCode` and `districtLgdCode`.
