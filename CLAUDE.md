# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Underline is a **local-first, self-use reading companion**. The reader highlights confusing text in any web article and a bridge paragraph is inserted inline that teaches the missing background frame — not word-by-word definitions. UI copy is primarily Simplified Chinese.

## Commands

```bash
npm install                 # install all workspaces (postinstall runs `wxt prepare` in the extension)

# Daily self-use (the recommended path): builds extension + API, then ensures the API runs on :8787
npm run demo:start          # logs to .logs/underline-api.log; extension output: apps/extension/.output/chrome-mv3
npm run demo:stop

# Active development (watch mode)
npm run dev:api             # tsx watch on apps/api/src/index.ts
npm run dev:extension       # wxt dev

# Whole-repo gates (run across all workspaces via --workspaces --if-present)
npm run build
npm run test
npm run typecheck

# Single workspace / single test (vitest)
npm run test --workspace @underline/api
npm run test --workspace @underline/api -- app.test.ts          # one file
npm run test --workspace @underline/api -- -t "falls back to demo"   # one test by name
npm run build --workspace @underline/api      # tsup → single apps/api/dist/index.js (also how Docker builds)
npm run zip  --workspace @underline/extension # packaged extension
```

There is no lint step. `typecheck` (per-workspace `tsc --noEmit`) is the static gate.

## Architecture

npm-workspaces monorepo. Three packages; data flows extension → local API → upstream LLM.

- **`packages/shared`** — Zod schemas + inferred types. This is the **single source of truth for every wire contract.** It is consumed *from source* (its `exports` map points at `src/index.ts`), so editing a schema immediately re-types both other packages — no build step needed during dev. Change request/response shapes here, never ad hoc in a caller.
- **`apps/api`** — Fastify server (`buildServer` in [src/app.ts](apps/api/src/app.ts)) built by tsup into one bundled `dist/index.js`. Stateless except for one persisted file (provider config). Routes: `/health`, `/v1/explanations`, `/v1/articles/clean`, and `/v1/provider-config` (GET/PUT/`/test`).
- **`apps/extension`** — WXT + React MV3 extension. Entrypoints: `content` (the engine), `popup` + `options` (same `App.tsx`, `variant` prop), `article` (renders a cached clean body from `?key=`).

### The critical path (v1)

This is the only path that must always work: `open article → enable reader mode → highlight → generate bridge → regenerate/remove → refresh safely`.

1. The content script ([entrypoints/content.ts](apps/extension/src/entrypoints/content.ts)) runs on every http/https page at `document_idle`. `ReaderModeController` owns all in-page state and the floating control + inline bridge UI (rendered as DOM with `data-underline-*` attributes; highlights use the CSS Custom Highlight API, not wrapper spans).
2. Popup → content script messaging is typed in [lib/messages.ts](apps/extension/src/lib/messages.ts) (`MESSAGE_TYPES`). Enabling reader mode, requesting a clean article, and undo all flow through `chrome.runtime.onMessage`.
3. Highlight on `mouseup` → `captureHighlightsFromSelection` ([lib/anchors.ts](apps/extension/src/lib/anchors.ts)) produces a `HighlightRecord` with a durable anchor (paragraph index + DOM path + offsets + a `{exact, prefix, suffix}` quote).
4. Explain → `fetchExplanation` builds an `ExplanationRequest` and POSTs to the **local** API at `settings.apiBaseUrl` (default `http://localhost:8787`).
5. API validates with the shared schema, picks an LLM client, and returns an `ExplanationResponse`. The content script wraps it in a `BridgeRecord`, inserts the bridge after the anchor paragraph, and persists.

### Persistence & refresh-safety (a core invariant, not a feature)

All reader state lives in `chrome.storage.local`, keyed by **normalized URL** (hash stripped) — see [lib/storage.ts](apps/extension/src/lib/storage.ts): `PageSession` (highlights + bridges), profile, signals, and a clean-article cache keyed by `url + articleFingerprint`. Nothing holds live DOM references across reloads. On every render, highlights and bridges are **re-resolved from their anchors** against freshly scraped paragraphs (`getCandidateParagraphs` in [lib/page.ts](apps/extension/src/lib/page.ts), fixed selector, visible, ≥24 chars, excludes managed nodes). Resolution degrades gracefully: `findParagraphForAnchor` tries DOM path → index+quote → full quote scan; `locateQuoteInText` tries saved offsets → prefix/suffix scoring. A bridge whose anchor can't be found is marked `status: "anchor-missing"` and **kept**, never dropped. Touch anything in anchors/page/storage with this contract in mind.

