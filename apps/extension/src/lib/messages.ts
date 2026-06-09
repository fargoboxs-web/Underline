export const MESSAGE_TYPES = {
  getPageState: "underline:get-page-state",
  setReaderMode: "underline:set-reader-mode",
  cleanArticle: "underline:clean-article",
  undoLastHighlight: "underline:undo-last-highlight"
} as const;

export type ContentRequest =
  | {
      type: typeof MESSAGE_TYPES.getPageState;
    }
  | {
      type: typeof MESSAGE_TYPES.setReaderMode;
      enabled: boolean;
    }
  | {
      type: typeof MESSAGE_TYPES.cleanArticle;
    }
  | {
      type: typeof MESSAGE_TYPES.undoLastHighlight;
    };

export interface PageStateResponse {
  supported: boolean;
  url: string;
  readerModeEnabled: boolean;
  pendingHighlights: number;
  canUndoHighlight: boolean;
  bridgeCount: number;
  lastBridgeLabel: string | null;
  lastBridgeSource: "ai" | "mock" | null;
  lastFallbackReason: string | null;
}

export interface CleanArticlePageResponse {
  supported: boolean;
  url: string;
  status: "ready" | "failed";
  cacheKey: string | null;
  error: string | null;
}
