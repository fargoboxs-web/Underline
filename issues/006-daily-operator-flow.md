## Type

HITL

## Parent PRD

`docs/prd/underline-self-use-v1.md`

## What to build

Run Underline the way the operator actually intends to use it, capture friction in the startup, explanation, and persistence flow, then turn each real blocker into a new issue.

## Acceptance criteria

- [ ] Run `npm run demo:start`
- [ ] Load the extension and open a real article
- [ ] Enable reader mode and generate at least one bridge
- [ ] Regenerate once and remove once
- [ ] Refresh the page and confirm state continuity
- [ ] Record real friction as follow-up issues

## Blocked by

- Blocked by `issues/done/002-workflow-bootstrap.md`
- Blocked by `issues/done/003-explicit-fallback-slice.md`
- Blocked by `issues/done/004-explanation-quality-harness.md`
- Blocked by `issues/done/005-bridge-state-reliability.md`