### Two-stage clean-article context (ADR-0003)

When a real model is configured, bridge quality comes from sending the cleaned article body, not just nearby paragraphs:

1. `ensureCleanArticle` POSTs visible page text (capped 50k chars) to `/v1/articles/clean`; the upstream model strips page chrome and returns the article body, cached locally by `url + fingerprint`.
2. That body becomes the primary context for `/v1/explanations`; otherwise the request falls back to a `contextWindow` of paragraphs around the highlights (`buildContextWindow` in [lib/context.ts](apps/extension/src/lib/context.ts)).

If cleaning fails, the UI **must** downgrade to nearby-context mode (with a visible warning), never block reading. Mock/demo mode must **not** fabricate a clean body — `MockLLMClient.cleanArticle` throws, and `/v1/articles/clean` returns 409 when no real model is configured.

### LLM clients & provider config

`LLMClient` ([llm/client.ts](apps/api/src/llm/client.ts)) has two implementations selected by `buildClient` (injectable as `clientFactory` for tests): `OpenAICompatibleClient` when `apiKey` **and** `model` are set, else `MockLLMClient`. [llm/openai-compatible.ts](apps/api/src/llm/openai-compatible.ts) auto-negotiates Chat Completions vs. Responses APIs (`wireApi: auto` picks order by model name; `gpt-5*`/`codex` → Responses first), with fallback on protocol-mismatch errors and a second fallback that drops JSON mode.

**Provider config has two stores that must be kept in sync** — a common source of confusion:
- **Server runtime config** ([runtime-config.ts](apps/api/src/runtime-config.ts)) persisted to `.underline-runtime.json` (gitignored), seeded from env. This is what the API actually uses to call upstream. Mutated via `PUT /v1/provider-config`, which (like all provider-config routes) is restricted to privileged origins (`chrome-extension://`, `moz-extension://`, or no origin).
- **Extension settings** (`ExtensionSettings` in storage) hold a copy of the provider fields; the content script reads them to decide whether to *attempt* clean-article.

The popup's "save all settings" writes **both**: `saveSettings` to `chrome.storage` and a `PUT /v1/provider-config` to the server. When changing provider behavior, update both sides.

### Demo provenance (ADR-0002, hard guardrail)

When the upstream model is unconfigured or fails, the API falls back to `MockLLMClient` and the response carries `source: "mock"`, a short disclosure label (`AI demo` / `AI 演示`, vs `AI bridge` / `AI 桥接`), and a human-readable `fallbackReason`. The UI surfaces this — the user must always be able to tell a demo bridge from a real one. Bilingual logic (`isChineseRequest`) branches demo text and labels on page language.

### Testing

vitest. API tests use Fastify `app.inject` (no sockets) with an injected `RuntimeConfigStore` + `clientFactory` pointed at a throwaway runtime-config file; [test/explanation-quality.test.ts](apps/api/test/explanation-quality.test.ts) + `test/fixtures/` is a quality harness over mock output. Extension lib tests sit next to their source (`*.test.ts` for anchors, context, storage, sessions).

## Product guardrails

- The product is a **local-first self-use reading companion**, not a public platform.
- The primary user is a **non-technical reader** who needs bridge explanations, not definitions. Underline is not a glossary popover and not a full-article summarizer — infer the missing mental model and insert one compact bridge.
- The only critical v1 path is the one above; protect refresh-safety and demo provenance when changing it.

## Development workflow (Matt Pocock style)

1. Use `skills/grill-me` to align on the real user need.
2. Write or update the active PRD at `docs/prd/underline-self-use-v1.md`.
3. Break approved work into local issue files under `issues/`; work one AFK issue at a time; move finished ones to `issues/done/`.
4. Use `skills/tdd` for implementation.

## Required context

Read before changing product behavior: `CONTEXT.md` (product vocabulary), `docs/prd/underline-self-use-v1.md`, `docs/adr/` (esp. 0002 demo provenance, 0003 two-stage context), and the relevant `issues/` file.
