import { beforeEach, describe, expect, test } from "vitest";

import type { ExplanationResponse, HighlightRecord } from "@underline/shared";

import { attachBridgeToSession } from "./bridge-session";
import {
  cleanArticleKey,
  createEmptyPageSession,
  getCleanArticleByStorageKey,
  getCleanArticleCache,
  getPageSession,
  saveCleanArticleCache,
  savePageSession
} from "./storage";

const backingStore = new Map<string, unknown>();

beforeEach(() => {
  backingStore.clear();

  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get(key: string, callback: (value: Record<string, unknown>) => void) {
          callback({ [key]: backingStore.get(key) });
        },
        set(value: Record<string, unknown>, callback: () => void) {
          Object.entries(value).forEach(([key, entry]) => {
            backingStore.set(key, entry);
          });
          callback();
        }
      }
    }
  };
});

function createHighlight(id: string): HighlightRecord {
  return {
    id,
    url: "https://example.com/article",
    text: "Webhook",
    createdAt: "2026-05-03T00:00:00.000Z",
    status: "active",
    anchor: {
      paragraphIndex: 1,
      domPath: "body/article[1]/p[2]",
      startOffset: 0,
      endOffset: 7,
      quote: {
        exact: "Webhook",
        prefix: "",
        suffix: ""
      }
    }
  };
}

function createResponse(): ExplanationResponse {
  return {
    bridgeId: "bridge-1",
    insertAfterAnchor: {
      paragraphIndex: 1,
      domPath: "body/article[1]/p[2]",
      startOffset: 0,
      endOffset: 7,
      quote: {
        exact: "Webhook",
        prefix: "",
        suffix: ""
      }
    },
    bridgeText: "A bridge paragraph that explains the broader workflow behind the highlighted term.",
    disclosureLabel: "AI demo",
    inferredGapTags: ["request-response"],
    source: "mock",
    contextSource: "nearby-context",
    fallbackReason: "No real model is configured, so the local demo explanation is being used."
  };
}

describe("page session persistence", () => {
  test("round-trips bridge provenance through local storage", async () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    const highlight = createHighlight("h1");
    session.highlights.push(highlight);
    attachBridgeToSession(
      session,
      "https://example.com/article",
      [highlight],
      createResponse()
    );

    await savePageSession(session);
    const loaded = await getPageSession("https://example.com/article");

    expect(loaded?.bridges).toHaveLength(1);
    expect(loaded?.bridges[0].source).toBe("mock");
    expect(loaded?.bridges[0].disclosureLabel).toBe("AI demo");
    expect(loaded?.bridges[0].fallbackReason).toContain("local demo");
    expect(loaded?.highlights[0].consumedByBridgeId).toBe("bridge-1");
  });

  test("round-trips clean article cache by URL and fingerprint", async () => {
    const storageKey = await saveCleanArticleCache({
      normalizedUrl: "https://example.com/article",
      url: "https://example.com/article",
      title: "Example Article",
      articleFingerprint: "fingerprint-1",
      rawTextFingerprint: "raw-fingerprint-1",
      cleanedText: "A clean article body that can be opened from a dedicated tab.",
      cleanedAt: "2026-05-03T00:00:00.000Z",
      truncated: false
    });

    expect(storageKey).toBe(
      cleanArticleKey("https://example.com/article", "fingerprint-1")
    );

    const byUrl = await getCleanArticleCache(
      "https://example.com/article",
      "fingerprint-1"
    );
    const byKey = await getCleanArticleByStorageKey(storageKey);

    expect(byUrl?.cleanedText).toContain("clean article body");
    expect(byKey?.rawTextFingerprint).toBe("raw-fingerprint-1");
  });
});
