# ADR 0002: Explicit Demo Provenance

## Status

Accepted

## Decision

Whenever Underline uses the mock explanation path, the product must show that outcome explicitly as demo output. If the system fell back because a real upstream model failed, the user must also see the fallback reason.

## Consequences

- `ExplanationResponse` carries explicit fallback metadata.
- Inserted bridges, popup status, and settings views all surface mode clearly.
- Silent degradation is treated as a bug.

