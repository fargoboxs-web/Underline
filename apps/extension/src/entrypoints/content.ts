import {
  CleanArticleResponseSchema,
  ExplanationResponseSchema,
  type CleanArticleContext,
  type BridgeRecord,
  type ExplanationRequest,
  type ExplanationResponse,
  type HighlightRecord,
  type ProfileSignal
} from "@underline/shared";
import { defineContentScript } from "#imports";

import {
  buildRangeForAnchor,
  captureHighlightsFromSelection,
  findParagraphForAnchor,
  isSelectionInsideManagedNode
} from "../lib/anchors";
import {
  attachBridgeToSession,
  getLatestActiveBridge,
  removeBridgeFromSession,
  updateBridgeFromResponse
} from "../lib/bridge-session";
import { buildBridgeSignal, buildContextWindow } from "../lib/context";
import { getPendingHighlights, undoLatestPendingHighlights } from "../lib/highlight-session";
import {
  MESSAGE_TYPES,
  type CleanArticlePageResponse,
  type ContentRequest,
  type PageStateResponse
} from "../lib/messages";
import {
  applyBridgePresentationTemplate,
  buildBridgePresentationTemplate,
  buildPagePayload,
  captureVisiblePageText,
  computeArticleFingerprint,
  getCandidateParagraphs,
  normalizeUrl,
  type ParagraphDescriptor
} from "../lib/page";
import {
  appendSignals,
  type CleanArticleCacheRecord,
  createEmptyPageSession,
  getCleanArticleCache,
  getPageSession,
  getProfile,
  getSettings,
  getSignals,
  saveCleanArticleCache,
  savePageSession,
  type PageSession
} from "../lib/storage";

const HIGHLIGHT_NAME = "underline-highlight";
const UI_ATTRIBUTE = "data-underline-ui";
const BRIDGE_ATTRIBUTE = "data-underline-bridge";

type HighlightRegistryLike = {
  delete(name: string): void;
  set(name: string, highlight: unknown): void;
};

const CONTENT_STYLE = `
  :root {
    --underline-highlight-bg: rgba(243, 184, 87, 0.42);
    --underline-ui-bg: rgba(21, 27, 22, 0.92);
    --underline-ui-accent: rgba(233, 151, 90, 1);
    --underline-ui-muted: rgba(245, 236, 222, 0.78);
  }

  ::highlight(${HIGHLIGHT_NAME}) {
    background: var(--underline-highlight-bg);
    color: inherit;
  }

  [${UI_ATTRIBUTE}="floating"] {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483646;
    width: 240px;
    border-radius: 18px;
    background:
      radial-gradient(circle at top right, rgba(233, 151, 90, 0.24), transparent 34%),
      var(--underline-ui-bg);
    color: white;
    padding: 14px;
    box-shadow: 0 16px 38px rgba(0, 0, 0, 0.18);
    font-family: "SF Pro Text", "PingFang SC", sans-serif;
  }

  [${UI_ATTRIBUTE}="floating"] button {
    width: 100%;
    margin-top: 12px;
    border: none;
    border-radius: 999px;
    background: var(--underline-ui-accent);
    color: #1e1a15;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 14px;
    cursor: pointer;
  }

  [${UI_ATTRIBUTE}="floating"] button[disabled] {
    opacity: 0.6;
    cursor: progress;
  }

  [${BRIDGE_ATTRIBUTE}="root"] {
    position: relative;
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    isolation: isolate;
  }

  [${BRIDGE_ATTRIBUTE}="text"] {
    color: inherit;
  }

  [${BRIDGE_ATTRIBUTE}="controls"] {
    position: absolute;
    top: 0;
    right: 0;
    transform: translateY(-72%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 999px;
    opacity: 0;
    pointer-events: none;
    z-index: 2;
    white-space: nowrap;
    transition: opacity 120ms ease;
    background: color-mix(in srgb, currentColor 8%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    backdrop-filter: blur(8px);
  }

  [${BRIDGE_ATTRIBUTE}="root"]:hover [${BRIDGE_ATTRIBUTE}="controls"],
  [${BRIDGE_ATTRIBUTE}="root"]:focus-within [${BRIDGE_ATTRIBUTE}="controls"] {
    opacity: 1;
    pointer-events: auto;
  }

  [${BRIDGE_ATTRIBUTE}="pill"] {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.18em 0.55em;
    letter-spacing: 0.02em;
    font-size: 0.7em;
    line-height: 1;
    opacity: 0.74;
  }

  [${BRIDGE_ATTRIBUTE}="actions"] {
    display: inline-flex;
    gap: 6px;
  }

  [${BRIDGE_ATTRIBUTE}="actions"] button {
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.78;
    font: inherit;
    font-size: 0.72em;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }

  [${BRIDGE_ATTRIBUTE}="reason"] {
    max-width: 260px;
    font-size: 0.68em;
    line-height: 1.35;
    opacity: 0.78;
  }
`;

