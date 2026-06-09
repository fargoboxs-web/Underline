## Type

AFK

## Parent PRD

`docs/prd/underline-self-use-v1.md`

## What to build

Implement the two-stage real-model path for self-use v1: clean visible page text into a cached article body, use that body for bridge generation, and expose a popup entrypoint for viewing the clean article in a dedicated tab.

## Acceptance criteria

- [x] `docs/prd/underline-self-use-v1.md` and `docs/adr/0003-two-stage-clean-article-context.md` describe the clean-article decision.
- [x] API exposes `POST /v1/articles/clean` and does not return mock cleaned bodies when no real model is configured.
- [x] `ExplanationRequest` supports an optional cleaned article body while preserving the existing nearby-context path.
- [x] Extension captures visible page text, caps it at 50k characters, caches clean article bodies by URL plus article fingerprint, and reuses the cache.
- [x] Popup has a disabled-with-reason clean article button when no real model is configured.
- [x] Popup can request or reuse a clean article and open a dedicated tab that only shows the clean body.
- [x] Clean-article failure downgrades bridge generation to nearby-context mode with a visible status message.
- [x] Tests cover clean-article API behavior and storage cache reuse; typecheck/build cover the popup-to-viewer wiring.

## Blocked by

- Blocked by `issues/done/002-workflow-bootstrap.md`
- Blocked by `issues/done/003-explicit-fallback-slice.md`
- Blocked by `issues/done/005-bridge-state-reliability.md`

## Completion note

Completed by adding shared clean-article schemas, a real-model-only clean article API, browser-local clean article cache, popup-to-article-tab flow, cleaned-context explanation support, and tests for API rejection/success plus cache persistence.
