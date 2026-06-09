import type { BridgeRecord, ExplanationResponse, HighlightRecord } from "@underline/shared";

import type { PageSession } from "./storage";

export function createBridgeRecord(
  normalizedUrl: string,
  highlights: HighlightRecord[],
  response: ExplanationResponse
): BridgeRecord {
  return {
    id: response.bridgeId,
    url: normalizedUrl,
    highlightIds: highlights.map((highlight) => highlight.id),
    insertAfterAnchor: response.insertAfterAnchor,
    bridgeText: response.bridgeText,
    disclosureLabel: response.disclosureLabel,
    inferredGapTags: response.inferredGapTags,
    createdAt: new Date().toISOString(),
    status: "active",
    source: response.source,
    contextSource: response.contextSource,
    contextWarning: response.contextWarning,
    fallbackReason: response.fallbackReason
  };
}

export function attachBridgeToSession(
  session: PageSession,
  normalizedUrl: string,
  highlights: HighlightRecord[],
  response: ExplanationResponse
): BridgeRecord {
  const bridge = createBridgeRecord(normalizedUrl, highlights, response);
  session.bridges.push(bridge);

  highlights.forEach((highlight) => {
    highlight.consumedByBridgeId = bridge.id;
  });

  return bridge;
}

export function updateBridgeFromResponse(
  session: PageSession,
  bridgeId: string,
  response: ExplanationResponse
): BridgeRecord | undefined {
  const bridge = session.bridges.find((item) => item.id === bridgeId);

  if (!bridge) {
    return undefined;
  }

  bridge.bridgeText = response.bridgeText;
  bridge.disclosureLabel = response.disclosureLabel;
  bridge.inferredGapTags = response.inferredGapTags;
  bridge.status = "active";
  bridge.source = response.source;
  bridge.contextSource = response.contextSource;
  bridge.contextWarning = response.contextWarning;
  bridge.fallbackReason = response.fallbackReason;

  return bridge;
}

export function removeBridgeFromSession(
  session: PageSession,
  bridgeId: string
): BridgeRecord | undefined {
  const bridge = session.bridges.find((item) => item.id === bridgeId);

  if (!bridge) {
    return undefined;
  }

  bridge.status = "removed";
  return bridge;
}

export function getLatestActiveBridge(
  session: Pick<PageSession, "bridges">
): BridgeRecord | undefined {
  return [...session.bridges].reverse().find((bridge) => bridge.status === "active");
}
