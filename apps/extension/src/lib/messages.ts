export const MESSAGE_TYPES = {
  getPageState: "underline:get-page-state",
  setReaderMode: "underline:set-reader-mode"
} as const;

export type ContentRequest =
  | {
      type: typeof MESSAGE_TYPES.getPageState;
    }
  | {
      type: typeof MESSAGE_TYPES.setReaderMode;
      enabled: boolean;
    };

export interface PageStateResponse {
  supported: boolean;
  url: string;
  readerModeEnabled: boolean;
  pendingHighlights: number;
  bridgeCount: number;
}
