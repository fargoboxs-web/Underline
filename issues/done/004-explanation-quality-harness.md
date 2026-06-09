## Type

AFK

## Parent PRD

`docs/prd/underline-self-use-v1.md`

## What to build

Add representative explanation fixtures and tests so bridge quality is evaluated against concrete reading scenarios instead of ad hoc spot checks.

## Acceptance criteria

- [x] 5 to 10 representative reading scenarios are encoded as fixtures
- [x] API tests validate shape, language, and bridge quality heuristics
- [x] Quality harness runs in `npm run test`

## Blocked by

- Blocked by `issues/done/002-workflow-bootstrap.md`

## Completion note

Completed by adding a fixture-backed API quality harness that checks structure, language consistency, provenance, and bridge-paragraph heuristics across representative reading scenarios.