class ReaderModeController {
  private normalizedUrl = normalizeUrl(location.href);

  private paragraphs: ParagraphDescriptor[] = [];

  private pageSession: PageSession | null = null;

  private floatingRoot: HTMLDivElement | null = null;

  private statusLabel: HTMLDivElement | null = null;

  private actionButton: HTMLButtonElement | null = null;

  private undoButton: HTMLButtonElement | null = null;

  private recentHighlightBatchIds: string[] = [];

  private explaining = false;

  async init(): Promise<void> {
    this.injectStyles();
    this.refreshParagraphs();

    const fingerprint = computeArticleFingerprint(this.paragraphs);
    this.pageSession =
      (await getPageSession(this.normalizedUrl)) ??
      createEmptyPageSession(this.normalizedUrl, this.normalizedUrl, fingerprint);

    this.pageSession.articleFingerprint = fingerprint;
    await savePageSession(this.pageSession);

    this.renderFloatingRoot();
    await this.restoreSession();
    this.attachListeners();
  }

  private injectStyles(): void {
    if (document.getElementById("underline-content-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "underline-content-style";
    style.textContent = CONTENT_STYLE;
    document.documentElement.append(style);
  }

  private refreshParagraphs(): void {
    this.paragraphs = getCandidateParagraphs();
  }

  private attachListeners(): void {
    window.addEventListener("mouseup", () => {
      void this.handleMouseUp();
    });

    chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
      void this.handleMessage(message).then(sendResponse);
      return true;
    });
  }

  private async handleMessage(
    message: ContentRequest
  ): Promise<PageStateResponse | CleanArticlePageResponse> {
    if (!this.pageSession) {
      throw new Error("Page session missing.");
    }

    if (message.type === MESSAGE_TYPES.setReaderMode) {
      this.pageSession.readerModeEnabled = message.enabled;
      await savePageSession(this.pageSession);
      this.updateFloatingState(
        message.enabled ? "导师模式已开启，可以直接划词。" : "导师模式已关闭。"
      );
    }

    if (message.type === MESSAGE_TYPES.cleanArticle) {
      return this.handleCleanArticleRequest();
    }

    if (message.type === MESSAGE_TYPES.undoLastHighlight) {
      await this.undoLastHighlight();
    }

    return this.buildPageState();
  }

  private buildPageState(): PageStateResponse {
    const pendingHighlights = this.pageSession ? getPendingHighlights(this.pageSession).length : 0;
    const bridgeCount =
      this.pageSession?.bridges.filter((bridge) => bridge.status === "active").length ?? 0;
    const latestBridge = this.pageSession ? getLatestActiveBridge(this.pageSession) : undefined;

    return {
      supported: true,
      url: this.normalizedUrl,
      readerModeEnabled: this.pageSession?.readerModeEnabled ?? false,
      pendingHighlights,
      canUndoHighlight: pendingHighlights > 0,
      bridgeCount,
      lastBridgeLabel: latestBridge?.disclosureLabel ?? null,
      lastBridgeSource: latestBridge?.source ?? null,
      lastFallbackReason: latestBridge?.fallbackReason ?? null
    };
  }

