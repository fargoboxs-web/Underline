import type { BridgeRecord, ContextWindow, HighlightRecord, ProfileSignal } from "@underline/shared";

import type { ParagraphDescriptor } from "./page";

function compactSummary(texts: string[]): string {
  return texts.join("; ").slice(0, 180);
}

export function buildContextWindow(
  paragraphs: ParagraphDescriptor[],
  highlights: HighlightRecord[]
): ContextWindow {
  const paragraphIndexes = highlights.map((highlight) => highlight.anchor.paragraphIndex);
  const startIndex = Math.max(0, Math.min(...paragraphIndexes) - 1);
  const endIndex = Math.min(
    paragraphs.length - 1,
    Math.max(...paragraphIndexes) + 1
  );

  return {
    paragraphs: paragraphs.slice(startIndex, endIndex + 1).map((paragraph) => ({
      index: paragraph.index,
      text: paragraph.text,
      domPath: paragraph.domPath
    })),
    startIndex,
    endIndex,
    lastHighlightParagraphIndex: Math.max(...paragraphIndexes)
  };
}

export function buildBridgeSignal(
  bridge: BridgeRecord,
  highlights: HighlightRecord[],
  type: ProfileSignal["type"]
): ProfileSignal {
  return {
    id: crypto.randomUUID(),
    type,
    summary: compactSummary(highlights.map((highlight) => highlight.text)),
    weight:
      type === "bridge-generated" ? 0.9 : type === "bridge-regenerated" ? 0.75 : 0.4,
    inferredTags: bridge.inferredGapTags,
    createdAt: new Date().toISOString()
  };
}
