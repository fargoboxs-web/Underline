## Type

AFK

## Parent PRD

`docs/prd/underline-self-use-v1.md`

## What to build

Make the explanation path explicitly distinguish real model output from demo output, and surface fallback reasons when the system degrades to demo mode.

## Acceptance criteria

- [x] API returns explicit fallback metadata when demo mode is used
- [x] Inserted bridge UI shows `AI bridge` or `AI demo`
- [x] Popup or settings UI surfaces fallback status clearly
- [x] Tests cover upstream failure fallback behavior

## Blocked by

- Blocked by `issues/done/002-workflow-bootstrap.md`

## Completion note

Completed by adding explicit `fallbackReason` metadata to explanation responses, surfacing provenance in popup and bridge controls, and covering synthetic upstream failure fallback in API tests.
