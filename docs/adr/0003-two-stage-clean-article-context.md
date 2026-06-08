# ADR 0003: Two-Stage Clean Article Context

## Status

Accepted

## Decision

When a real model is configured, Underline v1 uses a two-stage article understanding path:

1. The extension sends visible page text, capped at 50k characters, to the local API.
2. The local API asks the configured upstream model to return a cleaned article body.
3. The extension caches that cleaned body in browser local storage using URL plus article fingerprint.
4. Bridge generation sends the cleaned article body, highlights, learner profile, and prompt instructions to the local API.

The clean article can be opened from the popup in a dedicated tab. The tab only shows the cleaned body.

## Consequences

- Underline prioritizes explanation quality over strict context minimization for self-use v1.
- The first real-model action on a page can be slower and more expensive because it may require cleaning the article body.
- If clean-article generation fails, bridge generation must clearly downgrade to the existing nearby-context path instead of blocking reading.
- Demo mode must not fabricate cleaned article bodies.
