import type { HighlightAnchor, HighlightRecord } from "@underline/shared";

import type { ParagraphDescriptor } from "./page";
import { findElementByDomPath } from "./page";

function getOffsetWithinElement(
  element: HTMLElement,
  container: Node,
  offset: number
): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(container, offset);
  return range.toString().length;
}

export function isSelectionInsideManagedNode(selection: Selection): boolean {
  const nodes = [selection.anchorNode, selection.focusNode].filter(Boolean) as Node[];

  return nodes.some((node) => {
    const element = node instanceof Element ? node : node.parentElement;
    return Boolean(element?.closest("[data-underline-ui], [data-underline-bridge]"));
  });
}

export function captureHighlightsFromSelection(
  selection: Selection,
  paragraphs: ParagraphDescriptor[],
  pageUrl: string
): HighlightRecord[] {
  if (!selection.rangeCount) {
    return [];
  }

  const range = selection.getRangeAt(0);

  const highlights: HighlightRecord[] = [];

  for (const paragraph of paragraphs) {
    if (!range.intersectsNode(paragraph.element)) {
      continue;
    }

    const rawText = paragraph.rawText;
    const startsInside = paragraph.element.contains(range.startContainer);
    const endsInside = paragraph.element.contains(range.endContainer);
    const startOffset = startsInside
      ? getOffsetWithinElement(paragraph.element, range.startContainer, range.startOffset)
      : 0;
    const endOffset = endsInside
      ? getOffsetWithinElement(paragraph.element, range.endContainer, range.endOffset)
      : rawText.length;
    const exact = rawText.slice(startOffset, endOffset).trim();

    if (!exact) {
      continue;
    }

    highlights.push({
      id: crypto.randomUUID(),
      url: pageUrl,
      text: exact,
      createdAt: new Date().toISOString(),
      status: "active",
      anchor: {
        paragraphIndex: paragraph.index,
        domPath: paragraph.domPath,
        startOffset,
        endOffset,
        quote: {
          exact,
          prefix: rawText.slice(Math.max(0, startOffset - 32), startOffset),
          suffix: rawText.slice(endOffset, endOffset + 32)
        }
      }
    });
  }

  return highlights;
}

export function locateQuoteInText(
  rawText: string,
  anchor: HighlightAnchor
): { start: number; end: number } | null {
  const { exact, prefix, suffix } = anchor.quote;

  if (
    typeof anchor.startOffset === "number" &&
    typeof anchor.endOffset === "number" &&
    rawText.slice(anchor.startOffset, anchor.endOffset).trim() === exact
  ) {
    return {
      start: anchor.startOffset,
      end: anchor.endOffset
    };
  }

  const candidates: Array<{ start: number; end: number; score: number }> = [];
  let searchIndex = 0;

  while (searchIndex < rawText.length) {
    const start = rawText.indexOf(exact, searchIndex);

    if (start < 0) {
      break;
    }

    const end = start + exact.length;
    let score = 0;

    if (!prefix || rawText.slice(Math.max(0, start - prefix.length), start) === prefix) {
      score += 1;
    }

    if (!suffix || rawText.slice(end, end + suffix.length) === suffix) {
      score += 1;
    }

    candidates.push({ start, end, score });
    searchIndex = end;
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  return {
    start: candidates[0].start,
    end: candidates[0].end
  };
}

export function resolveOffsetsToRange(
  element: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startContainer: Node | null = null;
  let endContainer: Node | null = null;
  let startInnerOffset = 0;
  let endInnerOffset = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const nextOffset = currentOffset + textNode.data.length;

    if (!startContainer && startOffset <= nextOffset) {
      startContainer = textNode;
      startInnerOffset = Math.max(0, startOffset - currentOffset);
    }

    if (!endContainer && endOffset <= nextOffset) {
      endContainer = textNode;
      endInnerOffset = Math.max(0, endOffset - currentOffset);
      break;
    }

    currentOffset = nextOffset;
  }

  if (!startContainer || !endContainer) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startContainer, startInnerOffset);
  range.setEnd(endContainer, endInnerOffset);
  return range;
}

export function findParagraphForAnchor(
  anchor: HighlightAnchor,
  paragraphs: ParagraphDescriptor[]
): ParagraphDescriptor | null {
  const fromPath = findElementByDomPath(anchor.domPath);

  if (fromPath) {
    const matching = paragraphs.find((paragraph) => paragraph.element === fromPath);

    if (matching) {
      return matching;
    }
  }

  const byIndex = paragraphs[anchor.paragraphIndex];

  if (byIndex?.rawText.includes(anchor.quote.exact)) {
    return byIndex;
  }

  return (
    paragraphs.find((paragraph) => paragraph.rawText.includes(anchor.quote.exact)) ?? null
  );
}

export function buildRangeForAnchor(
  anchor: HighlightAnchor,
  paragraphs: ParagraphDescriptor[]
): Range | null {
  const paragraph = findParagraphForAnchor(anchor, paragraphs);

  if (!paragraph) {
    return null;
  }

  const offsets = locateQuoteInText(paragraph.rawText, anchor);

  if (!offsets) {
    return null;
  }

  return resolveOffsetsToRange(paragraph.element, offsets.start, offsets.end);
}