  private buildBridgeStatusMessage(bridge: {
    disclosureLabel: string;
    contextWarning?: string;
    fallbackReason?: string;
  }): string {
    const suffix = bridge.contextWarning ? ` ${bridge.contextWarning}` : "";

    if (bridge.fallbackReason) {
      return `已插入 ${bridge.disclosureLabel}：${bridge.fallbackReason}${suffix}`;
    }

    return `已插入 ${bridge.disclosureLabel}。${suffix}`;
  }

  private renderFloatingRoot(): void {
    if (this.floatingRoot) {
      return;
    }

    const root = document.createElement("div");
    root.setAttribute(UI_ATTRIBUTE, "floating");

    const label = document.createElement("div");
    label.textContent = "阅读导师";
    label.style.fontSize = "15px";
    label.style.fontWeight = "700";

    const subtitle = document.createElement("div");
    subtitle.style.marginTop = "6px";
    subtitle.style.fontSize = "12px";
    subtitle.style.lineHeight = "1.5";
    subtitle.style.color = "var(--underline-ui-muted)";

    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      void this.handleExplainClick();
    });

    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "撤销上次标注";
    undoButton.addEventListener("click", () => {
      void this.undoLastHighlight();
    });

    root.append(label, subtitle, button, undoButton);
    document.body.append(root);

    this.floatingRoot = root;
    this.statusLabel = subtitle;
    this.actionButton = button;
    this.undoButton = undoButton;
    this.updateFloatingState("先从插件里开启导师模式。");
  }

  private updateFloatingState(status: string): void {
    if (
      !this.statusLabel ||
      !this.actionButton ||
      !this.undoButton ||
      !this.floatingRoot ||
      !this.pageSession
    ) {
      return;
    }

    const pendingHighlights = getPendingHighlights(this.pageSession).length;

    this.floatingRoot.style.display =
      this.pageSession.readerModeEnabled || this.pageSession.bridges.length ? "block" : "none";
    this.statusLabel.textContent = status;
    this.actionButton.disabled = this.explaining;
    this.undoButton.disabled = this.explaining || pendingHighlights === 0;
    this.undoButton.style.display =
      this.pageSession.readerModeEnabled && pendingHighlights > 0 ? "block" : "none";

    if (!this.pageSession.readerModeEnabled) {
      this.actionButton.textContent = "等待开启";
      return;
    }

    this.actionButton.textContent =
      pendingHighlights > 0 ? `解释这 ${pendingHighlights} 处标注` : "先划出不懂的片段";
  }

  private async handleMouseUp(): Promise<void> {
    if (!this.pageSession?.readerModeEnabled) {
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || isSelectionInsideManagedNode(selection)) {
      return;
    }

    this.refreshParagraphs();
    const captured = captureHighlightsFromSelection(selection, this.paragraphs, this.normalizedUrl);
    const deduped = captured.filter((candidate) => !this.isDuplicateHighlight(candidate));

    if (!deduped.length || !this.pageSession) {
      selection.removeAllRanges();
      return;
    }

    this.pageSession.highlights.push(...deduped);
    this.recentHighlightBatchIds = deduped.map((highlight) => highlight.id);
    await savePageSession(this.pageSession);
    selection.removeAllRanges();
    this.renderHighlights();
    this.updateFloatingState(`已记录 ${deduped.length} 处新标注。`);
  }

  private async undoLastHighlight(): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    const targets = undoLatestPendingHighlights(
      this.pageSession,
      this.recentHighlightBatchIds
    );

    if (!targets.length) {
      this.updateFloatingState("没有可以撤销的待解释标注。");
      return;
    }

    const targetIds = new Set(targets.map((highlight) => highlight.id));
    this.recentHighlightBatchIds = this.recentHighlightBatchIds.filter(
      (id) => !targetIds.has(id)
    );

    await savePageSession(this.pageSession);
    this.renderHighlights();
    this.updateFloatingState(`已撤销 ${targets.length} 处标注。`);
  }

  private isDuplicateHighlight(candidate: HighlightRecord): boolean {
    return Boolean(
      this.pageSession?.highlights.find(
        (highlight) =>
          highlight.status === "active" &&
          highlight.anchor.paragraphIndex === candidate.anchor.paragraphIndex &&
          highlight.anchor.quote.exact === candidate.anchor.quote.exact &&
          highlight.anchor.startOffset === candidate.anchor.startOffset &&
          highlight.anchor.endOffset === candidate.anchor.endOffset
      )
    );
  }

  private async restoreSession(): Promise<void> {
    this.refreshParagraphs();
    this.renderHighlights();
    await this.renderBridges();
    this.updateFloatingState(
      this.pageSession?.readerModeEnabled
        ? "划出一两个难点后，点按钮让 AI 插入桥接段。"
        : "先从插件里开启导师模式。"
    );
  }

  private renderHighlights(): void {
    const highlightRegistry = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights;
    const HighlightConstructor = (
      window as Window & { Highlight?: new (...ranges: Range[]) => unknown }
    ).Highlight;

    if (!highlightRegistry || !HighlightConstructor || !this.pageSession) {
      return;
    }

    this.refreshParagraphs();
    const ranges = this.pageSession.highlights
      .filter((highlight) => highlight.status === "active")
      .map((highlight) => buildRangeForAnchor(highlight.anchor, this.paragraphs))
      .filter((range): range is Range => Boolean(range));

    if (!ranges.length) {
      highlightRegistry.delete(HIGHLIGHT_NAME);
      return;
    }

    highlightRegistry.set(HIGHLIGHT_NAME, new HighlightConstructor(...ranges));
  }

  private async renderBridges(): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    document.querySelectorAll(`[${BRIDGE_ATTRIBUTE}="root"]`).forEach((node) => node.remove());
    this.refreshParagraphs();

    const insertedAfter = new Map<HTMLElement, HTMLElement>();
    let dirty = false;

    for (const bridge of this.pageSession.bridges.filter((item) => item.status !== "removed")) {
      const paragraph = findParagraphForAnchor(bridge.insertAfterAnchor, this.paragraphs);

      if (!paragraph) {
        if (bridge.status !== "anchor-missing") {
          bridge.status = "anchor-missing";
          dirty = true;
        }
        continue;
      }

      bridge.status = "active";
      const bridgeElement = this.createBridgeElement(bridge, paragraph);
      const previous = insertedAfter.get(paragraph.element) ?? paragraph.element;
      previous.after(bridgeElement);
      insertedAfter.set(paragraph.element, bridgeElement);
    }

    if (dirty) {
      await savePageSession(this.pageSession);
    }
  }

  private createBridgeElement(
    bridge: BridgeRecord,
    sourceParagraph: ParagraphDescriptor
  ): HTMLElement {
    const template = buildBridgePresentationTemplate(sourceParagraph);
    const root = document.createElement(template.tagName);
    root.setAttribute(BRIDGE_ATTRIBUTE, "root");
    root.dataset.bridgeId = bridge.id;
    applyBridgePresentationTemplate(root, template);
    root.style.position = "relative";

    const text = document.createElement("span");
    text.setAttribute(BRIDGE_ATTRIBUTE, "text");
    text.textContent = bridge.bridgeText;

    const controls = document.createElement("span");
    controls.setAttribute(BRIDGE_ATTRIBUTE, "controls");
    controls.setAttribute("aria-label", `${bridge.disclosureLabel} 操作`);

    const pill = document.createElement("span");
    pill.setAttribute(BRIDGE_ATTRIBUTE, "pill");
    pill.textContent = bridge.disclosureLabel;
    if (bridge.fallbackReason) {
      pill.title = bridge.fallbackReason;
    }

    const reason = document.createElement("span");
    reason.setAttribute(BRIDGE_ATTRIBUTE, "reason");
    reason.textContent = bridge.fallbackReason ?? "";

    const actions = document.createElement("span");
    actions.setAttribute(BRIDGE_ATTRIBUTE, "actions");

    const regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.textContent = "重生成";
    regenerateButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.regenerateBridge(bridge.id);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "删除";
    removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.removeBridge(bridge.id);
    });

    actions.append(regenerateButton, removeButton);
    controls.append(pill);
    if (bridge.fallbackReason) {
      controls.append(reason);
    }
    controls.append(actions);
    root.append(text, controls);
    return root;
  }

  private async handleExplainClick(): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    const pendingHighlights = getPendingHighlights(this.pageSession);

    if (!pendingHighlights.length) {
      this.updateFloatingState("先划出你不懂的词句，再点击解释。");
      return;
    }

    await this.generateBridge(pendingHighlights, "bridge-generated");
  }

  private async handleCleanArticleRequest(): Promise<CleanArticlePageResponse> {
    try {
      const settings = await getSettings();
      this.updateFloatingState("正在清洗正文…");
      const { cacheKey } = await this.ensureCleanArticle(settings);
      this.updateFloatingState("纯净正文已准备好。");

      return {
        supported: true,
        url: this.normalizedUrl,
        status: "ready",
        cacheKey,
        error: null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "正文清洗失败。";
      this.updateFloatingState(`正文清洗失败：${message}`);

      return {
        supported: true,
        url: this.normalizedUrl,
        status: "failed",
        cacheKey: null,
        error: message
      };
    }
  }

  private async regenerateBridge(bridgeId: string): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    const bridge = this.pageSession.bridges.find((item) => item.id === bridgeId);

    if (!bridge) {
      return;
    }

    const highlights = this.pageSession.highlights.filter((highlight) =>
      bridge.highlightIds.includes(highlight.id)
    );

    const response = await this.fetchExplanation(highlights);

    if (!response) {
      return;
    }

    const updatedBridge = updateBridgeFromResponse(this.pageSession, bridge.id, response);

    if (!updatedBridge) {
      return;
    }

    await appendSignals([buildBridgeSignal(updatedBridge, highlights, "bridge-regenerated")]);
    await savePageSession(this.pageSession);
    await this.renderBridges();
    this.updateFloatingState(this.buildBridgeStatusMessage(updatedBridge));
  }

  private async removeBridge(bridgeId: string): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    const bridge = this.pageSession.bridges.find((item) => item.id === bridgeId);

    if (!bridge) {
      return;
    }

    const removedBridge = removeBridgeFromSession(this.pageSession, bridge.id);

    if (!removedBridge) {
      return;
    }
    const relatedHighlights = this.pageSession.highlights.filter((highlight) =>
      bridge.highlightIds.includes(highlight.id)
    );

    await appendSignals([buildBridgeSignal(removedBridge, relatedHighlights, "bridge-removed")]);
    await savePageSession(this.pageSession);
    await this.renderBridges();
    this.updateFloatingState("已删除这段 AI 桥接内容。");
  }

  private async generateBridge(
    highlights: HighlightRecord[],
    signalType: ProfileSignal["type"]
  ): Promise<void> {
    if (!this.pageSession) {
      return;
    }

    const response = await this.fetchExplanation(highlights);

    if (!response) {
      return;
    }

    const bridge = attachBridgeToSession(
      this.pageSession,
      this.normalizedUrl,
      highlights,
      response
    );

    await appendSignals([buildBridgeSignal(bridge, highlights, signalType)]);
    await savePageSession(this.pageSession);
    this.renderHighlights();
    await this.renderBridges();
    this.updateFloatingState(this.buildBridgeStatusMessage(bridge));
  }

  private async fetchExplanation(
    highlights: HighlightRecord[]
  ): Promise<ExplanationResponse | null> {
    this.explaining = true;
    this.updateFloatingState("正在准备文章上下文…");

    try {
      this.refreshParagraphs();
      const [settings, profile, priorGapSignals] = await Promise.all([
        getSettings(),
        getProfile(),
        getSignals()
      ]);

      let cleanArticle: CleanArticleContext | undefined;
      let contextWarning: string | undefined;

      if (settings.providerApiKey && settings.providerModel) {
        try {
          const cleanResult = await this.ensureCleanArticle(settings);
          const cleanedText = cleanResult.record.cleanedText;
          const highlightMatched = highlights.every((highlight) =>
            cleanedText.includes(highlight.text.trim())
          );
          cleanArticle = {
            articleFingerprint: cleanResult.record.articleFingerprint,
            cleanedText,
            cleanedAt: cleanResult.record.cleanedAt,
            highlightMatched
          };

          if (!highlightMatched) {
            contextWarning = "划线词未在纯净正文中匹配，仍使用全文生成。";
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "正文清洗失败";
          contextWarning = `正文清洗失败，已降级到邻近段落模式：${message}`;
          this.updateFloatingState(contextWarning);
        }
      }

      this.updateFloatingState("AI 正在推断你缺的背景知识…");

      const requestPayload: ExplanationRequest = {
        page: buildPagePayload(
          this.normalizedUrl,
          computeArticleFingerprint(this.paragraphs)
        ),
        profile,
        newHighlights: highlights,
        contextWindow: buildContextWindow(this.paragraphs, highlights),
        cleanArticle,
        priorGapSignals
      };

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), settings.requestTimeoutMs);
      const response = await fetch(
        `${settings.apiBaseUrl.replace(/\/$/, "")}/v1/explanations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        }
      );
      window.clearTimeout(timeout);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          details?: unknown;
        };
        throw new Error(
          payload.error ??
            payload.message ??
            `API returned ${response.status}`
        );
      }

      const parsed = ExplanationResponseSchema.parse(await response.json());
      return {
        ...parsed,
        contextWarning: parsed.contextWarning ?? contextWarning
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      this.updateFloatingState(`解释失败：${message}`);
      return null;
    } finally {
      this.explaining = false;
      this.updateFloatingState(this.statusLabel?.textContent ?? "");
    }
  }

  private async ensureCleanArticle(settings: {
    apiBaseUrl: string;
    requestTimeoutMs: number;
  }): Promise<{ record: CleanArticleCacheRecord; cacheKey: string }> {
    this.refreshParagraphs();
    const articleFingerprint = computeArticleFingerprint(this.paragraphs);
    const cached = await getCleanArticleCache(this.normalizedUrl, articleFingerprint);

    if (cached?.cleanedText) {
      return {
        record: cached,
        cacheKey: await saveCleanArticleCache(cached)
      };
    }

    const visibleText = captureVisiblePageText();

    if (!visibleText.rawText.trim()) {
      throw new Error("当前页面没有可清洗的可见正文。");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), settings.requestTimeoutMs);
    const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}/v1/articles/clean`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        page: buildPagePayload(this.normalizedUrl, articleFingerprint),
        rawText: visibleText.rawText,
        rawTextFingerprint: visibleText.rawTextFingerprint,
        truncated: visibleText.truncated
      }),
      signal: controller.signal
    });
    window.clearTimeout(timeout);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(payload.error ?? payload.message ?? `API returned ${response.status}`);
    }

    const parsed = CleanArticleResponseSchema.parse(await response.json());

    if (!parsed.usable || !parsed.cleanedText.trim()) {
      throw new Error(parsed.failureReason ?? "模型没有返回可用的纯净正文。");
    }

    const record: CleanArticleCacheRecord = {
      normalizedUrl: this.normalizedUrl,
      url: this.normalizedUrl,
      title: document.title || location.hostname,
      articleFingerprint: parsed.articleFingerprint,
      rawTextFingerprint: parsed.rawTextFingerprint,
      cleanedText: parsed.cleanedText,
      cleanedAt: parsed.cleanedAt,
      truncated: parsed.truncated
    };
    const cacheKey = await saveCleanArticleCache(record);

    return {
      record,
      cacheKey
    };
  }
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  async main() {
    const controller = new ReaderModeController();
    await controller.init();
  }
});
