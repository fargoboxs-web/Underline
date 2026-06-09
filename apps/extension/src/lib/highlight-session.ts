import type { HighlightRecord } from "@underline/shared";

import type { PageSession } from "./storage";

export function getPendingHighlights(
  session: Pick<PageSession, "highlights">
): HighlightRecord[] {
  return session.highlights.filter(
    (highlight) => highlight.status === "active" && !highlight.consumedByBridgeId
  );
}

export function undoLatestPendingHighlights(
  session: Pick<PageSession, "highlights">,
  recentHighlightIds: string[] = []
): HighlightRecord[] {
  const pendingHighlights = getPendingHighlights(session);
  let targets = pendingHighlights.filter((highlight) =>
    recentHighlightIds.includes(highlight.id)
  );

  if (!targets.length) {
    const latest = [...pendingHighlights].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0];
    targets = latest ? [latest] : [];
  }

  const targetIds = new Set(targets.map((highlight) => highlight.id));
  session.highlights.forEach((highlight) => {
    if (targetIds.has(highlight.id)) {
      highlight.status = "removed";
    }
  });

  return targets;
}
