import { describe, expect, test } from "vitest";

import type { ExplanationResponse, HighlightRecord } from "@underline/shared";

import {
  attachBridgeToSession,
  getLatestActiveBridge,
  removeBridgeFromSession,
  updateBridgeFromResponse
} from "./bridge-session";
import { createEmptyPageSession } from "./storage";

function createHighlight(id: string): HighlightRecord {
  return {
    id,
    url: "https://example.com/article",
    text: `Highlight ${id}`,
    createdAt: "2026-05-03T00:00:00.000Z",
    status: "active",
    anchor: {
      paragraphIndex: 1,
      domPath: "body/article[1]/p[2]",
      startOffset: 0,
      endOffset: 10,
      quote: {
        exact: `Highlight ${id}`,
        prefix: "",
        suffix: ""
      }
    }
  };
}

function createResponse(overrides: Partial<ExplanationResponse> = {}): ExplanationResponse {
  return {
    bridgeId: "bridge-1",
    insertAfterAnchor: {
      paragraphIndex: 1,
      domPath: "body/article[1]/p[2]",
      startOffset: 0,
      endOffset: 10,
      quote: {
        exact: "Highlight",
        prefix: "",
        suffix: ""
      }
    },
    bridgeText: "A bridge paragraph that explains the missing systems frame behind the highlight.",
    disclosureLabel: "AI demo",
    inferredGapTags: ["systems-thinking"],
    source: "mock",
    contextSource: "nearby-context",
    fallbackReason: "No real model is configured, so the local demo explanation is being used.",
    ...overrides
  };
}

describe("bridge session helpers", () => {
  test("attaches a bridge and consumes the related highlights", () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    const highlights = [createHighlight("h1"), createHighlight("h2")];
    session.highlights.push(...highlights);

    const bridge = attachBridgeToSession(
      session,
      "https://example.com/article",
      highlights,
      createResponse()
    );

    expect(session.bridges).toHaveLength(1);
    expect(bridge.fallbackReason).toContain("local demo");
    expect(highlights.every((highlight) => highlight.consumedByBridgeId === bridge.id)).toBe(true);
    expect(getLatestActiveBridge(session)?.id).toBe(bridge.id);
  });

  test("updates bridge content and provenance on regenerate", () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    const highlights = [createHighlight("h1")];
    session.highlights.push(...highlights);
    attachBridgeToSession(
      session,
      "https://example.com/article",
      highlights,
      createResponse()
    );

    const updated = updateBridgeFromResponse(
      session,
      "bridge-1",
      createResponse({
        bridgeText: "An updated bridge that still explains the broader workflow.",
        disclosureLabel: "AI bridge",
        source: "ai",
        fallbackReason: undefined
      })
    );

    expect(updated?.bridgeText).toContain("updated bridge");
    expect(updated?.source).toBe("ai");
    expect(updated?.disclosureLabel).toBe("AI bridge");
    expect(updated?.fallbackReason).toBeUndefined();
  });

  test("marks a bridge removed without deleting history", () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    const highlights = [createHighlight("h1")];
    session.highlights.push(...highlights);
    attachBridgeToSession(
      session,
      "https://example.com/article",
      highlights,
      createResponse()
    );

    const removed = removeBridgeFromSession(session, "bridge-1");

    expect(removed?.status).toBe("removed");
    expect(getLatestActiveBridge(session)).toBeUndefined();
    expect(session.bridges).toHaveLength(1);
  });
});
