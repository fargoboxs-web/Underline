## Type

AFK

## Parent PRD

`docs/prd/underline-self-use-v1.md`

## What to build

Stabilize and test the bridge lifecycle so highlight capture, insertion, regenerate, remove, and persistence stay predictable.

## Acceptance criteria

- [x] Bridge session helpers cover insertion, regeneration, and removal
- [x] Storage tests prove page session persistence
- [x] Refresh-safe behavior is represented by test coverage

## Blocked by

- Blocked by `issues/done/002-workflow-bootstrap.md`

## Completion note

Completed by extracting bridge session helpers, adding lifecycle tests for insertion/regeneration/removal, and verifying persisted page sessions keep bridge provenance and consumed-highlight links intact.
