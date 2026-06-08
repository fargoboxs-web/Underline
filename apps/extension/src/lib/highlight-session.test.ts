import { describe, expect, test } from "vitest";

import type { HighlightRecord } from "@underline/shared";

import { createEmptyPageSession } from "./storage";
import { getPendingHighlights, undoLatestPendingHighlights } from "./highlight-session";

function createHighlight(
  id: string,
  createdAt: string,
  consumedByBridgeId?: string
): HighlightRecord {
  return {
    id,
    url: "https://example.com/article",
    text: `Highlight ${id}`,
    createdAt,
    status: "active",
    consumedByBridgeId,
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

describe("highlight session helpers", () => {
  test("undoes the recent pending highlight batch first", () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    session.highlights.push(
      createHighlight("h1", "2026-05-03T00:00:00.000Z"),
      createHighlight("h2", "2026-05-03T00:00:01.000Z"),
      createHighlight("h3", "2026-05-03T00:00:02.000Z", "bridge-1")
    );

    const undone = undoLatestPendingHighlights(session, ["h1", "h2"]);

    expect(undone.map((highlight) => highlight.id)).toEqual(["h1", "h2"]);
    expect(getPendingHighlights(session).map((highlight) => highlight.id)).toEqual([]);
    expect(session.highlights.find((highlight) => highlight.id === "h3")?.status).toBe("active");
  });

  test("falls back to the newest pending highlight when no recent batch exists", () => {
    const session = createEmptyPageSession(
      "https://example.com/article",
      "https://example.com/article",
      "fingerprint-1"
    );
    session.highlights.push(
      createHighlight("h1", "2026-05-03T00:00:00.000Z"),
      createHighlight("h2", "2026-05-03T00:00:01.000Z")
    );

    const undone = undoLatestPendingHighlights(session);

    expect(undone.map((highlight) => highlight.id)).toEqual(["h2"]);
    expect(getPendingHighlights(session).map((highlight) => highlight.id)).toEqual(["h1"]);
  });
});
