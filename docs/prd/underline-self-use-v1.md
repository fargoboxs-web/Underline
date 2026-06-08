# Underline Self-Use v1 PRD

## Problem Statement

When I read articles outside my comfort zone, I often do not need a dictionary definition for one term. I usually lack the background frame that would make a whole sentence or paragraph click. Existing reading tools either summarize too much, define too little, or require too much setup friction to use repeatedly.

## Solution

Underline should become a local-first reading companion that lets me highlight one to three confusing phrases inside a normal web article and receive one compact bridge paragraph in the same language as the article. For real-model use, Underline first cleans the page's visible text into a readable article body, caches that clean article locally, and then uses the clean article plus the highlight to generate the bridge. The result must clearly say whether it came from a real model or a demo fallback, and the flow must be reliable enough for daily use.

## User Stories

1. As a non-technical reader, I want to highlight confusing text directly in an article, so that I can ask for help exactly where I get stuck.
2. As a non-technical reader, I want one bridge paragraph instead of many definitions, so that I understand the missing background frame.
3. As a bilingual reader, I want the explanation to stay in the article language, so that reading flow does not break.
4. As a daily user, I want one recommended local startup flow, so that I do not have to remember engineering steps.
5. As a cautious user, I want the tool to tell me whether the explanation came from a real model or a demo fallback, so that I know how much to trust the result.
6. As a cautious user, I want a visible fallback reason when the system drops to demo mode, so that failures are not hidden.
7. As a returning user, I want my highlights and inserted bridge paragraphs to survive page refresh, so that I can continue reading without losing context.
8. As a reader, I want to regenerate a bridge paragraph, so that I can get a better explanation when the first one misses.
9. As a reader, I want to remove a bridge paragraph, so that I stay in control of what appears in the article.
10. As a reader using a real model, I want to open the clean article body from the popup, so that I can inspect what Underline used as its reading context.
11. As a product operator, I want stable tests around explanation shape, clean-article caching, fallback behavior, and bridge state behavior, so that changes do not silently break daily use.

## Implementation Decisions

- Keep the monorepo split between `apps/api`, `apps/extension`, and `packages/shared`.
- Keep local-first operation as the only supported v1 mode.
- Use `demo:start` as the default operator entrypoint.
- Preserve mock fallback behavior, but make provenance explicit in API responses and extension UI.
- Add only the minimum response fields needed to surface provenance and fallback reasons.
- Keep DOM rendering in the extension and structured explanation generation in the API.
- Add a two-stage real-model path: clean visible page text into article body, then generate the bridge from the clean body and highlights.
- Send at most 50k characters of visible page text to the clean-article API in v1; do not add chunking yet.
- Cache clean article bodies in browser local storage by URL plus article fingerprint; do not automatically clean up cached bodies in v1.
- Show the clean article through a popup button that opens a dedicated tab; keep the tab focused on the clean body only.
- Keep the old nearby-context explanation path as an explicit fallback when clean-article generation is unavailable or fails.
- Introduce a local workflow layer with project skills, a PRD, ADRs, and local issue files.

## Testing Decisions

- Test API behavior through public HTTP routes where practical.
- Add a quality harness using representative reading scenarios and fixture-like requests.
- Add extension-side tests around bridge state transitions instead of snapshots.
- Test persistence via storage behavior, not visual diffing.
- Test clean-article generation, cache reuse, and downgrade to nearby-context explanations before broader prompt-quality tuning.
- Keep `npm run test`, `npm run typecheck`, and `npm run build` as required gates.

## Out of Scope

- Public launch or Chrome Web Store submission
- Cloud sync or multi-device continuity
- Accounts, teams, or shared workspaces
- Payments or monetization
- Mobile support
- Advanced recommendation systems
- Multiple bridge card layouts

## Further Notes

- v1 is successful when the tool is something I can personally use often without engineering babysitting.
- The product should optimize for confidence and continuity, not breadth.
